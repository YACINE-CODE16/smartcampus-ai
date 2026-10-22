import { useState } from 'react';
import { Link } from 'react-router';
import {
  DASHBOARD_PERIODS,
  GRANULARITIES,
  INCIDENT_STATUSES,
  STATUS_LABELS,
  type DashboardPeriod,
  type DashboardResponse,
  type Granularity,
} from '@smartcampus/shared';
import { formatHours, formatPercent } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useLive } from '../../lib/live';
import { useApi } from '../../lib/useApi';
import { ChartCard, HBarChart, TrendChart } from './charts';
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

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'critical' | 'late' }) {
  return (
    <div className={`tile ${tone ? `tile--${tone}` : ''}`}>
      <p className="tile__label">{label}</p>
      <p className="tile__value">{value}</p>
      {hint && <p className="tile__hint">{hint}</p>}
    </div>
  );
}

/** US-28 à US-33 : tableau de bord de l'administration. */
export function DashboardPage() {
  const { t, label, category, lang } = useI18n();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const { data: d, error, loading, reload } = useApi<DashboardResponse>(`/admin/dashboard?period=${period}&granularity=${granularity}`);
  useLive((e) => (e.type === 'incident.changed' || e.type === 'alert') && reload());

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

      {error && <p className="alert alert--error">{error.message}</p>}
      {loading && !d && <p className="muted">{t('Chargement…', 'Loading…')}</p>}

      {d && (
        <>
          {/* US-29 + état actuel */}
          <div className="tiles">
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
              <Tile label={`⚠ ${t('Critiques ouverts', 'Open critical')}`} value={String(d.kpis.openCritical)} hint={t('maintenant', 'right now')} tone="critical" />
            </Link>
            <Link to="/admin/tickets?late=true" className="tile-link">
              <Tile label={`⏱ ${t('En retard', 'Overdue')}`} value={String(d.kpis.late)} hint={t('maintenant', 'right now')} tone="late" />
            </Link>
          </div>

          {/* US-28 : compteurs par statut */}
          <section className="card status-strip" aria-label={t('Tickets par statut', 'Tickets by status')}>
            <h2>{t('Par statut', 'By status')}</h2>
            <ul>
              {INCIDENT_STATUSES.map((s) => (
                <li key={s}>
                  <Link to={`/admin/tickets?status=${s}`}>
                    <span className={`badge badge--${s.toLowerCase()}`}>{label(STATUS_LABELS[s])}</span>
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

            {/* US-33 */}
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
                        <td>{a.critical > 0 ? <span className="badge badge--prio-critique">⚠ {a.critical}</span> : 0}</td>
                        <td>{a.late > 0 ? <span className="badge badge--late">{a.late}</span> : 0}</td>
                        <td>{a.resolved}</td>
                        <td>{formatHours(a.avgResolutionHours, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>

            {/* US-32 */}
            <section className="card">
              <h2>{t('Assistant IA', 'AI assistant')}</h2>
              <p className="muted chart-card__sub">{t('Statistiques agrégées, sans le contenu des questions.', 'Aggregated statistics, without question content.')}</p>
              <div className="tiles tiles--small">
                <Tile label={t('Questions', 'Questions')} value={String(d.assistant.questions)} />
                <Tile label={t('Résolues par l’IA', 'Solved by AI')} value={formatPercent(d.assistant.aiResolvedRate, lang)} />
                <Tile label="👍 / 👎" value={`${d.assistant.thumbsUp} / ${d.assistant.thumbsDown}`} />
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
