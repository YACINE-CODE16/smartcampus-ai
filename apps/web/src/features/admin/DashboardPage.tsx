import { StatusBadge } from '../../components/Badges';
import { Clock, Printer, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  DASHBOARD_PERIODS,
  GRANULARITIES,
  INCIDENT_STATUSES,
  type DashboardPeriod,
  type DashboardResponse,
  type Granularity,
  type Referentials,
} from '@smartcampus/shared';
import { query } from '../../lib/api';
import { formatHours, formatPercent } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { touches, useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';
import { ChartCard, HBarChart, TrendChart } from './charts';
import { ExportButton } from '../../components/ExportButton';
import { TableWrap } from '../../components/TableWrap';

const PERIOD_LABELS: Record<DashboardPeriod, { fr: string; en: string }> = {
  '7d': { fr: '7 jours', en: '7 days' },
  '30d': { fr: '30 jours', en: '30 days' },
  '90d': { fr: '90 jours', en: '90 days' },
  all: { fr: 'Tout', en: 'All' },
};
const GRANULARITY_LABELS: Record<Granularity, { fr: string; en: string }> = {
  day: { fr: 'Jour', en: 'Day' },
  week: { fr: 'Semaine', en: 'Week' },
  month: { fr: 'Mois', en: 'Month' },
  year: { fr: 'Année', en: 'Year' },
};
const KIND_LABELS: Record<string, { fr: string; en: string }> = {
  faq: { fr: 'Réponse FAQ', en: 'FAQ answer' },
  document: { fr: 'Réponse documentaire', en: 'Document answer' },
  ticket_status: { fr: 'Suivi de ticket', en: 'Ticket status' },
  needs_ticket: { fr: 'Ticket proposé', en: 'Ticket suggested' },
  out_of_scope: { fr: 'Hors périmètre', en: 'Out of scope' },
};

/** Cellule d'indicateur : libellé, valeur, précision. Les cellules forment une seule bande (pas de cartes). */
function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'critical' | 'late' }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <p className="stat__label">
        {tone === 'critical' && <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />}
        {tone === 'late' && <Clock size={14} strokeWidth={2} aria-hidden="true" />}
        {label}
      </p>
      <p className="stat__value">{value}</p>
      {hint && <p className="stat__hint">{hint}</p>}
    </div>
  );
}

/** US-27 à US-33 : tableau de bord de l'administration. */
export function DashboardPage() {
  const { t, label, category, lang } = useI18n();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [categoryId, setCategoryId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const { data: refs } = useApi<Referentials>('/incidents/referentials');
  const filters = { period, categoryId, buildingId };
  const { data: d, error, loading, reload } = useApi<DashboardResponse>(`/dashboard${query({ ...filters, granularity })}`);
  useLive((e) => (touches(e) || e.type === 'alert') && reload());

  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 });

  return (
    <section className="dashboard">
      <div className="page-head">
        <h1>{t('Tableau de bord', 'Dashboard')}</h1>
        <div className="segmented segmented--inline" role="radiogroup" aria-label={t('Période', 'Period')}>
          {DASHBOARD_PERIODS.map((p) => (
            <label key={p} className={`segmented__item ${period === p ? 'segmented__item--on' : ''}`}>
              <input type="radio" name="period" checked={period === p} onChange={() => setPeriod(p)} />
              {label(PERIOD_LABELS[p])}
            </label>
          ))}
        </div>
      </div>

      {/* US-33 : filtres (période ci-dessus, catégorie, lieu) et exports */}
      <form className="filters panel dash-filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="d-cat">{t('Catégorie', 'Category')}</label>
          <select id="d-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('Toutes', 'All')}</option>
            {refs?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {category(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-bld">{t('Lieu', 'Location')}</label>
          <select id="d-bld" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">{t('Tous les bâtiments', 'All buildings')}</option>
            {refs?.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="dash-filters__export">
          <ExportButton path={`/dashboard/export.csv${query(filters)}`} fileName="tableau-de-bord.csv" />
          <button type="button" className="btn btn--secondary" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
            {t('Exporter en PDF', 'Export to PDF')}
          </button>
        </div>
      </form>

      {error && <p className="alert alert--error">{error.message}</p>}
      {loading && !d && <p className="muted">{t('Chargement…', 'Loading…')}</p>}

      {d && (
        <>
          {/* US-28 + état actuel */}
          <div className="stats panel">
            <Tile label={t('Tickets sur la période', 'Tickets in period')} value={nf.format(d.kpis.total)} />
            <Tile label={t('Délai moyen de résolution', 'Average resolution time')} value={formatHours(d.kpis.avgResolutionHours, lang)} />
            <Tile label={t('Taux de résolution', 'Resolution rate')} value={formatPercent(d.kpis.resolutionRate, lang)} />
            <Tile label={t('Taux de réouverture', 'Reopen rate')} value={formatPercent(d.kpis.reopenRate, lang)} />
            <Tile
              label={t('Satisfaction', 'Satisfaction')}
              value={d.kpis.satisfaction === null ? '—' : `${nf.format(d.kpis.satisfaction)} / 5`}
              hint={t(`${d.kpis.ratingsCount} note(s)`, `${d.kpis.ratingsCount} rating(s)`)}
            />
            <Link to="/admin/tickets?priority=CRITIQUE" className="tile-link">
              <Tile label={t('Critiques ouverts', 'Open critical')} value={String(d.kpis.openCritical)} hint={t('maintenant', 'right now')} tone="critical" />
            </Link>
            <Link to="/admin/tickets?late=true" className="tile-link">
              <Tile label={t('En retard', 'Overdue')} value={String(d.kpis.late)} hint={t('maintenant', 'right now')} tone="late" />
            </Link>
          </div>

          {/* US-27 : compteurs par statut */}
          <section className="card status-strip" aria-label={t('Tickets par statut', 'Tickets by status')}>
            <h2>{t('Par statut', 'By status')}</h2>
            <ul>
              {INCIDENT_STATUSES.map((s) => (
                <li key={s}>
                  <Link to={`/admin/tickets?status=${s}`}>
                    <StatusBadge status={s} />
                    <strong>{d.byStatus[s]}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="charts">
            <ChartCard
              title={t('Évolution', 'Trend')}
              subtitle={t('Tickets créés et résolus', 'Tickets created and resolved')}
              table={
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">{t('Période', 'Period')}</th>
                      <th scope="col">{t('Créés', 'Created')}</th>
                      <th scope="col">{t('Résolus', 'Resolved')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.series.map((p) => (
                      <tr key={p.bucket}>
                        <td>{p.bucket}</td>
                        <td>{p.created}</td>
                        <td>{p.resolved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <div className="segmented segmented--small" role="radiogroup" aria-label={t('Granularité', 'Granularity')}>
                {GRANULARITIES.map((g) => (
                  <label key={g} className={`segmented__item ${granularity === g ? 'segmented__item--on' : ''}`}>
                    <input type="radio" name="granularity" checked={granularity === g} onChange={() => setGranularity(g)} />
                    {label(GRANULARITY_LABELS[g])}
                  </label>
                ))}
              </div>
              <TrendChart data={d.series} createdLabel={t('Créés', 'Created')} resolvedLabel={t('Résolus', 'Resolved')} />
            </ChartCard>

            <ChartCard
              title={t('Par catégorie', 'By category')}
              table={<SimpleTable rows={d.byCategory.map((c) => [category(c), c.count])} head={[t('Catégorie', 'Category'), t('Tickets', 'Tickets')]} />}
            >
              <HBarChart data={d.byCategory.map((c) => ({ name: category(c), value: c.count }))} valueLabel={t('Tickets', 'Tickets')} />
            </ChartCard>

            <ChartCard
              title={t('Par bâtiment', 'By building')}
              subtitle={t('Zones à problèmes récurrents', 'Recurring problem areas')}
              table={<SimpleTable rows={d.byBuilding.map((b) => [b.name, b.count])} head={[t('Bâtiment', 'Building'), t('Tickets', 'Tickets')]} />}
            >
              <HBarChart data={d.byBuilding.map((b) => ({ name: b.name.split(' – ')[0]!, value: b.count }))} valueLabel={t('Tickets', 'Tickets')} />
            </ChartCard>

            {/* US-29 : par salle */}
            <ChartCard
              title={t('Salles les plus signalées', 'Most reported rooms')}
              table={<SimpleTable rows={d.byRoom.map((r) => [`${r.building.code} ${r.room}`, r.count])} head={[t('Salle', 'Room'), t('Tickets', 'Tickets')]} />}
            >
              <HBarChart data={d.byRoom.map((r) => ({ name: `${r.building.code} ${r.room}`, value: r.count }))} valueLabel={t('Tickets', 'Tickets')} />
            </ChartCard>

            {/* US-32 */}
            <section className="card">
              <h2>{t('Charge par agent', 'Workload per agent')}</h2>
              <TableWrap card={false} label={t('Charge par agent', 'Workload per agent')}>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">{t('Agent', 'Agent')}</th>
                      <th scope="col">{t('Ouverts', 'Open')}</th>
                      <th scope="col">{t('Critiques', 'Critical')}</th>
                      <th scope="col">{t('En retard', 'Overdue')}</th>
                      <th scope="col">{t('Résolus (période)', 'Resolved (period)')}</th>
                      <th scope="col">{t('Délai moyen', 'Avg. time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.agents.map((a) => (
                      <tr key={a.id}>
                        <th scope="row">
                          <Link to={`/admin/tickets?assignedToId=${a.id}`}>{a.name}</Link>
                        </th>
                        <td>{a.open}</td>
                        <td>{a.critical > 0 ? (
                            <span className="critical">
                              <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
                              {a.critical}
                            </span>
                          ) : (
                            0
                          )}</td>
                        <td>{a.late > 0 ? (
                            <span className="late">
                              <Clock size={14} strokeWidth={2} aria-hidden="true" />
                              {a.late}
                            </span>
                          ) : (
                            0
                          )}</td>
                        <td>{a.resolved}</td>
                        <td>{formatHours(a.avgResolutionHours, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>

            {/* US-31 */}
            <section className="card">
              <h2>{t('Assistant IA', 'AI assistant')}</h2>
              <p className="muted chart-card__sub">{t('Statistiques agrégées, sans le contenu des questions.', 'Aggregated statistics, without question content.')}</p>
              <div className="stats stats--inline">
                <Tile label={t('Questions', 'Questions')} value={String(d.assistant.questions)} />
                <Tile label={t('Résolues par l’IA', 'Solved by AI')} value={formatPercent(d.assistant.aiResolvedRate, lang)} />
                <Tile label={t('Avis utiles / pas utiles', 'Helpful / not helpful')} value={`${d.assistant.thumbsUp} / ${d.assistant.thumbsDown}`} />
                <Tile label={t('Tickets créés via l’assistant', 'Tickets from assistant')} value={String(d.assistant.ticketsCreated)} />
              </div>
              {d.assistant.questions > 0 && (
                <SimpleTable
                  head={[t('Type de réponse', 'Answer type'), t('Nombre', 'Count')]}
                  rows={Object.entries(d.assistant.byKind).map(([k, n]) => [KIND_LABELS[k] ? label(KIND_LABELS[k]) : k, n])}
                />
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: [string, string]; rows: [string, number][] }) {
  return (
    <table className="table table--compact">
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
