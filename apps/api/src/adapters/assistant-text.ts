/** Outils de texte de l'assistant local : normalisation, mots-clés et lexique du campus (FR + EN). */

const STOPWORDS = new Set(
  `les des une est pas que qui quoi pour par sur dans avec mon mes ton tes son ses nos vos leur aux ces cet cette
  fais faire faut peux peut comment quand pourquoi elle ils nous vous ici plus tres bien tout tous
  the and for are but not you your can how what when where why with this that from have has does doesn its
  into out about there them they our was were will would could should`.split(/\s+/),
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ');
}

/** Mots significatifs (≥ 3 lettres, hors mots vides). */
export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Vrai si l'expression (normalisée) apparaît comme mot ou groupe de mots entier. */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  const p = normalize(phrase).trim();
  if (!p) return false;
  return ` ${normalizedText.replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${p.replace(/[^a-z0-9]+/g, ' ')} `);
}

export function countPhrases(normalizedText: string, phrases: readonly string[]): number {
  return phrases.filter((p) => containsPhrase(normalizedText, p)).length;
}

/** Mots-clés par catégorie (slug du seed) pour le ticket pré-rempli et la suggestion de qualification. */
export const CATEGORY_LEXICON: Record<string, readonly string[]> = {
  securite: [
    'securite', 'danger', 'dangereux', 'incendie', 'feu', 'fumee', 'eclairage', 'lumiere', 'extincteur', 'coupe feu', 'issue de secours',
    'blesse', 'electrique', 'tableau electrique', 'gaz', 'safety', 'hazard', 'fire', 'smoke', 'lighting', 'injured', 'electrical',
  ],
  salle: ['salle', 'porte', 'cle', 'fermee', 'ferme a cle', 'verrouille', 'reservee', 'acces', 'badge refuse', 'room', 'door', 'locked', 'key', 'booked'],
  materiel: [
    'videoprojecteur', 'projecteur', 'ordinateur', 'pc', 'poste', 'ecran', 'clavier', 'souris', 'chaise', 'table', 'mobilier', 'imprimante',
    'cable', 'hdmi', 'tableau blanc', 'projector', 'computer', 'screen', 'chair', 'desk', 'printer', 'keyboard',
  ],
  reseau: ['wifi', 'wi fi', 'eduroam', 'reseau', 'internet', 'connexion', 'ent', 'vpn', 'prise reseau', 'network', 'connection', 'login'],
  proprete: [
    'toilettes', 'wc', 'sanitaires', 'sale', 'proprete', 'poubelle', 'papier', 'savon', 'chauffage', 'froid', 'chaud', 'odeur', 'nettoyage',
    'toilet', 'restroom', 'dirty', 'heating', 'cold', 'smell', 'bin',
  ],
  autre: ['ascenseur', 'distributeur', 'fuite', 'plafond', 'lift', 'elevator', 'vending', 'leak', 'ceiling'],
};

/** Mots signalant qu'une intervention physique est nécessaire (US-21). */
export const INTERVENTION_WORDS = [
  'casse', 'cassee', 'casses', 'bloque', 'bloquee', 'coince', 'coincee', 'fuite', 'inonde', 'inondee', 'fumee', 'en panne', 'panne',
  'hors service', 'arrache', 'arrachee', 'ne ferme plus', 'broken', 'stuck', 'leak', 'leaking', 'flooded', 'smoke', 'out of order',
];

export const HIGH_URGENCY_WORDS = ['urgent', 'urgence', 'danger', 'dangereux', 'fumee', 'incendie', 'feu', 'inonde', 'blesse', 'gaz', 'urgent', 'fire', 'smoke', 'flooded', 'injured', 'emergency'];
export const LOW_URGENCY_WORDS = ['pas urgent', 'peu urgent', 'leger', 'petit', 'quand vous pouvez', 'not urgent', 'minor', 'small'];

/** Signaux de sujets hors périmètre (US-26). */
export const OUT_OF_SCOPE_WORDS = [
  'dissertation', 'devoir', 'devoirs', 'exercice', 'redige', 'redaction', 'poeme', 'blague', 'recette', 'meteo', 'politique', 'election',
  'bourse', 'crypto', 'bitcoin', 'capitale', 'traduis', 'code moi', 'homework', 'essay', 'poem', 'joke', 'recipe', 'weather', 'politics',
  'stock', 'write me', 'translate',
];

export const GREETING_WORDS = ['bonjour', 'salut', 'hello', 'hi', 'coucou', 'bonsoir', 'hey'];

/** « Où en est mon ticket ? » (US-22). */
export const TICKET_STATUS_PHRASES = [
  'ou en est', 'statut', 'mon ticket', 'mes tickets', 'mon signalement', 'mes signalements', 'avancement', 'suivi de',
  'where is my', 'status', 'my ticket', 'my tickets', 'my report', 'my reports', 'progress',
];

/** Lieux cités : code bâtiment + salle (« B204 », « salle A102 ») ou nom de lieu. */
export function detectLocation(text: string): { buildingCode?: string; room?: string } {
  const room = /\b([abc])\s?-?(\d{3})\b/i.exec(text);
  if (room) return { buildingCode: room[1]!.toUpperCase(), room: `${room[1]!.toUpperCase()}${room[2]}` };
  const n = normalize(text);
  if (/\b(bibliotheque|bu|library)\b/.test(n)) return { buildingCode: 'BIB' };
  if (/\b(restaurant|cantine|cafeteria|ru)\b/.test(n)) return { buildingCode: 'RU' };
  return {};
}

/** Catégorie la plus probable d'après le lexique, ou `null` sans indice. */
export function guessCategory(text: string): string | null {
  const n = normalize(text);
  let best: string | null = null;
  let bestScore = 0;
  for (const [slug, words] of Object.entries(CATEGORY_LEXICON)) {
    // La sécurité l'emporte à égalité : mieux vaut sur-alerter que sous-alerter.
    const score = countPhrases(n, words) + (slug === 'securite' ? 0.5 : 0);
    if (score > bestScore && score >= 1) {
      best = slug;
      bestScore = score;
    }
  }
  return best;
}
