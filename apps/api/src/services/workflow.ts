import {
  bi,
  buildTitle,
  canMerge,
  canRate,
  canRequalify,
  canTake,
  canView,
  computePriority,
  findTransition,
  formatTicketNumber,
  isClosed,
  SETTINGS,
  URGENCY_LABELS,
  type IncidentStatus,
  type InternalNoteDto,
  type SessionUser,
  type Urgency,
} from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../domain/errors';
import type { Prisma } from '../generated/prisma/client';
import type { LiveHub } from '../realtime/hub';
import type { AuditService } from './audit';
import { incidentInclude, visibleTo, type IncidentService } from './incidents';
import type { NotificationService } from './notifications';

const NOT_FOUND = bi('Ticket introuvable.', 'Ticket not found.');
const CONFLICT_CHANGED = bi(
  'Ce ticket vient d’être modifié par quelqu’un d’autre. Rechargez la page.',
  'This ticket was just changed by someone else. Please reload.',
);

export interface TransitionInput {
  to: IncidentStatus;
  comment?: string;
  reason?: string;
}

export interface RequalifyInput {
  categoryId?: string;
  urgency?: Urgency;
}

/**
 * Traitement des tickets (US-11, US-13 à US-17). Chaque action :
 * contrôle d'accès → règle pure partagée → écriture conditionnelle (anti-concurrence)
 * + événement d'historique → notifications → temps réel.
 */
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly incidents: IncidentService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly hub: LiveHub,
  ) {}

  private async load(user: SessionUser, id: string) {
    const row = await this.prisma.incident.findFirst({ where: { AND: [{ id }, visibleTo(user)] }, include: incidentInclude });
    if (!row) throw new NotFoundError(NOT_FOUND);
    return row;
  }

  /** Prévient toutes les personnes concernées qu'un ticket a changé. */
  private broadcast(row: { id: string; ownerId: string; assignedToId: string | null }, previousAssignee?: string | null) {
    this.hub.toUsers([row.ownerId, row.assignedToId, previousAssignee], { type: 'incident.changed', id: row.id });
    this.hub.toRoles(['ADMIN', 'AGENT'], { type: 'incident.changed', id: row.id });
  }

  /** Écriture conditionnelle : échoue (409) si le ticket a changé depuis sa lecture. */
  private async guardedUpdate(
    tx: Prisma.TransactionClient,
    where: Prisma.IncidentWhereInput & { id: string },
    data: Prisma.IncidentUncheckedUpdateManyInput,
    conflict: string = CONFLICT_CHANGED,
  ) {
    const { count } = await tx.incident.updateMany({ where, data });
    if (count === 0) throw new ConflictError(conflict);
  }

  /** US-14 (D4) : l'agent s'affecte un ticket non affecté et le passe EN_COURS. */
  async take(user: SessionUser, id: string) {
    const row = await this.load(user, id);
    if (!canTake(user, row)) throw new ConflictError(bi('Ce ticket ne peut pas être pris en charge.', 'This ticket cannot be taken.'));
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.guardedUpdate(
        tx,
        { id, status: 'NOUVEAU', assignedToId: null },
        { status: 'EN_COURS', assignedToId: user.id, takenAt: now },
        bi('Ce ticket vient d’être pris en charge par un autre agent.', 'This ticket was just taken by another agent.'),
      );
      await tx.incidentEvent.create({
        data: { incidentId: id, type: 'STATUS', fromStatus: 'NOUVEAU', toStatus: 'EN_COURS', authorId: user.id, authorRole: user.role },
      });
    });
    const ticket = formatTicketNumber(row.number);
    await this.notifications.notify(row.ownerId, 'STATUS_CHANGED', id, { ticket, from: 'NOUVEAU', to: 'EN_COURS' });
    this.broadcast({ ...row, assignedToId: user.id });
    return this.incidents.get(user, id);
  }

  /** US-14, US-11, US-17 : transition selon la table partagée. */
  async transition(user: SessionUser, id: string, input: TransitionInput) {
    const row = await this.load(user, id);
    const t = findTransition(user, row, input.to);
    if (!t) throw new ConflictError(bi('Transition non autorisée.', 'Transition not allowed.'));
    const reason = input.reason?.trim();
    const comment = input.comment?.trim() || null;
    if (t.requiresReason && (!reason || reason.length < SETTINGS.reason.min)) {
      throw new ValidationError(bi('Le motif est obligatoire.', 'A reason is required.'), {
        reason: bi(`Motif obligatoire (${SETTINGS.reason.min} caractères minimum)`, `Reason required (at least ${SETTINGS.reason.min} characters)`),
      });
    }
    if (t.requiresComment && !comment) {
      throw new ValidationError(bi('Le commentaire est obligatoire.', 'A comment is required.'), {
        comment: bi('Expliquez ce qui ne va pas', 'Explain what is still wrong'),
      });
    }

    const now = new Date();
    const data: Prisma.IncidentUncheckedUpdateManyInput = { status: t.to };
    if (t.to === 'EN_COURS' && t.from === 'NOUVEAU') data.takenAt = row.takenAt ?? now;
    if (t.to === 'RESOLU') data.resolvedAt = now;
    if (t.to === 'FERME') data.closedAt = now;
    if (t.to === 'REJETE') Object.assign(data, { rejectionReason: reason, closedAt: now });
    if (t.countsAsReopen) Object.assign(data, { reopenCount: { increment: 1 }, resolvedAt: null });

    await this.prisma.$transaction(async (tx) => {
      await this.guardedUpdate(tx, { id, status: t.from }, data);
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: 'STATUS',
          fromStatus: t.from,
          toStatus: t.to,
          comment: t.to === 'REJETE' ? reason : comment,
          authorId: user.id,
          authorRole: user.role,
        },
      });
      if (t.to === 'REJETE') await this.audit.log(user, 'REJECT', { type: 'incident', id }, { ticket: formatTicketNumber(row.number), reason }, tx);
    });

    const ticket = formatTicketNumber(row.number);
    if (t.countsAsReopen) {
      if (row.assignedToId) await this.notifications.notify(row.assignedToId, 'REOPENED', id, { ticket, reason: comment ?? '' });
    } else if (row.ownerId !== user.id) {
      if (t.to === 'REJETE') await this.notifications.notify(row.ownerId, 'REJECTED', id, { ticket, reason });
      else await this.notifications.notify(row.ownerId, 'STATUS_CHANGED', id, { ticket, from: t.from, to: t.to });
    }
    this.broadcast(row);
    return this.incidents.get(user, id);
  }

  /** US-13 : l'admin affecte (ou réaffecte) un ticket à un agent, sans changer son statut (D7). */
  async assign(user: SessionUser, id: string, agentId: string) {
    const row = await this.load(user, id);
    if (isClosed(row.status)) throw new ConflictError(bi('Un ticket clos ne peut pas être affecté.', 'A closed ticket cannot be assigned.'));
    const agent = await this.prisma.user.findFirst({ where: { id: agentId, role: 'AGENT', anonymizedAt: null }, select: { id: true, name: true } });
    if (!agent) throw new ValidationError(bi('Agent inconnu.', 'Unknown agent.'), { agentId: bi('Choisissez un agent', 'Choose an agent') });
    if (row.assignedToId === agent.id) return this.incidents.get(user, id);

    await this.prisma.$transaction(async (tx) => {
      await this.guardedUpdate(tx, { id, status: row.status, assignedToId: row.assignedToId }, { assignedToId: agent.id });
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: 'ASSIGN',
          fromStatus: row.status,
          toStatus: row.status,
          comment: bi(`Affecté à ${agent.name}`, `Assigned to ${agent.name}`),
          authorId: user.id,
          authorRole: user.role,
        },
      });
    });
    await this.notifications.notify(agent.id, 'ASSIGNED', id, { ticket: formatTicketNumber(row.number), title: row.title });
    this.broadcast({ ...row, assignedToId: agent.id }, row.assignedToId);
    return this.incidents.get(user, id);
  }

  /** US-16 : requalification (catégorie, urgence) ; priorité et titre recalculés ; Sécurité → alerte admin. */
  async requalify(user: SessionUser, id: string, input: RequalifyInput) {
    const row = await this.load(user, id);
    if (!canRequalify(user, row)) throw new ForbiddenError(bi('Vous ne pouvez pas modifier ce ticket.', 'You cannot edit this ticket.'));

    const category = input.categoryId
      ? await this.prisma.category.findFirst({ where: { id: input.categoryId, active: true } })
      : await this.prisma.category.findUniqueOrThrow({ where: { id: row.categoryId } });
    if (!category) throw new ValidationError(bi('Type inconnu.', 'Unknown type.'), { categoryId: bi('Type inconnu', 'Unknown type') });
    const urgency = input.urgency ?? row.urgency;
    const priority = computePriority(urgency, category.autoPriority);

    const changesFr: string[] = [];
    const changesEn: string[] = [];
    if (category.id !== row.categoryId) {
      changesFr.push(`Catégorie : ${row.category.label} → ${category.label}`);
      changesEn.push(`Category: ${row.category.labelEn || row.category.label} → ${category.labelEn || category.label}`);
    }
    if (urgency !== row.urgency) {
      changesFr.push(`Urgence : ${URGENCY_LABELS[row.urgency].fr} → ${URGENCY_LABELS[urgency].fr}`);
      changesEn.push(`Urgency: ${URGENCY_LABELS[row.urgency].en} → ${URGENCY_LABELS[urgency].en}`);
    }
    if (!changesFr.length) return this.incidents.get(user, id);

    await this.prisma.$transaction(async (tx) => {
      const building = await tx.building.findUniqueOrThrow({ where: { id: row.buildingId } });
      await this.guardedUpdate(
        tx,
        { id, status: row.status, categoryId: row.categoryId, urgency: row.urgency },
        { categoryId: category.id, urgency, priority, title: buildTitle(category.label, building.name, row.room) },
      );
      await tx.incidentEvent.create({
        data: {
          incidentId: id,
          type: 'UPDATE',
          fromStatus: row.status,
          toStatus: row.status,
          comment: bi(changesFr.join(' · '), changesEn.join(' · ')),
          authorId: user.id,
          authorRole: user.role,
        },
      });
    });
    this.broadcast(row);
    const detail = await this.incidents.get(user, id);
    if (priority === 'CRITIQUE' && row.priority !== 'CRITIQUE') await this.incidents.alertCritical(detail);
    return detail;
  }

  /** US-17 : fusion d'un doublon dans un ticket principal ; le doublon passe REJETE (D16). */
  async merge(user: SessionUser, id: string, targetNumber: number) {
    const dup = await this.load(user, id);
    const target = await this.prisma.incident.findFirst({ where: { AND: [{ number: targetNumber }, visibleTo(user)] } });
    if (!target) {
      throw new ValidationError(bi('Ticket principal introuvable.', 'Main ticket not found.'), {
        target: bi('Ticket introuvable ou non accessible', 'Ticket not found or not accessible'),
      });
    }
    if (!canMerge(user, dup, target)) {
      throw new ConflictError(bi('Fusion impossible : deux tickets distincts et non clos sont requis.', 'Cannot merge: two distinct open tickets are required.'));
    }
    const dupNo = formatTicketNumber(dup.number);
    const targetNo = formatTicketNumber(target.number);
    const reason = bi(`Doublon de ${targetNo}`, `Duplicate of ${targetNo}`);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.guardedUpdate(tx, { id, status: dup.status }, { status: 'REJETE', rejectionReason: reason, mergedIntoId: target.id, closedAt: now });
      await tx.incidentEvent.createMany({
        data: [
          { incidentId: id, type: 'MERGE', fromStatus: dup.status, toStatus: 'REJETE', comment: reason, authorId: user.id, authorRole: user.role },
          {
            incidentId: target.id,
            type: 'MERGE',
            fromStatus: target.status,
            toStatus: target.status,
            comment: bi(`Doublon ${dupNo} fusionné dans ce ticket`, `Duplicate ${dupNo} merged into this ticket`),
            authorId: user.id,
            authorRole: user.role,
          },
        ],
      });
      await this.audit.log(user, 'MERGE', { type: 'incident', id }, { duplicate: dupNo, target: targetNo }, tx);
    });
    await this.notifications.notify(dup.ownerId, 'MERGED', id, { ticket: dupNo, target: targetNo });
    this.broadcast(dup);
    this.broadcast(target);
    return this.incidents.get(user, id);
  }

  /** US-12 : note de satisfaction par le propriétaire, une seule fois. */
  async rate(user: SessionUser, id: string, score: number, comment?: string) {
    const row = await this.load(user, id);
    const existing = await this.prisma.rating.findUnique({ where: { incidentId: id }, select: { id: true } });
    if (!canRate(user, row, existing !== null)) throw new ConflictError(bi('Ce ticket ne peut pas être noté.', 'This ticket cannot be rated.'));
    try {
      await this.prisma.rating.create({ data: { incidentId: id, ownerId: user.id, score, comment: comment?.trim() || null } });
    } catch {
      throw new ConflictError(bi('Ce ticket a déjà été noté.', 'This ticket has already been rated.'));
    }
    return this.incidents.get(user, id);
  }

  /** US-15 : notes internes, réservées aux agents (ticket visible) et aux admins. */
  async listNotes(user: SessionUser, id: string): Promise<InternalNoteDto[]> {
    if (user.role === 'STUDENT') throw new NotFoundError(NOT_FOUND);
    const row = await this.load(user, id);
    if (!canView(user, row)) throw new NotFoundError(NOT_FOUND);
    const notes = await this.prisma.internalNote.findMany({
      where: { incidentId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true } } },
    });
    return notes.map((n) => ({ id: n.id, body: n.body, author: n.author, createdAt: n.createdAt.toISOString() }));
  }

  async addNote(user: SessionUser, id: string, body: string): Promise<InternalNoteDto[]> {
    if (user.role === 'STUDENT') throw new NotFoundError(NOT_FOUND);
    await this.load(user, id);
    await this.prisma.internalNote.create({ data: { incidentId: id, authorId: user.id, body: body.trim() } });
    this.hub.toRoles(['AGENT', 'ADMIN'], { type: 'incident.changed', id });
    return this.listNotes(user, id);
  }
}
