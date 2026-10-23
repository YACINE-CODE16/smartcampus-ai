import { BedrockRuntimeClient, ConverseCommand, type GuardrailConfiguration } from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';
import { ASSISTANT_KINDS, URGENCIES, type TriageSuggestion } from '@smartcampus/shared';
import type { AiAssistant, AssistantContext, AssistantReply } from '../ports/ai-assistant';
import { systemPrompt, triagePrompt } from '../services/assistant/system-prompt';

const replySchema = z.object({
  kind: z.enum(ASSISTANT_KINDS),
  answer: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
  ticketNumbers: z.array(z.string()).default([]),
  suggestedTicket: z
    .object({ categorySlug: z.string(), buildingCode: z.string().optional(), room: z.string().optional(), description: z.string() })
    .optional(),
});

/** Extrait le premier objet JSON d'une réponse de modèle (tolère un éventuel bloc de code). */
function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Réponse du modèle sans JSON');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Amazon Bedrock (AI_DRIVER=bedrock) : API Converse, modèle BEDROCK_MODEL_ID (Nova Lite par défaut),
 * Guardrails si BEDROCK_GUARDRAIL_ID est défini (US-26). Toute erreur remonte : le service bascule sur le mock.
 */
export class BedrockAiAssistant implements AiAssistant {
  readonly name = 'bedrock';
  private readonly client: BedrockRuntimeClient;
  private readonly guardrail?: GuardrailConfiguration;

  constructor(
    private readonly modelId: string,
    region: string,
    guardrailId?: string,
    guardrailVersion = 'DRAFT',
  ) {
    // Délais courts : sans réponse (Lambda sans NAT, modèle non activé…), repli sur le mock bien avant les 30 s d'API Gateway.
    this.client = new BedrockRuntimeClient({ region, maxAttempts: 1, requestHandler: { connectionTimeout: 3_000, requestTimeout: 15_000 } });
    if (guardrailId) this.guardrail = { guardrailIdentifier: guardrailId, guardrailVersion, trace: 'disabled' };
  }

  private async converse(system: string, user: string, history: AssistantContext['history'] = []): Promise<{ text: string; blocked: boolean }> {
    const res = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: system }],
        messages: [
          ...history.slice(-6).map((m) => ({ role: m.role, content: [{ text: m.content }] })),
          { role: 'user', content: [{ text: user }] },
        ],
        inferenceConfig: { maxTokens: 700, temperature: 0.2 },
        guardrailConfig: this.guardrail,
      }),
    );
    const text = res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
    return { text, blocked: res.stopReason === 'guardrail_intervened' };
  }

  async reply(message: string, ctx: AssistantContext): Promise<AssistantReply> {
    const payload = {
      CATEGORIES: ctx.categories.map((c) => c.slug),
      BUILDINGS: ctx.buildings,
      PASSAGES: ctx.passages.map((p) => ({ id: p.id, type: p.type, title: p.title, content: p.content })),
      USER_TICKETS: ctx.userTickets,
      QUESTION: message,
    };
    const { text, blocked } = await this.converse(systemPrompt(ctx.lang), JSON.stringify(payload), ctx.history);
    if (blocked) {
      return {
        kind: 'out_of_scope',
        sources: [],
        answer: ctx.lang === 'en' ? 'Sorry, I cannot help with that request.' : 'Désolé, je ne peux pas traiter cette demande.',
      };
    }
    const out = replySchema.parse(parseJson(text));
    const sources = ctx.passages.filter((p) => out.sourceIds.includes(p.id)).map((p) => ({ type: p.type, id: p.id, title: p.title }));
    const tickets = ctx.userTickets.filter((t) => out.ticketNumbers.includes(t.ticketNumber)).map((t) => ({ id: t.id, ticketNumber: t.ticketNumber }));
    // Une réponse documentaire sans source vérifiable n'est pas présentée comme fondée (US-20).
    const kind = (out.kind === 'faq' || out.kind === 'document') && sources.length === 0 ? 'needs_ticket' : out.kind;
    return { kind, answer: out.answer, sources, tickets, suggestedTicket: out.suggestedTicket };
  }

  async suggestTriage(description: string, ctx: Pick<AssistantContext, 'categories' | 'lang'>): Promise<TriageSuggestion | null> {
    const slugs = ctx.categories.map((c) => c.slug);
    const { text } = await this.converse(triagePrompt(slugs), description);
    const out = z.object({ categorySlug: z.enum(slugs as [string, ...string[]]), urgency: z.enum(URGENCIES) }).parse(parseJson(text));
    return out;
  }
}
