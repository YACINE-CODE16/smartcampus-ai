import { Clock, TriangleAlert } from 'lucide-react';
import { PRIORITY_LABELS, STATUS_LABELS, type IncidentStatus, type Priority } from '@smartcampus/shared';
import { useI18n } from '../lib/i18n';

/** Statut : point de couleur + libellé en encre neutre (DESIGN.md). */
export function StatusBadge({ status }: { status: IncidentStatus }) {
  const { label } = useI18n();
  return (
    <span className={`status status--${status.toLowerCase()}`}>
      <span className="status__dot" aria-hidden="true" />
      {label(STATUS_LABELS[status])}
    </span>
  );
}

/** Priorité : texte discret, sauf « Critique » en jaune sécurité avec pictogramme. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t, label } = useI18n();
  if (priority === 'CRITIQUE') {
    return (
      <span className="critical">
        <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
        {label(PRIORITY_LABELS[priority])}
      </span>
    );
  }
  return (
    <span className="priority">
      <span className="sr-only">{t('Priorité : ', 'Priority: ')}</span>
      {label(PRIORITY_LABELS[priority])}
    </span>
  );
}

export function LateBadge() {
  const { t } = useI18n();
  return (
    <span className="late">
      <Clock size={14} strokeWidth={2} aria-hidden="true" />
      {t('En retard', 'Overdue')}
    </span>
  );
}
