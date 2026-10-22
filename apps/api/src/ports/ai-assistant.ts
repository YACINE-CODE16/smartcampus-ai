import type { AssistantKind, AssistantSource, CategoryDto, Lang, SuggestedTicket, TriageSuggestion } from '@smartcampus/shared';
import type { Passage } from './knowledge-base';

/** Ticket de l'utilisateur connecté, tel que fourni à l'assistant (jamais ceux des autres). */
export interface UserTicketContext {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  assignedTo: string | null;
  updatedAt: string;
}

export interface AssistantContext {
  lang: Lang;
  passages: Passage[];
  userTickets: UserTicketContext[];
  history: { role: 'user' | 'assistant'; content: string }[];
  categories: Pick<CategoryDto, 'slug' | 'label' | 'labelEn'>[];
  buildings: { code: string; name: string }[];
}

export interface AssistantReply {
  kind: AssistantKind;
  answer: string;
  sources: AssistantSource[];
  suggestedTicket?: SuggestedTicket;
  tickets?: { id: string; ticketNumber: string }[];
}

/**
 * Génération des réponses (US-19 à US-26) et suggestion de qualification (US-25).
 * - `mock` : déterministe (intentions + mots-clés), sans appel externe.
 * - `bedrock` : API Converse (Nova Lite par défaut) + Guardrails.
 */
export interface AiAssistant {
  readonly name: string;
  reply(message: string, context: AssistantContext): Promise<AssistantReply>;
  suggestTriage(description: string, context: Pick<AssistantContext, 'categories' | 'lang'>): Promise<TriageSuggestion | null>;
}
