import type { Lang } from '../config/i18n';
import { STATUS_LABELS, type IncidentStatus } from '../config/statuses';

export const NOTIFICATION_TYPES = [
  'STATUS_CHANGED',
  'ASSIGNED',
  'REOPENED',
  'REJECTED',
  'MERGED',
  'OVERDUE',
  'CRITICAL_CREATED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Paramètres d'une notification ; le texte est rendu dans la langue du lecteur. */
export interface NotificationParams {
  ticket: string;
  title?: string;
  from?: IncidentStatus;
  to?: IncidentStatus;
  reason?: string;
  target?: string;
  hours?: number;
}

/** US-10 : texte d'une notification (in-app et email). */
export function notificationText(type: NotificationType, p: NotificationParams, lang: Lang): { title: string; body: string } {
  const en = lang === 'en';
  const status = (s?: IncidentStatus) => (s ? STATUS_LABELS[s][lang] : '');
  switch (type) {
    case 'STATUS_CHANGED':
      return en
        ? { title: `Ticket ${p.ticket}: ${status(p.to)}`, body: `Your ticket ${p.ticket} moved from "${status(p.from)}" to "${status(p.to)}".` }
        : { title: `Ticket ${p.ticket} : ${status(p.to)}`, body: `Votre ticket ${p.ticket} est passé de « ${status(p.from)} » à « ${status(p.to)} ».` };
    case 'ASSIGNED':
      return en
        ? { title: `Ticket ${p.ticket} assigned to you`, body: `${p.title ?? ''}` }
        : { title: `Ticket ${p.ticket} vous est affecté`, body: `${p.title ?? ''}` };
    case 'REOPENED':
      return en
        ? { title: `Ticket ${p.ticket} disputed`, body: `The student disputed the resolution: "${p.reason ?? ''}".` }
        : { title: `Ticket ${p.ticket} contesté`, body: `L'étudiant conteste la résolution : « ${p.reason ?? ''} ».` };
    case 'REJECTED':
      return en
        ? { title: `Ticket ${p.ticket} rejected`, body: `Reason: ${p.reason ?? ''}` }
        : { title: `Ticket ${p.ticket} rejeté`, body: `Motif : ${p.reason ?? ''}` };
    case 'MERGED':
      return en
        ? { title: `Ticket ${p.ticket} merged`, body: `Your ticket was merged into ${p.target}, which is already being handled.` }
        : { title: `Ticket ${p.ticket} fusionné`, body: `Votre ticket a été fusionné avec ${p.target}, déjà en cours de traitement.` };
    case 'OVERDUE':
      return en
        ? { title: `Ticket ${p.ticket} is delayed`, body: `Your ticket has not been picked up within ${p.hours} h. The administration has been alerted.` }
        : { title: `Ticket ${p.ticket} en retard`, body: `Votre ticket n'a pas été pris en charge sous ${p.hours} h. L'administration a été alertée.` };
    case 'CRITICAL_CREATED':
      return en
        ? { title: `Critical ticket ${p.ticket}`, body: `${p.title ?? ''}` }
        : { title: `Ticket critique ${p.ticket}`, body: `${p.title ?? ''}` };
  }
}
