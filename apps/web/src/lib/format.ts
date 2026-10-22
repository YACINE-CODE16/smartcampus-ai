import type { Lang } from '@smartcampus/shared';

const TZ = 'Europe/Paris';
const locales: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

export function formatDateTime(iso: string, lang: Lang = 'fr'): string {
  return new Intl.DateTimeFormat(locales[lang], {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, lang: Lang = 'fr'): string {
  return new Intl.DateTimeFormat(locales[lang], { timeZone: TZ, day: 'numeric', month: 'short' }).format(new Date(iso));
}

/** « il y a 3 h » / « 3 h ago » */
export function formatAgo(iso: string, lang: Lang = 'fr', now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  const en = lang === 'en';
  if (min < 1) return en ? 'just now' : "à l'instant";
  if (min < 60) return en ? `${min} min ago` : `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return en ? `${h} h ago` : `il y a ${h} h`;
  const d = Math.round(h / 24);
  return en ? `${d} d ago` : `il y a ${d} j`;
}

/** Durée en heures lisible : « 12 h », « 2,5 j ». */
export function formatHours(hours: number | null, lang: Lang = 'fr'): string {
  if (hours === null || Number.isNaN(hours)) return '—';
  const nf = new Intl.NumberFormat(locales[lang], { maximumFractionDigits: 1 });
  if (hours < 48) return `${nf.format(hours)} h`;
  return `${nf.format(hours / 24)} ${lang === 'en' ? 'd' : 'j'}`;
}

export function formatPercent(ratio: number | null, lang: Lang = 'fr'): string {
  if (ratio === null || Number.isNaN(ratio)) return '—';
  return new Intl.NumberFormat(locales[lang], { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}
