import { OPEN_STATUSES, type AgentDto, type AlertsResponse, type AuditAction, type AuditEntryDto, type CategoryDto } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import { NotFoundError } from '../domain/errors';
import { incidentInclude, toSummary } from './incidents';

const categorySelect = {
  id: true,
  slug: true,
  label: true,
  labelEn: true,
  description: true,
  descriptionEn: true,
  autoPriority: true,
  targetHours: true,
} as const;

/** Lectures et réglages réservés à l'administration. */
export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

  /** R3 + US-18 : tickets critiques ouverts et tickets en retard. */
  async alerts(now = new Date()): Promise<AlertsResponse> {
    const rows = await this.prisma.incident.findMany({
      where: { OR: [{ priority: 'CRITIQUE', status: { in: [...OPEN_STATUSES] } }, { status: 'NOUVEAU' }] },
      include: incidentInclude,
      orderBy: { createdAt: 'asc' },
    });
    const items = rows.map((r) => toSummary(r, now));
    return {
      critical: items.filter((t) => t.priority === 'CRITIQUE'),
      late: items.filter((t) => t.isLate),
    };
  }

  /** US-13 / US-33 : agents assignables avec leur charge ouverte. */
  async agents(): Promise<AgentDto[]> {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT', anonymizedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { assignedIncidents: { where: { status: { in: [...OPEN_STATUSES] } } } } },
      },
    });
    return agents.map((a) => ({ id: a.id, name: a.name, email: a.email, openCount: a._count.assignedIncidents }));
  }

  categories(): Promise<CategoryDto[]> {
    return this.prisma.category.findMany({ orderBy: { order: 'asc' }, select: categorySelect });
  }

  /** US-18 : délai cible de prise en charge d'une catégorie. */
  async setTargetHours(categoryId: string, targetHours: number): Promise<CategoryDto> {
    const exists = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) throw new NotFoundError();
    return this.prisma.category.update({ where: { id: categoryId }, data: { targetHours }, select: categorySelect });
  }

  /** US-37 : 200 dernières entrées du journal d'audit, filtrables par action. */
  async auditLog(action?: AuditAction): Promise<AuditEntryDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, name: true } } },
    });
    // Le nom de l'utilisateur ciblé est résolu à la lecture (jamais stocké : il disparaît avec une anonymisation).
    const userIds = rows.filter((r) => r.targetType === 'user').map((r) => r.targetId);
    const users = new Map(
      (await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      actorRole: r.actorRole,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel: r.targetType === 'user' ? (users.get(r.targetId) ?? null) : null,
      details: r.details as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
