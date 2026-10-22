import { useSearchParams } from 'react-router';
import { CLOSED_STATUSES, PRIORITY_RANK, type IncidentSummary } from '@smartcampus/shared';
import { TicketList } from '../../components/TicketList';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

/** File de traitement : critique d'abord, puis les plus anciens (US-14). */
function byPriority(a: IncidentSummary, b: IncidentSummary) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
}

/** Espace agent : « Mes tickets » (affectés, non clos) et « Non affectés » (file à prendre). */
export function AgentHomePage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = params.get('onglet') === 'file' ? 'unassigned' : 'mine';
  const mine = useApi<IncidentSummary[]>('/incidents?scope=mine');
  const queue = useApi<IncidentSummary[]>('/incidents?scope=unassigned');
  useLive((e) => {
    if (e.type === 'incident.changed') {
      mine.reload();
      queue.reload();
    }
  });

  const open = (items: IncidentSummary[] | null) => (items ?? []).filter((x) => !CLOSED_STATUSES.includes(x.status)).sort(byPriority);
  const mineOpen = open(mine.data);
  const queueOpen = open(queue.data);
  const current = tab === 'mine' ? mine : queue;

  return (
    <section>
      <h1>{t('Tickets', 'Tickets')}</h1>
      <div className="subtabs" role="tablist" aria-label={t('Files de tickets', 'Ticket queues')}>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className="subtabs__btn" onClick={() => setParams({})}>
          {t('Mes tickets', 'My tickets')} <span className="count">{mineOpen.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'unassigned'} className="subtabs__btn" onClick={() => setParams({ onglet: 'file' })}>
          {t('Non affectés', 'Unassigned')} <span className="count">{queueOpen.length}</span>
        </button>
      </div>
      {current.error && <p className="alert alert--error">{current.error.message}</p>}
      {current.loading && !current.data ? (
        <p className="muted">{t('Chargement…', 'Loading…')}</p>
      ) : (
        <TicketList
          items={tab === 'mine' ? mineOpen : queueOpen}
          linkBase="/agent/tickets"
          empty={tab === 'mine' ? t('Aucun ticket ne vous est affecté.', 'No tickets assigned to you.') : t('Aucun ticket en attente.', 'No tickets waiting.')}
        />
      )}
    </section>
  );
}
