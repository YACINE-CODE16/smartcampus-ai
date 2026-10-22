import { Link } from 'react-router';
import type { IncidentSummary } from '@smartcampus/shared';
import { StatusBadge } from '../../components/Badges';
import { formatAgo, formatDateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

/** US-08 : liste des signalements de l'étudiant connecté (filtrée par l'API), à jour en temps réel. */
export function MyIncidentsPage() {
  const { t, category, lang } = useI18n();
  const { data, error, loading, reload } = useApi<IncidentSummary[]>('/incidents');
  useLive((e) => e.type === 'incident.changed' && data?.some((x) => x.id === e.id) && reload());

  return (
    <section>
      <div className="page-head">
        <h1>{t('Mes signalements', 'My reports')}</h1>
        <Link to="/etudiant/signaler" className="btn btn--primary">
          + {t('Signaler un incident', 'Report an incident')}
        </Link>
      </div>

      {error && <p className="alert alert--error">{error.message}</p>}
      {loading && !data && <p className="muted">{t('Chargement…', 'Loading…')}</p>}

      {data && data.length === 0 && (
        <div className="empty card">
          <h2>{t('Aucun signalement pour le moment', 'No reports yet')}</h2>
          <p className="muted">{t('Un problème sur le campus ? Signalez-le en moins de 2 minutes.', 'A problem on campus? Report it in under 2 minutes.')}</p>
          <Link to="/etudiant/signaler" className="btn btn--primary">
            {t('Signaler un incident', 'Report an incident')}
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="ticket-list">
          {data.map((x) => (
            <li key={x.id}>
              <Link to={`/etudiant/tickets/${x.id}`} className="ticket-card">
                <div className="ticket-card__top">
                  <span className="ticket-card__number">{x.ticketNumber}</span>
                  <StatusBadge status={x.status} />
                </div>
                <p className="ticket-card__title">{x.title}</p>
                <p className="ticket-card__meta">
                  {category(x.category)} ·{' '}
                  <time dateTime={x.createdAt} title={formatDateTime(x.createdAt, lang)}>
                    {formatAgo(x.createdAt, lang)}
                  </time>
                  {x.assignedTo && (
                    <>
                      {' '}
                      · {t('suivi par', 'handled by')} {x.assignedTo.name}
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
