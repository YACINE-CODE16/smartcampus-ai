import { randomUUID } from 'node:crypto';
import {
  bi,
  buildTitle,
  computePriority,
  formatTicketNumber,
  isLate,
  OPEN_STATUSES,
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
import type { LiveHub } from '../realtime/hub';
import type { NotificationService } from './notifications';

export const incidentInclude = {
  category: { select: { id: true, label: true, labelEn: true, targetHours: true } },
  building: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.IncidentInclude;

const detailInclude = {
  ...incidentInclude,
  events: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
  mergedInto: { select: { id: true, number: true } },
  rating: true,
} satisfies Prisma.IncidentInclude;

export type IncidentRow = Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>;
type IncidentDetailRow = Prisma.IncidentGetPayload<{ include: typeof detailInclude }>;

export interface NewIncidentInput {
  categoryId: string;
  buildingId: string;
  room: string;
  description: string;
  urgency: Urgency;
  /** Échange avec l'assistant à l'origine du ticket (US-21, US-32). */
  assistantInteractionId?: string;
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
    category: { id: row.category.id, label: row.category.label, labelEn: row.category.labelEn },
    building: row.building,
    room: row.room,
    owner: row.owner,
    assignedTo: row.assignedTo,
    hasPhoto: row.photoKey !== null,
    isLate: isLate(row, row.category.targetHours, now),
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
    mergedInto: row.mergedInto ? { id: row.mergedInto.id, ticketNumber: formatTicketNumber(row.mergedInto.number) } : null,
    rating: row.rating ? { score: row.rating.score, comment: row.rating.comment, createdAt: row.rating.createdAt.toISOString() } : null,
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

/** Filtres de liste communs à la liste et à l'export CSV (US-13, US-27). */
export function listWhere(user: SessionUser, query: IncidentListQuery): Prisma.IncidentWhereInput {
  const filters: Prisma.IncidentWhereInput[] = [visibleTo(user)];
  if (query.scope === 'mine' && user.role !== 'STUDENT') filters.push({ assignedToId: user.id });
  if (query.scope === 'unassigned' && user.role !== 'STUDENT') filters.push({ assignedToId: null });
  if (query.status) filters.push({ status: query.status });
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.buildingId) filters.push({ buildingId: query.buildingId });
  if (query.priority) filters.push({ priority: query.priority });
  if (query.assignedToId && user.role === 'ADMIN') filters.push({ assignedToId: query.assignedToId });
  if (query.from) filters.push({ createdAt: { gte: new Date(query.from) } });
  if (query.to) filters.push({ createdAt: { lte: new Date(query.to) } });
  if (query.late) filters.push({ status: 'NOUVEAU' }); // affiné après chargement (délai par catégorie)
  if (query.q) {
    const q = query.q.trim();
    const num = Number(q.replace(/^sc-?/i, ''));
    filters.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { room: { contains: q, mode: 'insensitive' } },
        ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
      ],
    });
  }
  return { AND: filters };
}

export class IncidentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: FileStorage,
    private readonly notifications: NotificationService,
    private readonly hub: LiveHub,
  ) {}

  /** US-03/04/05 : création d'un ticket NOUVEAU + événement « Ticket créé » ; Sécurité → alerte admin (R3). */
  async create(user: SessionUser, input: NewIncidentInput, photo?: PhotoUpload): Promise<IncidentSummary> {
    const [category, building] = await Promise.all([
      this.prisma.category.findFirst({ where: { id: input.categoryId, active: true } }),
      this.prisma.building.findUnique({ where: { id: input.buildingId } }),
    ]);
    const fields: Record<string, string> = {};
    if (!category) fields.categoryId = bi('Type inconnu', 'Unknown type');
    if (!building) fields.buildingId = bi('Bâtiment inconnu', 'Unknown building');

    let photoType: 'jpg' | 'png' | null = null;
    if (photo) {
      photoType = detectImageType(photo.buffer);
      if (!photoType) fields.photo = bi('Photo JPG ou PNG de 10 Mo maximum', 'JPG or PNG photo, 10 MB max');
    }
    if (!category || !building || Object.keys(fields).length) {
      throw new ValidationError(bi('Certains champs sont invalides.', 'Some fields are invalid.'), fields);
    }

    let photoKey: string | null = null;
    if (photo && photoType) {
      photoKey = `incidents/${randomUUID()}.${photoType}`;
      await this.storage.put(photoKey, photo.buffer, photoType === 'jpg' ? 'image/jpeg' : 'image/png');
    }

    let row: IncidentRow;
    try {
      row = await this.prisma.incident.create({
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
    } catch (err) {
      // Pas de photo orpheline si l'écriture en base échoue.
      if (photoKey) await this.storage.delete(photoKey).catch(() => undefined);
      throw err;
    }

    if (input.assistantInteractionId) {
      await this.prisma.assistantInteraction
        .updateMany({ where: { id: input.assistantInteractionId, userId: user.id, createdIncidentId: null }, data: { createdIncidentId: row.id } })
        .catch(() => undefined);
    }

    const summary = toSummary(row);
    this.hub.toRoles(['AGENT', 'ADMIN'], { type: 'incident.changed', id: row.id });
    if (row.priority === 'CRITIQUE') await this.alertCritical(summary);
    return summary;
  }

  /** R3 : alerte immédiate des admins (notification + événement temps réel). */
  async alertCritical(t: IncidentSummary): Promise<void> {
    this.hub.toRoles(['ADMIN'], { type: 'alert', kind: 'critical', id: t.id });
    await this.notifications.notifyAdmins('CRITICAL_CREATED', t.id, { ticket: t.ticketNumber, title: t.title });
  }

  /** US-08 / US-13 / US-27 : liste filtrée par R1 puis par les critères demandés. */
  async list(user: SessionUser, query: IncidentListQuery): Promise<IncidentSummary[]> {
    const rows = await this.prisma.incident.findMany({
      where: listWhere(user, query),
      include: incidentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const items = rows.map((r) => toSummary(r, now));
    return query.late ? items.filter((t) => t.isLate) : items;
  }

  /** US-09 : détail + historique. Ticket non visible → 404 (on ne révèle pas son existence). */
  async get(user: SessionUser, id: string): Promise<IncidentDetail> {
    const row = await this.prisma.incident.findFirst({ where: { AND: [{ id }, visibleTo(user)] }, include: detailInclude });
    if (!row) throw new NotFoundError(bi('Ticket introuvable.', 'Ticket not found.'));
    return toDetail(row);
  }

  /** US-04 : photo servie après contrôle d'accès. */
  async photo(user: SessionUser, id: string): Promise<StoredFile> {
    const row = await this.prisma.incident.findFirst({ where: { AND: [{ id }, visibleTo(user)] }, select: { photoKey: true } });
    const file = row?.photoKey ? await this.storage.get(row.photoKey) : null;
    if (!file) throw new NotFoundError(bi('Photo introuvable.', 'Photo not found.'));
    return file;
  }

  /** US-06 : tickets ouverts similaires (même catégorie + même bâtiment), sans description ni auteur. */
  async similar(categoryId: string, buildingId: string) {
    const rows = await this.prisma.incident.findMany({
      where: { categoryId, buildingId, status: { in: [...OPEN_STATUSES] } },
      select: { id: true, number: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    return rows.map((r) => ({ ticketNumber: formatTicketNumber(r.number), title: r.title, status: r.status, createdAt: r.createdAt.toISOString() }));
  }

  async referentials() {
    const [categories, buildings] = await Promise.all([
      this.prisma.category.findMany({
        where: { active: true },
        orderBy: { order: 'asc' },
        select: { id: true, slug: true, label: true, labelEn: true, description: true, descriptionEn: true, autoPriority: true, targetHours: true },
      }),
      this.prisma.building.findMany({ orderBy: { order: 'asc' }, select: { id: true, code: true, name: true } }),
    ]);
    return { categories, buildings };
  }
}
