import { PRIORITY_LABELS, STATUS_LABELS, type IncidentStatus, type Priority } from '@smartcampus/shared';
import { useI18n } from '../lib/i18n';

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const { label } = useI18n();
  return <span className={`badge badge--${status.toLowerCase()}`}>{label(STATUS_LABELS[status])}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t, label } = useI18n();
  return (
    <span className={`badge badge--prio-${priority.toLowerCase()}`} title={t('Priorité', 'Priority')}>
      <span className="sr-only">{t('Priorité : ', 'Priority: ')}</span>
      {priority === 'CRITIQUE' ? '⚠ ' : ''}
      {label(PRIORITY_LABELS[priority])}
    </span>
  );
}

export function LateBadge() {
  const { t } = useI18n();
  return <span className="badge badge--late">{t('En retard', 'Overdue')}</span>;
}
