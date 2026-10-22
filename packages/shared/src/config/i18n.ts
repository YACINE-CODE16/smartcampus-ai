/** Langues de l'interface (US-38). */
export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export interface Bilingual {
  fr: string;
  en: string;
}

const SEP = '\u001f';

/**
 * Message bilingue transportable comme une simple chaîne (messages zod, erreurs métier).
 * `localize` choisit la langue au moment de répondre ; une chaîne simple est renvoyée telle quelle.
 */
export function bi(fr: string, en: string): string {
  return `${fr}${SEP}${en}`;
}

export function localize(message: string, lang: Lang): string {
  const i = message.indexOf(SEP);
  if (i < 0) return message;
  return lang === 'en' ? message.slice(i + 1) : message.slice(0, i);
}

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'en';
}
