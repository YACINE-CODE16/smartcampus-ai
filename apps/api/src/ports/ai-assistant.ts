import type { AssistantMessage, Incident } from '@smartcampus/shared';

export interface KnowledgePassage {
  id: string;
  question: string;
  answer: string;
  score: number;
}

/**
 * Source de connaissances de l'assistant.
 * - MVP : FAQ JSON versionnée (`FaqJsonProvider`).
 * - plus tard : Bedrock Knowledge Base, sans changer l'assistant.
 */
export interface KnowledgeProvider {
  retrieve(query: string, limit?: number): Promise<KnowledgePassage[]>;
}

export interface AssistantContext {
  user: { id: string; name: string };
  /** Uniquement les incidents de l'utilisateur connecté (chargés côté serveur par son id). */
  userIncidents: Incident[];
  knowledge: KnowledgePassage[];
  history: AssistantMessage[];
}

export interface SuggestedIncident {
  categoryId?: string;
  description: string;
  building?: string;
  room?: string;
}

export interface AssistantReply {
  answer: string;
  /** false = l'assistant ne sait pas ; le front propose alors le signalement pré-rempli. */
  answeredFromSources: boolean;
  suggestedIncident?: SuggestedIncident;
}

/**
 * Génération des réponses de l'assistant.
 * - local : mock déterministe (correspondance mots-clés sur la FAQ et les incidents).
 * - aws (phase 9) : Amazon Bedrock, API Converse, modèle `BEDROCK_MODEL_ID`.
 */
export interface AiAssistant {
  readonly name: string;
  reply(message: string, context: AssistantContext): Promise<AssistantReply>;
}
