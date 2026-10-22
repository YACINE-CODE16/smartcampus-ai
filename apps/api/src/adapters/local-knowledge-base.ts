import type { Lang } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { KnowledgeBase, Passage } from '../ports/knowledge-base';
import { containsPhrase, normalize, tokens } from './assistant-text';

const KEYWORD_WEIGHT = 3;
const MULTIWORD_KEYWORD_WEIGHT = 4;

/**
 * Base documentaire locale (US-24) : FAQ et documents en PostgreSQL, recherche par mots-clés.
 * Score = mots-clés de la FAQ trouvés dans la question (expression entière) + mots communs avec le titre.
 * Lecture à chaque requête : une FAQ modifiée par l'admin est utilisée immédiatement.
 */
export class LocalKnowledgeBase implements KnowledgeBase {
  readonly name = 'local';

  constructor(private readonly prisma: PrismaClient) {}

  async search(query: string, lang: Lang, limit: number): Promise<Passage[]> {
    const [faq, docs] = await Promise.all([this.prisma.faqEntry.findMany(), this.prisma.kbDocument.findMany()]);
    const q = normalize(query);
    const qTokens = new Set(tokens(query));
    const overlap = (text: string) => tokens(text).filter((t, i, all) => qTokens.has(t) && all.indexOf(t) === i).length;

    const passages: Passage[] = [];
    for (const f of faq) {
      const kw = f.keywords.reduce(
        (s, k) => s + (containsPhrase(q, k) ? (k.includes(' ') ? MULTIWORD_KEYWORD_WEIGHT : KEYWORD_WEIGHT) : 0),
        0,
      );
      const score = kw + overlap(`${f.question} ${f.questionEn ?? ''}`);
      if (score > 0) {
        const en = lang === 'en';
        passages.push({
          type: 'faq',
          id: f.id,
          title: en ? (f.questionEn ?? f.question) : f.question,
          content: en ? (f.answerEn ?? f.answer) : f.answer,
          score,
        });
      }
    }
    for (const d of docs) {
      const score = overlap(d.title) * 2 + Math.min(overlap(d.content), 4);
      if (score > 0) passages.push({ type: 'document', id: d.id, title: d.title, content: d.content, score });
    }
    return passages.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
