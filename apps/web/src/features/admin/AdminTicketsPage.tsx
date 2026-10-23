import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  INCIDENT_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type AgentDto,
  type IncidentSummary,
  type Referentials,
} from '@smartcampus/shared';
import { TicketTable } from '../../components/TicketTable';
import { query } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';

const FILTER_KEYS = ['status', 'categoryId', 'buildingId', 'assignedToId', 'priority', 'late', 'q'] as const;

/** US-13 : liste de tous les tickets, filtrable (statut, catégorie, bâtiment, agent, priorité, retard, recherche). */
export function AdminTicketsPage() {
  const { t, label, category } = useI18n();
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<(typeof FILTER_KEYS)[number], string>;
  const qs = query(filters);
  const { data, error, loading, reload } = useApi<IncidentSummary[]>(`/incidents${qs}`);
  const { data: refs } = useApi<Referentials>('/referentials');
  const { data: agents } = useApi<AgentDto[]>('/agents');
  useLive((e) => e.type === 'incident.changed' && reload());

  function set(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <section>
      <div className="page-head">
        <h1>
          {t('Tickets', 'Tickets')} {data && <span className="count">{data.length}</span>}
        </h1>
        {/* US-27 : export des tickets affichés (même filtres), tracé dans le journal d'audit */}
        <a className="btn btn--secondary" href={`/api/admin/incidents/export.csv${qs}`} download>
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          {t('Exporter en CSV', 'Export to CSV')}
        </a>
      </div>

      <form className="filters panel" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="f-q">{t('Recherche', 'Search')}</label>
          <input id="f-q" type="search" value={filters.q} placeholder={t('SC-0042, salle, titre…', 'SC-0042, room, title…')} onChange={(e) => set('q', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="f-status">{t('Statut', 'Status')}</label>
          <select id="f-status" value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">{t('Tous', 'All')}</option>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(STATUS_LABELS[s])}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-cat">{t('Catégorie', 'Category')}</label>
          <select id="f-cat" value={filters.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">{t('Toutes', 'All')}</option>
            {refs?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {category(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-bld">{t('Bâtiment', 'Building')}</label>
          <select id="f-bld" value={filters.buildingId} onChange={(e) => set('buildingId', e.target.value)}>
            <option value="">{t('Tous', 'All')}</option>
            {refs?.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-agent">{t('Agent', 'Agent')}</label>
          <select id="f-agent" value={filters.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}>
            <option value="">{t('Tous', 'All')}</option>
            {agents?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-prio">{t('Priorité', 'Priority')}</label>
          <select id="f-prio" value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
            <option value="">{t('Toutes', 'All')}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {label(PRIORITY_LABELS[p])}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={filters.late === 'true'} onChange={(e) => set('late', e.target.checked ? 'true' : '')} />
          {t('En retard uniquement', 'Overdue only')}
        </label>
        {qs && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setParams({}, { replace: true })}>
            {t('Réinitialiser', 'Reset')}
          </button>
        )}
      </form>

      {error && <p className="alert alert--error">{error.message}</p>}
      {loading && !data ? (
        <p className="muted">{t('Chargement…', 'Loading…')}</p>
      ) : (
        <TicketTable
          variant="work"
          caption={t('Tickets filtrés', 'Filtered tickets')}
          items={data ?? []}
          linkBase="/admin/tickets"
          empty={t('Aucun ticket ne correspond à ces filtres.', 'No tickets match these filters.')}
        />
      )}
    </section>
  );
}
