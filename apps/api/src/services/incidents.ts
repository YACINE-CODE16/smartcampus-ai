import { randomUUID } from 'node:crypto';
import {
  buildTitle,
  computePriority,
  formatTicketNumber,
  isLate,
  type IncidentDetail,
  type IncidentListQuery,
  type IncidentSummary,
  type SessionUser,
  type Urgency,
} from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { NotFoundError, ValidationError } from '../domain/errors';
import { Prisma } from '../generated/prisma/client';
import type { FileStorage, StoredFile } from '../ports/file-storage';

export const incidentInclude = {
  category: { select: { id: true, label: true } },
  building: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.IncidentInclude;

const detailInclude = {
  ...incidentInclude,
  events: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
} satisfies Prisma.IncidentInclude;

type IncidentRow = Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>;
type IncidentDetailRow = Prisma.IncidentGetPayload<{ include: typeof detailInclude }>;

export interface NewIncidentInput {
  categoryId: string;
  buildingId: string;
  room: string;
  description: string;
  urgency: Urgency;
}

export interface PhotoUpload {
  buffer: Buffer;
  mimetype: string;
}

/** R1 : filtre Prisma des tickets visibles par l'utilisateur. */
export function visibleTo(user: SessionUser): Prisma.IncidentWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'AGENT':
      return { OR: [{ assignedToId: user.id }, { assignedToId: null }] };
    case 'STUDENT':
      return { ownerId: user.id };
  }
}

/** Vérifie la signature binaire : on ne se fie pas au type MIME déclaré par le navigateur. */
function detectImageType(buf: Buffer): 'jpg' | 'png' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

export function toSummary(row: IncidentRow, now = new Date()): IncidentSummary {
  return {
    id: row.id,
    number: row.number,
    ticketNumber: formatTicketNumber(row.number),
    title: row.title,
    status: row.status,
    urgency: row.urgency,
    priority: row.priority,
    category: row.category,
    building: row.building,
    room: row.room,
    owner: row.owner,
    assignedTo: row.assignedTo,
    hasPhoto: row.photoKey !== null,
    isLate: isLate(row, now),
    reopenCount: row.reopenCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetail(row: IncidentDetailRow): IncidentDetail {
  return {
    ...toSummary(row),
    description: row.description,
    rejectionReason: row.rejectionReason,
    takenAt: row.takenAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    events: row.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      comment: e.comment,
      author: e.author,
      authorRole: e.authorRole,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export class IncidentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: FileStorage,
  ) {}

  /** US-03/04/05 : création d'un ticket NOUVEAU + événement « Ticket créé ». */
  async create(user: SessionUser, input: NewIncidentInput, photo?: PhotoUpload): Promise<IncidentSummary> {
    const [category, building] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: input.categoryId, active: true } }),
      this.prisma.building.findUnique({ where: { id: input.buildingId } }),
    ]);
    const fields: Record<string, string> = {};
    if (!category) fields.categoryId = 'Type inconnu';
    if (!building) fields.buildingId = 'Bâtiment inconnu';

    let photoKey: string | null = null;
    let photoType: 'jpg' | 'png' | null = null;
    if (photo) {
      photoType = detectImageType(photo.buffer);
      if (!photoType) fields.photo = 'Photo JPG ou PNG de 10 Mo maximum';
    }
    if (!category || !building || Object.keys(fields).length) throw new ValidationError('Certains champs sont invalides.', fields);

    if (photo && photoType) {
      photoKey = `incidents/${randomUUID()}.${photoType}`;
      await this.storage.put(photoKey, photo.buffer, photoType === 'jpg' ? 'image/jpeg' : 'image/png');
    }

    try {
      const row = await this.prisma.incident.create({
        data: {
          title: buildTitle(category.label, building.name, input.room),
          categoryId: category.id,
          buildingId: building.id,
          room: input.room,
          description: input.description,
          urgency: input.urgency,
          priority: computePriority(input.urgency, category.autoPriority),
          photoKey,
          ownerId: user.id,
          events: { create: { type: 'CREATED', toStatus: 'NOUVEAU', authorId: user.id, authorRole: 'STUDENT' } },
        },
        include: incidentInclude,
      });
      return toSummary(row);
    } catch (err) {
      // Pas de photo orpheline si l'écriture en base échoue.
      if (photoKey) await this.storage.delete(photoKey).catch(() => undefined);
      throw err;
    }
  }

  /** US-08 / US-13 : liste filtrée par R1 puis par les critères demandés. */
  async list(user: SessionUser, query: IncidentListQuery): Promise<IncidentSummary[]> {
    const filters: Prisma.IncidentWhereInput[] = [visibleTo(user)];
    if (query.scope === 'mine' && user.role !== 'STUDENT') filters.push({ assignedToId: user.id });
    if (query.scope === 'unassigned' && user.role !== 'STUDENT') filters.push({ assignedToId: null });
    if (query.status) filters.push({ status: query.status });
    if (query.categoryId) filters.push({ categoryId: query.categoryId });
    if (query.buildingId) filters.push({ buildingId: query.buildingId });
    if (query.assignedToId && user.role === 'ADMIN') filters.push({ assignedToId: query.assignedToId });

    const rows = await this.prisma.incident.findMany({
      where: { AND: filters },
      include: incidentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return rows.map((r) => toSummary(r, now));
  }

  /** US-09 : détail + historique. Ticket non visible → 404 (on ne révèle pas son existence). */
  async get(user: SessionUser, id: string): Promise<IncidentDetail> {
    const row = await this.prisma.incident.findFirst({ where: { AND: [{ id }, visibleTo(user)] }, include: detailInclude });
    if (!row) throw new NotFoundError('Ticket introuvable.');
    return toDetail(row);
  }

  /** US-04 : photo servie après contrôle d'accès. */
  async photo(user: SessionUser, id: string): Promise<StoredFile> {
    const row = await this.prisma.incident.findFirst({ where: { AND: [{ id }, visibleTo(user)] }, select: { photoKey: true } });
    const file = row?.photoKey ? await this.storage.get(row.photoKey) : null;
    if (!file) throw new NotFoundError('Photo introuvable.');
    return file;
  }

  async referentials() {
    const [categories, buildings] = await Promise.all([
      this.prisma.category.findMany({
        where: { active: true },
        orderBy: { order: 'asc' },
        select: { id: true, slug: true, label: true, description: true, autoPriority: true },
      }),
      this.prisma.building.findMany({ orderBy: { order: 'asc' }, select: { id: true, code: true, name: true } }),
    ]);
    return { categories, buildings };
  }
}
