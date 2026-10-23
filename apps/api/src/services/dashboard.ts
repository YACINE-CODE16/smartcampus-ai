import {
  averageScore,
  avgResolutionHours,
  aiResolvedRate,
  INCIDENT_STATUSES,
  isLate,
  OPEN_STATUSES,
  reopenRate,
  resolutionRate,
  timeSeries,
  type DashboardPeriod,
  type DashboardResponse,
  type Granularity,
  type IncidentStatus,
} from '@smartcampus/shared';
import type { PrismaClient } from '../db';

const DAY = 86_400_000;
const PERIOD_DAYS: Record<Exclude<DashboardPeriod, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** US-27 à US-32 : agrégats calculés en mémoire (volume du MVP : quelques centaines de tickets). */
export interface DashboardFilters {
  categoryId?: string;
  buildingId?: string;
}

/** Début de la période (US-27 / US-33) ; `null` = depuis le premier ticket. */
export function periodStart(period: DashboardPeriod, now = new Date()): Date | null {
  return period === 'all' ? null : new Date(now.getTime() - PERIOD_DAYS[period] * DAY);
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(period: DashboardPeriod, granularity: Granularity, filters: DashboardFilters = {}, now = new Date()): Promise<DashboardResponse> {
    const first = await this.prisma.incident.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const from = periodStart(period, now) ?? new Date((first?.createdAt ?? now).getTime() - (first ? 0 : DAY));

    const [tickets, categories, buildings, agents, open, interactions] = await Promise.all([
      this.prisma.incident.findMany({
        // US-33 : filtres période, catégorie et lieu appliqués à tous les indicateurs de la période.
        where: { createdAt: { gte: from }, ...(filters.categoryId ? { categoryId: filters.categoryId } : {}), ...(filters.buildingId ? { buildingId: filters.buildingId } : {}) },
        select: {
          status: true,
          room: true,
          createdAt: true,
          resolvedAt: true,
          reopenCount: true,
          categoryId: true,
          buildingId: true,
          assignedToId: true,
          rating: { select: { score: true } },
        },
      }),
      this.prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, label: true, labelEn: true } }),
      this.prisma.building.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, code: true } }),
      this.prisma.user.findMany({ where: { role: 'AGENT', anonymizedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      // Charge et alertes : état actuel, quelle que soit la période.
      this.prisma.incident.findMany({
        where: { status: { in: [...OPEN_STATUSES] } },
        select: { status: true, createdAt: true, priority: true, assignedToId: true, category: { select: { targetHours: true } } },
      }),
      this.prisma.assistantInteraction.findMany({
        where: { createdAt: { gte: from } },
        select: { kind: true, feedback: true, createdIncidentId: true },
      }),
    ]);

    const byStatus = Object.fromEntries(INCIDENT_STATUSES.map((s) => [s, 0])) as Record<IncidentStatus, number>;
    for (const t of tickets) byStatus[t.status]++;

    const countBy = (key: 'categoryId' | 'buildingId') => {
      const m = new Map<string, number>();
      for (const t of tickets) m.set(t[key], (m.get(t[key]) ?? 0) + 1);
      return m;
    };
    const perCategory = countBy('categoryId');
    const perBuilding = countBy('buildingId');
    const lateOpen = open.filter((t) => isLate(t, t.category.targetHours, now));
    const scores = tickets.flatMap((t) => (t.rating ? [t.rating.score] : []));

    // US-29 : salles les plus signalées.
    const rooms = new Map<string, { building: { code: string; name: string }; room: string; count: number }>();
    for (const t of tickets) {
      const b = buildings.find((x) => x.id === t.buildingId);
      if (!b) continue;
      const key = `${b.id}|${t.room.trim().toLowerCase()}`;
      const entry = rooms.get(key) ?? { building: { code: b.code, name: b.name }, room: t.room.trim(), count: 0 };
      entry.count++;
      rooms.set(key, entry);
    }
    const byRoom = [...rooms.values()].sort((a, b) => b.count - a.count).slice(0, 8);

    const byKind: Record<string, number> = {};
    for (const i of interactions) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;

    return {
      period,
      granularity,
      from: from.toISOString(),
      to: now.toISOString(),
      kpis: {
        total: tickets.length,
        avgResolutionHours: avgResolutionHours(tickets),
        resolutionRate: resolutionRate(tickets),
        reopenRate: reopenRate(tickets),
        satisfaction: averageScore(scores),
        ratingsCount: scores.length,
        openCritical: open.filter((t) => t.priority === 'CRITIQUE').length,
        late: lateOpen.length,
      },
      byStatus,
      byCategory: categories.map((c) => ({ ...c, count: perCategory.get(c.id) ?? 0 })).sort((a, b) => b.count - a.count),
      byBuilding: buildings.map((b) => ({ id: b.id, name: b.name, count: perBuilding.get(b.id) ?? 0 })).sort((a, b) => b.count - a.count),
      byRoom,
      filters: { categoryId: filters.categoryId ?? null, buildingId: filters.buildingId ?? null },
      series: timeSeries(tickets, granularity, from, now),
      agents: agents.map((a) => {
        const mine = tickets.filter((t) => t.assignedToId === a.id);
        const mineOpen = open.filter((t) => t.assignedToId === a.id);
        return {
          ...a,
          open: mineOpen.length,
          critical: mineOpen.filter((t) => t.priority === 'CRITIQUE').length,
          late: lateOpen.filter((t) => t.assignedToId === a.id).length,
          resolved: mine.filter((t) => t.status === 'RESOLU' || t.status === 'FERME').length,
          avgResolutionHours: avgResolutionHours(mine),
        };
      }),
      assistant: {
        questions: interactions.length,
        byKind,
        thumbsUp: interactions.filter((i) => i.feedback === 'UP').length,
        thumbsDown: interactions.filter((i) => i.feedback === 'DOWN').length,
        ticketsCreated: interactions.filter((i) => i.createdIncidentId !== null).length,
        aiResolvedRate: aiResolvedRate(interactions),
      },
    };
  }
}
