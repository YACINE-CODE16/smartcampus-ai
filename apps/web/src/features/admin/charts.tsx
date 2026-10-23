import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '../../lib/i18n';

/**
 * Couleurs des séries tirées des tokens (DESIGN.md), validées en clair et en sombre par validate_palette.js.
 * Les textes restent en encre neutre ; seule la marque porte la couleur.
 */
const CHART = {
  series1: 'var(--chart-1)',
  series2: 'var(--chart-2)',
  grid: 'var(--chart-grid)',
  axis: 'var(--ink-2)',
  text: 'var(--ink)',
} as const;

const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-pop)', fontSize: 13 },
  cursor: { fill: 'var(--surface-2)' },
};

/** Carte de graphique : titre, graphique, puis tableau de données dépliable (accessibilité). */
export function ChartCard({ title, subtitle, table, children }: { title: string; subtitle?: string; table: ReactNode; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className="panel chart-card">
      <h2>{title}</h2>
      {subtitle && <p className="muted chart-card__sub">{subtitle}</p>}
      {children}
      <details className="chart-card__data">
        <summary>{t('Voir les données', 'Show data')}</summary>
        {table}
      </details>
    </section>
  );
}

/** Barres horizontales à une série (US-27 catégories, US-29 bâtiments) : valeur au bout de chaque barre. */
export function HBarChart({ data, valueLabel }: { data: { name: string; value: number }[]; valueLabel: string }) {
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div style={{ width: '100%', height }} role="img" aria-label={data.map((d) => `${d.name} : ${d.value}`).join(', ')}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fill: CHART.text, fontSize: 13 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, valueLabel]} />
          <Bar dataKey="value" fill={CHART.series1} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" fill={CHART.text} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** US-30 : évolution des tickets créés et résolus (deux séries, une seule échelle). */
export function TrendChart({ data, createdLabel, resolvedLabel }: { data: { bucket: string; created: number; resolved: number }[]; createdLabel: string; resolvedLabel: string }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="bucket" tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
          {/* Le texte de la légende reste en encre neutre ; seul le trait porte la couleur de la série. */}
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} formatter={(value: string) => <span style={{ color: CHART.text }}>{value}</span>} />
          <Line type="linear" dataKey="created" name={createdLabel} stroke={CHART.series1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="linear" dataKey="resolved" name={resolvedLabel} stroke={CHART.series2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
