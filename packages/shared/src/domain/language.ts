import type { Lang } from '../config/i18n';

const EN_WORDS = new Set([
  'the', 'is', 'are', 'my', 'what', 'where', 'how', 'when', 'why', 'not', 'does', 'do', "doesn't", "don't", 'can',
  'i', 'it', 'to', 'in', 'of', 'and', 'with', 'for', 'room', 'broken', 'working', 'ticket', 'please', 'help', 'status',
]);
const FR_WORDS = new Set([
  'le', 'la', 'les', 'est', 'mon', 'ma', 'mes', 'quoi', 'où', 'comment', 'quand', 'pourquoi', 'ne', 'pas', 'je', 'il',
  'de', 'du', 'des', 'et', 'avec', 'pour', 'salle', 'cassé', 'marche', 'ticket', 'signalement', 'un', 'une', 'en',
]);

/**
 * US-38 : langue d'une question (heuristique sur les mots courants).
 * En cas d'égalité, on garde la langue de l'interface.
 */
export function detectLanguage(text: string, fallback: Lang = 'fr'): Lang {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿœ']+/g) ?? [];
  let en = 0;
  let fr = 0;
  for (const w of words) {
    if (EN_WORDS.has(w)) en++;
    if (FR_WORDS.has(w)) fr++;
  }
  if (/[àâçéèêëîïôûùœ]/.test(text)) fr++;
  if (en === fr) return fallback;
  return en > fr ? 'en' : 'fr';
}
