import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import type { IncidentSummary } from '@smartcampus/shared';
import { TicketTable } from '../../components/TicketTable';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

/** US-08 : liste des signalements de l'étudiant connecté (filtrée par l'API), à jour en temps réel. */
export function MyIncidentsPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi<IncidentSummary[]>('/incidents');
  useLive((e) => e.type === 'incident.changed' && data?.some((x) => x.id === e.id) && reload());

  return (
    <section>
      <div className="page-head">
        <h1>{t('Mes signalements', 'My reports')}</h1>
        <Link to="/etudiant/signaler" className="btn btn--primary">
          <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
          {t('Signaler un incident', 'Report an incident')}
        </Link>
      </div>

      {error && <p className="callout callout--danger">{error.message}</p>}
      {loading && !data && <p className="quiet">{t('Chargement…', 'Loading…')}</p>}
      {data && (
        <TicketTable
          items={data}
          variant="student"
          linkBase="/etudiant/tickets"
          caption={t('Mes signalements', 'My reports')}
          empty={t(
            'Vous n’avez encore rien signalé. Un problème sur le campus ? Signalez-le en moins de 2 minutes.',
            'You have not reported anything yet. A problem on campus? Report it in under 2 minutes.',
          )}
        />
      )}
    </section>
  );
}
