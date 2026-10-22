import {
  detectLanguage,
  formatTicketNumber,
  SETTINGS,
  type AssistantMessageInput,
  type AssistantReplyDto,
  type SessionUser,
  type TriageSuggestion,
} from '@smartcampus/shared';
import type { PrismaClient } from '../../db';
import { NotFoundError } from '../../domain/errors';
import type { AiAssistant, AssistantContext, AssistantReply } from '../../ports/ai-assistant';
import type { KnowledgeBase } from '../../ports/knowledge-base';

const PASSAGES = 4;
const USER_TICKETS = 10;

/**
 * US-19 à US-26. Le contexte est construit côté serveur à partir de l'utilisateur connecté :
 * FAQ/documents + SES 10 derniers tickets, jamais ceux d'un autre. Le texte des questions n'est pas stocké (D20).
 */
export class AssistantService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly kb: KnowledgeBase,
    private readonly ai: AiAssistant,
    /** Repli si l'assistant principal (Bedrock) échoue. */
    private readonly fallback: AiAssistant,
  ) {}

  private async referentials() {
    const [categories, buildings] = await Promise.all([
      this.prisma.category.findMany({ where: { active: true }, orderBy: { order: 'asc' }, select: { slug: true, label: true, labelEn: true } }),
      this.prisma.building.findMany({ orderBy: { order: 'asc' }, select: { code: true, name: true } }),
    ]);
    return { categories, buildings };
  }

  async ask(user: SessionUser, message: string, history: AssistantMessageInput[]): Promise<AssistantReplyDto> {
    const lang = detectLanguage(message, user.locale);
    const [passages, tickets, refs] = await Promise.all([
      this.kb.search(message, lang, PASSAGES).catch((err: unknown) => {
        console.error('[assistant] recherche documentaire en échec :', err);
        return [];
      }),
      this.prisma.incident.findMany({
        where: { ownerId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: USER_TICKETS,
        select: { id: true, number: true, title: true, status: true, updatedAt: true, assignedTo: { select: { name: true } } },
      }),
      this.referentials(),
    ]);

    const context: AssistantContext = {
      lang,
      passages,
      history: history.slice(-6),
      userTickets: tickets.map((t) => ({
        id: t.id,
        ticketNumber: formatTicketNumber(t.number),
        title: t.title,
        status: t.status,
        assignedTo: t.assignedTo?.name ?? null,
        updatedAt: t.updatedAt.toISOString(),
      })),
      ...refs,
    };

    let reply: AssistantReply;
    try {
      reply = await this.ai.reply(message, context);
    } catch (err) {
      console.error(`[assistant] ${this.ai.name} en échec, repli sur ${this.fallback.name} :`, err instanceof Error ? err.message : err);
      reply = await this.fallback.reply(message, context);
    }

    const interaction = await this.prisma.assistantInteraction.create({
      data: { userId: user.id, language: lang, kind: reply.kind, sources: reply.sources.map((s) => ({ ...s })) },
    });
    return { interactionId: interaction.id, language: lang, ...reply };
  }

  /** US-23 : 👍 / 👎 sur une réponse, modifiable ; `null` retire l'avis. */
  async feedback(user: SessionUser, interactionId: string, helpful: boolean | null): Promise<void> {
    const { count } = await this.prisma.assistantInteraction.updateMany({
      where: { id: interactionId, userId: user.id },
      data: { feedback: helpful === null ? null : helpful ? 'UP' : 'DOWN' },
    });
    if (count === 0) throw new NotFoundError();
  }

  /** US-25 : suggestion de catégorie et d'urgence pour un nouveau ticket. */
  async triage(user: SessionUser, description: string): Promise<TriageSuggestion | null> {
    if (description.trim().length < SETTINGS.triageMinChars) return null;
    const { categories } = await this.referentials();
    const ctx = { categories, lang: detectLanguage(description, user.locale) };
    let suggestion: TriageSuggestion | null;
    try {
      suggestion = await this.ai.suggestTriage(description, ctx);
    } catch (err) {
      console.error('[assistant] suggestion en échec, repli :', err instanceof Error ? err.message : err);
      suggestion = await this.fallback.suggestTriage(description, ctx);
    }
    return suggestion && categories.some((c) => c.slug === suggestion.categorySlug) ? suggestion : null;
  }
}
