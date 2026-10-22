import { Link } from 'react-router';
import type { IncidentSummary } from '@smartcampus/shared';
import { StatusBadge } from '../../components/Badges';
import { formatAgo, formatDateTime } from '../../lib/format';
import { useApi } from '../../lib/useApi';

/** US-08 : liste des signalements de l'étudiant connecté (filtrée par l'API). */
export function MyIncidentsPage() {
  const { data, error, loading } = useApi<IncidentSummary[]>('/incidents');

  return (
    <section>
      <div className="page-head">
        <h1>Mes signalements</h1>
        <Link to="/etudiant/signaler" className="btn btn--primary">
          + Signaler un incident
        </Link>
      </div>

      {error && <p className="alert alert--error">{error.message}</p>}
      {loading && !data && <p className="muted">Chargement…</p>}

      {data && data.length === 0 && (
        <div className="empty card">
          <h2>Aucun signalement pour le moment</h2>
          <p className="muted">Un problème sur le campus ? Signalez-le en moins de 2 minutes.</p>
          <Link to="/etudiant/signaler" className="btn btn--primary">
            Signaler un incident
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="ticket-list">
          {data.map((t) => (
            <li key={t.id}>
              <Link to={`/etudiant/tickets/${t.id}`} className="ticket-card">
                <div className="ticket-card__top">
                  <span className="ticket-card__number">{t.ticketNumber}</span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="ticket-card__title">{t.title}</p>
                <p className="ticket-card__meta">
                  {t.category.label} · <time dateTime={t.createdAt} title={formatDateTime(t.createdAt)}>{formatAgo(t.createdAt)}</time>
                  {t.assignedTo && <> · suivi par {t.assignedTo.name}</>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
