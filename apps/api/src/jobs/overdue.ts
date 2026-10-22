import { formatTicketNumber, isLate } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { LiveHub } from '../realtime/hub';
import type { NotificationService } from '../services/notifications';

/**
 * US-18 : repère les tickets encore NOUVEAU au-delà du délai cible de leur catégorie,
 * prévient l'étudiant et alerte les admins — une seule fois par ticket (`lateNotifiedAt`).
 * Renvoie le nombre de tickets nouvellement signalés.
 */
export async function checkOverdue(
  deps: { prisma: PrismaClient; notifications: NotificationService; hub: LiveHub },
  now = new Date(),
): Promise<number> {
  const candidates = await deps.prisma.incident.findMany({
    where: { status: 'NOUVEAU', lateNotifiedAt: null },
    select: { id: true, number: true, status: true, createdAt: true, ownerId: true, category: { select: { targetHours: true } } },
  });
  const late = candidates.filter((c) => isLate(c, c.category.targetHours, now));

  for (const t of late) {
    // Marquage conditionnel : deux contrôles concurrents ne notifient pas deux fois.
    const { count } = await deps.prisma.incident.updateMany({ where: { id: t.id, lateNotifiedAt: null }, data: { lateNotifiedAt: now } });
    if (count === 0) continue;
    await deps.notifications.notify(t.ownerId, 'OVERDUE', t.id, { ticket: formatTicketNumber(t.number), hours: t.category.targetHours });
    deps.hub.toRoles(['ADMIN'], { type: 'alert', kind: 'late', id: t.id });
  }
  return late.length;
}
