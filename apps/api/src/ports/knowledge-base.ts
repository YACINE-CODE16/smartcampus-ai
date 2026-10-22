import type { Lang } from '@smartcampus/shared';

export interface Passage {
  type: 'faq' | 'document';
  id: string;
  /** Question de la FAQ ou titre du document, affiché comme source (US-20). */
  title: string;
  content: string;
  /** Pertinence relative ; comparable seulement au sein d'une même implémentation. */
  score: number;
}

/**
 * Base documentaire de l'assistant (US-19, US-20, US-24).
 * - `local` : FAQ et documents en PostgreSQL, recherche par mots-clés.
 * - `bedrock` : Amazon Bedrock Knowledge Base (API Retrieve), en complément de la FAQ.
 */
export interface KnowledgeBase {
  readonly name: string;
  search(query: string, lang: Lang, limit: number): Promise<Passage[]>;
}
