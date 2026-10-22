import { STATUS_LABELS, type IncidentStatus, type SuggestedTicket, type TriageSuggestion } from '@smartcampus/shared';
import type { AiAssistant, AssistantContext, AssistantReply, UserTicketContext } from '../ports/ai-assistant';
import {
  countPhrases,
  detectLocation,
  GREETING_WORDS,
  guessCategory,
  HIGH_URGENCY_WORDS,
  INTERVENTION_WORDS,
  LOW_URGENCY_WORDS,
  normalize,
  OUT_OF_SCOPE_WORDS,
  TICKET_STATUS_PHRASES,
  tokens,
} from './assistant-text';

/** Score minimal d'un passage pour répondre à partir de la base documentaire. */
const ANSWER_SCORE = 3;
/** Au-delà, la FAQ répond même si une intervention semble nécessaire (le ticket est alors proposé en plus). */
const STRONG_SCORE = 6;
const OPEN = new Set(['NOUVEAU', 'EN_COURS', 'RESOLU']);

/**
 * Assistant déterministe (AI_DRIVER=mock) : aucun appel externe, comportement prévisible pour la démo et les tests.
 * Ordre : hors périmètre → suivi de ticket → réponse documentaire → ticket pré-rempli.
 */
export class MockAiAssistant implements AiAssistant {
  readonly name = 'mock';

  async reply(message: string, ctx: AssistantContext): Promise<AssistantReply> {
    const en = ctx.lang === 'en';
    const n = normalize(message);

    // US-26 : sujets hors périmètre refusés, sans ticket proposé.
    if (countPhrases(n, OUT_OF_SCOPE_WORDS) > 0) return this.outOfScope(en);
    if (tokens(message).length <= 2 && countPhrases(n, GREETING_WORDS) > 0) {
      return {
        kind: 'out_of_scope',
        sources: [],
        answer: en
          ? 'Hello! I can answer questions about campus life (Wi-Fi, rooms, equipment, printing…), tell you where your tickets stand, and help you report an incident.'
          : 'Bonjour ! Je peux répondre à vos questions sur le campus (wifi, salles, matériel, impression…), vous dire où en sont vos tickets et vous aider à signaler un incident.',
      };
    }

    // US-22 : « où en est mon ticket ? »
    const ticketNo = /\bsc[\s-]?(\d{1,5})\b/i.exec(message);
    if (ticketNo || countPhrases(n, TICKET_STATUS_PHRASES) > 0) {
      return this.ticketStatus(ticketNo ? Number(ticketNo[1]) : null, ctx.userTickets, en);
    }

    const intervention = countPhrases(n, INTERVENTION_WORDS) > 0;
    const best = ctx.passages[0];

    // US-19 / US-20 : réponse tirée de la base documentaire, avec sa source.
    if (best && best.score >= ANSWER_SCORE && (!intervention || best.score >= STRONG_SCORE)) {
      return {
        kind: best.type,
        answer: best.content,
        sources: [{ type: best.type, id: best.id, title: best.title }],
        suggestedTicket: intervention ? this.suggest(message, ctx) : undefined,
      };
    }

    const campusRelated = intervention || guessCategory(message) !== null || (best?.score ?? 0) > 0;
    if (!campusRelated) return this.outOfScope(en);

    // US-21 : pas de réponse fiable ou intervention nécessaire → ticket pré-rempli.
    return {
      kind: 'needs_ticket',
      sources: [],
      answer: intervention
        ? en
          ? 'This needs an on-site intervention: I cannot fix it from here. I have prepared a report for you, check it and send it.'
          : 'Ce problème nécessite une intervention sur place : je ne peux pas le résoudre d’ici. Je vous ai préparé un signalement, vérifiez-le puis envoyez-le.'
        : en
          ? 'I could not find a reliable answer in the campus FAQ. I can prepare a report so the team can look into it.'
          : 'Je ne trouve pas de réponse fiable dans la FAQ du campus. Je peux vous préparer un signalement pour que l’équipe s’en occupe.',
      suggestedTicket: this.suggest(message, ctx),
    };
  }

  async suggestTriage(description: string): Promise<TriageSuggestion | null> {
    const categorySlug = guessCategory(description);
    if (!categorySlug) return null;
    const n = normalize(description);
    const urgency =
      countPhrases(n, HIGH_URGENCY_WORDS) > 0 || categorySlug === 'securite' ? 'HAUTE' : countPhrases(n, LOW_URGENCY_WORDS) > 0 ? 'FAIBLE' : 'NORMALE';
    return { categorySlug, urgency };
  }

  private suggest(message: string, ctx: AssistantContext): SuggestedTicket {
    const location = detectLocation(message);
    const knownBuilding = ctx.buildings.some((b) => b.code === location.buildingCode);
    return {
      categorySlug: guessCategory(message) ?? 'autre',
      buildingCode: knownBuilding ? location.buildingCode : undefined,
      room: knownBuilding ? location.room : undefined,
      description: message.trim(),
    };
  }

  private outOfScope(en: boolean): AssistantReply {
    return {
      kind: 'out_of_scope',
      sources: [],
      answer: en
        ? 'Sorry, I can only help with campus questions (facilities, equipment, network, safety) and your own tickets.'
        : 'Désolé, je ne traite que les questions sur le campus (locaux, matériel, réseau, sécurité) et vos propres tickets.',
    };
  }

  private ticketStatus(number: number | null, tickets: UserTicketContext[], en: boolean): AssistantReply {
    const lang = en ? 'en' : 'fr';
    const status = (s: string) => (s in STATUS_LABELS ? STATUS_LABELS[s as IncidentStatus][lang] : s);
    const describe = (t: UserTicketContext) =>
      en
        ? `${t.ticketNumber} “${t.title}” is ${status(t.status).toLowerCase()}${t.assignedTo ? `, handled by ${t.assignedTo}` : ', not assigned yet'}.`
        : `${t.ticketNumber} « ${t.title} » est ${status(t.status).toLowerCase()}${t.assignedTo ? `, suivi par ${t.assignedTo}` : ', pas encore affecté'}.`;

    if (number !== null) {
      const t = tickets.find((x) => Number(x.ticketNumber.replace(/^SC-/, '')) === number);
      const label = `SC-${String(number).padStart(4, '0')}`;
      if (!t) {
        return {
          kind: 'ticket_status',
          sources: [],
          answer: en ? `I cannot find ticket ${label} among your reports.` : `Je ne trouve pas le ticket ${label} parmi vos signalements.`,
        };
      }
      return { kind: 'ticket_status', sources: [], answer: describe(t), tickets: [{ id: t.id, ticketNumber: t.ticketNumber }] };
    }

    const open = tickets.filter((t) => OPEN.has(t.status)).slice(0, 5);
    if (open.length === 0) {
      return { kind: 'ticket_status', sources: [], answer: en ? 'You have no open tickets.' : 'Vous n’avez aucun ticket en cours.' };
    }
    const intro = en ? `You have ${open.length} open ticket(s):` : `Vous avez ${open.length} ticket(s) en cours :`;
    return {
      kind: 'ticket_status',
      sources: [],
      answer: [intro, ...open.map((t) => `• ${describe(t)}`)].join('\n'),
      tickets: open.map((t) => ({ id: t.id, ticketNumber: t.ticketNumber })),
    };
  }
}

