import { PRIORITY_LABELS, STATUS_LABELS, type IncidentStatus, type Priority } from '@smartcampus/shared';

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge badge--prio-${priority.toLowerCase()}`}>
      {priority === 'CRITIQUE' ? '⚠ ' : ''}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function LateBadge() {
  return <span className="badge badge--late">En retard</span>;
}
