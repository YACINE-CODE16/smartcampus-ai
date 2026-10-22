import {
  formatTicketNumber,
  isLate,
  PRIORITY_LABELS,
  STATUS_LABELS,
  URGENCY_LABELS,
  type IncidentListQuery,
  type Lang,
  type SessionUser,
} from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { AuditService } from './audit';
import { listWhere } from './incidents';

/** Échappement CSV : guillemets doublés ; neutralise les formules Excel (=, +, -, @). */
function cell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** US-27 : export CSV des tickets filtrés (sans description ni données personnelles au-delà du nom), audité. */
export class ExportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async incidentsCsv(user: SessionUser, query: IncidentListQuery, lang: Lang, now = new Date()): Promise<{ csv: string; count: number }> {
    const rows = await this.prisma.incident.findMany({
      where: listWhere(user, query),
      orderBy: { number: 'asc' },
      include: {
        category: { select: { label: true, labelEn: true, targetHours: true } },
        building: { select: { name: true } },
        assignedTo: { select: { name: true } },
        rating: { select: { score: true } },
      },
    });
    const items = query.late ? rows.filter((r) => isLate(r, r.category.targetHours, now)) : rows;

    const en = lang === 'en';
    const header = en
      ? ['Ticket', 'Created', 'Status', 'Category', 'Building', 'Room', 'Urgency', 'Priority', 'Agent', 'Taken', 'Resolved', 'Closed', 'Resolution time (h)', 'Reopened', 'Overdue', 'Rating']
      : ['Ticket', 'Créé le', 'Statut', 'Catégorie', 'Bâtiment', 'Salle', 'Urgence', 'Priorité', 'Agent', 'Pris en charge', 'Résolu le', 'Fermé le', 'Délai de résolution (h)', 'Réouvertures', 'En retard', 'Note'];
    const lines = items.map((r) =>
      [
        formatTicketNumber(r.number),
        r.createdAt.toISOString(),
        STATUS_LABELS[r.status][lang],
        en && r.category.labelEn ? r.category.labelEn : r.category.label,
        r.building.name,
        r.room,
        URGENCY_LABELS[r.urgency][lang],
        PRIORITY_LABELS[r.priority][lang],
        r.assignedTo?.name ?? '',
        r.takenAt?.toISOString() ?? '',
        r.resolvedAt?.toISOString() ?? '',
        r.closedAt?.toISOString() ?? '',
        r.resolvedAt ? Math.round(((r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000) * 10) / 10 : null,
        r.reopenCount,
        isLate(r, r.category.targetHours, now) ? (en ? 'yes' : 'oui') : en ? 'no' : 'non',
        r.rating?.score ?? null,
      ]
        .map(cell)
        .join(';'),
    );

    await this.audit.log(user, 'EXPORT', { type: 'incidents', id: 'csv' }, { filters: { ...query }, count: items.length });
    // BOM UTF-8 : Excel ouvre correctement les accents.
    return { csv: `﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`, count: items.length };
  }
}
