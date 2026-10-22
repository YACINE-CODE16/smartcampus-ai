import { Link } from 'react-router';
import type { IncidentSummary } from '@smartcampus/shared';
import { formatAgo, formatDateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { LateBadge, PriorityBadge, StatusBadge } from './Badges';

/** Liste de tickets pour les agents et les admins (priorité, retard, auteur, agent). */
export function TicketList({ items, linkBase, empty }: { items: IncidentSummary[]; linkBase: string; empty: string }) {
  const { t, category, lang } = useI18n();
  if (items.length === 0) return <p className="empty card muted">{empty}</p>;
  return (
    <ul className="ticket-list">
      {items.map((x) => (
        <li key={x.id}>
          <Link to={`${linkBase}/${x.id}`} className={`ticket-card ${x.priority === 'CRITIQUE' ? 'ticket-card--critical' : ''}`}>
            <div className="ticket-card__top">
              <span className="ticket-card__number">{x.ticketNumber}</span>
              <span className="ticket-card__badges">
                {x.isLate && <LateBadge />}
                <PriorityBadge priority={x.priority} />
                <StatusBadge status={x.status} />
              </span>
            </div>
            <p className="ticket-card__title">{x.title}</p>
            <p className="ticket-card__meta">
              {category(x.category)} · {x.owner.name} ·{' '}
              <time dateTime={x.createdAt} title={formatDateTime(x.createdAt, lang)}>
                {formatAgo(x.createdAt, lang)}
              </time>
              {' · '}
              {x.assignedTo ? x.assignedTo.name : <em>{t('non affecté', 'unassigned')}</em>}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
