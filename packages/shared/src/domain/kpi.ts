import type { IncidentStatus } from '../config/statuses';

/** Champs nécessaires aux indicateurs (dates en ISO ou `Date`). */
export interface KpiTicket {
  status: IncidentStatus;
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  reopenCount: number;
}

const HOUR = 3_600_000;
const ms = (d: Date | string) => new Date(d).getTime();

/**
 * US-29 : délai moyen de résolution en heures = moyenne (dernière résolution − création)
 * des tickets résolus ou fermés (D6). `null` s'il n'y en a aucun.
 */
export function avgResolutionHours(tickets: KpiTicket[]): number | null {
  const done = tickets.filter((t) => (t.status === 'RESOLU' || t.status === 'FERME') && t.resolvedAt);
  if (done.length === 0) return null;
  return done.reduce((sum, t) => sum + (ms(t.resolvedAt!) - ms(t.createdAt)), 0) / done.length / HOUR;
}

/** US-29 : taux de résolution = (résolus + fermés) / tickets hors rejetés. */
export function resolutionRate(tickets: KpiTicket[]): number | null {
  const considered = tickets.filter((t) => t.status !== 'REJETE');
  if (considered.length === 0) return null;
  return considered.filter((t) => t.status === 'RESOLU' || t.status === 'FERME').length / considered.length;
}

/**
 * US-29 : taux de réouverture = tickets contestés au moins une fois / tickets ayant été résolus
 * (résolus aujourd'hui, ou contestés donc résolus auparavant).
 */
export function reopenRate(tickets: KpiTicket[]): number | null {
  const everResolved = tickets.filter((t) => t.resolvedAt !== null || t.reopenCount > 0);
  if (everResolved.length === 0) return null;
  return everResolved.filter((t) => t.reopenCount > 0).length / everResolved.length;
}

/** US-12 / US-29 : satisfaction moyenne (1–5). */
export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export const GRANULARITIES = ['day', 'week', 'month', 'year'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Date calendaire à Paris (les regroupements suivent l'heure locale du campus). */
function parisParts(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get('year'), m: get('month'), day: get('day') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Semaine ISO 8601 : `2026-W43`. */
function isoWeek(y: number, m: number, day: number): string {
  const date = new Date(Date.UTC(y, m - 1, day));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

/** US-31 : clé de regroupement d'une date selon la granularité. */
export function bucketKey(date: Date | string, g: Granularity): string {
  const { y, m, day } = parisParts(new Date(date));
  switch (g) {
    case 'day':
      return `${y}-${pad(m)}-${pad(day)}`;
    case 'week':
      return isoWeek(y, m, day);
    case 'month':
      return `${y}-${pad(m)}`;
    case 'year':
      return `${y}`;
  }
}

export interface SeriesPoint {
  bucket: string;
  created: number;
  resolved: number;
}

/**
 * US-31 : tickets créés et résolus par période, sans trou entre `from` et `to`.
 * Un ticket compte comme « résolu » à la date de sa (dernière) résolution.
 */
export function timeSeries(tickets: KpiTicket[], g: Granularity, from: Date, to: Date): SeriesPoint[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const k = bucketKey(new Date(t), g);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const lastKey = bucketKey(to, g);
  if (!seen.has(lastKey)) keys.push(lastKey);

  const points = new Map(keys.map((k) => [k, { bucket: k, created: 0, resolved: 0 }]));
  for (const t of tickets) {
    const c = points.get(bucketKey(t.createdAt, g));
    if (c) c.created++;
    if (t.resolvedAt) {
      const r = points.get(bucketKey(t.resolvedAt, g));
      if (r) r.resolved++;
    }
  }
  return [...points.values()];
}

/** Échange avec l'assistant (sans le texte de la question). */
export interface KpiInteraction {
  kind: string;
  feedback: 'UP' | 'DOWN' | null;
  createdIncidentId: string | null;
}

/** Réponses fondées sur des sources (FAQ, document, suivi de ticket). */
export const ANSWERED_KINDS = ['faq', 'document', 'ticket_status'] as const;

/**
 * US-32 : part des questions résolues par l'IA = réponses fondées, jugées utiles (👍) et sans
 * ticket créé ensuite / réponses ayant reçu un avis.
 */
export function aiResolvedRate(items: KpiInteraction[]): number | null {
  const rated = items.filter((i) => i.feedback !== null);
  if (rated.length === 0) return null;
  const solved = rated.filter(
    (i) => (ANSWERED_KINDS as readonly string[]).includes(i.kind) && i.feedback === 'UP' && i.createdIncidentId === null,
  );
  return solved.length / rated.length;
}
