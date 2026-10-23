/** Bloc c : assistant (US-19 à US-26). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantReplyDto, FaqEntryDto, IncidentSummary, TriageSuggestion } from '@smartcampus/shared';
import { MockAiAssistant } from '../src/adapters/mock-assistant';
import type { AiAssistant } from '../src/ports/ai-assistant';
import { AssistantService } from '../src/services/assistant/assistant-service';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.stop());

const ask = async (who: 'alice' | 'bob', message: string, lang?: 'en') => {
  const res = await api.call(who, '/assistant/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(lang ? { 'accept-language': lang } : {}) },
    body: JSON.stringify({ message }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as AssistantReplyDto;
};

describe('US-19 / US-20 réponse fondée sur la FAQ, avec sa source', () => {
  it('« le wifi ne marche pas, je fais quoi ? »', async () => {
    const r = await ask('alice', 'le wifi ne marche pas, je fais quoi ?');
    expect(r.kind).toBe('faq');
    expect(r.sources[0]).toMatchObject({ type: 'faq', title: 'Comment me connecter au wifi du campus ?' });
    expect(r.answer).toContain('eduroam');
    expect(r.suggestedTicket).toBeUndefined();
  });

  it('un document de la base documentaire peut servir de source', async () => {
    const r = await ask('alice', 'règlement des salles informatiques : peut-on manger ?');
    expect(r.kind).toBe('document');
    expect(r.sources[0]!.title).toBe('Règlement des salles informatiques');
  });
});

describe('US-21 ticket pré-rempli', () => {
  it('« la porte de la salle B204 est bloquée » → Salle, bâtiment B, salle B204', async () => {
    const r = await ask('alice', 'la porte de la salle B204 est bloquée');
    expect(r.kind).toBe('needs_ticket');
    expect(r.suggestedTicket).toEqual({ categorySlug: 'salle', buildingCode: 'B', room: 'B204', description: 'la porte de la salle B204 est bloquée' });
  });

  it('le ticket créé depuis l’assistant est rattaché à l’échange (US-31)', async () => {
    const r = await ask('alice', 'la porte de la salle B204 est bloquée');
    const refs = await api.json<{ categories: { id: string; slug: string }[]; buildings: { id: string; code: string }[] }>('alice', '/incidents/referentials');
    const form = new FormData();
    form.set('categoryId', refs.categories.find((c) => c.slug === 'salle')!.id);
    form.set('buildingId', refs.buildings.find((b) => b.code === 'B')!.id);
    form.set('room', 'B204');
    form.set('description', r.suggestedTicket!.description);
    form.set('assistantInteractionId', r.interactionId);
    const created = (await (await api.call('alice', '/incidents', { method: 'POST', body: form })).json()) as IncidentSummary;
    api.created.push(created.id);
    const interaction = await api.container.prisma.assistantInteraction.findUnique({ where: { id: r.interactionId } });
    expect(interaction?.createdIncidentId).toBe(created.id);
  });
});

describe('US-22 « où en est mon ticket ? »', () => {
  it('répond avec le statut réel de son ticket, et ne trouve pas celui d’un autre', async () => {
    const mine = await api.json<IncidentSummary[]>('alice', '/incidents');
    const t = mine.find((x) => x.assignedTo)!;
    const r = await ask('alice', `où en est mon ticket ${t.ticketNumber} ?`);
    expect(r.kind).toBe('ticket_status');
    expect(r.answer).toContain(t.ticketNumber);
    expect(r.answer).toContain(t.assignedTo!.name);
    expect(r.tickets).toEqual([{ id: t.id, ticketNumber: t.ticketNumber }]);

    const bobs = await api.json<IncidentSummary[]>('bob', '/incidents');
    const other = await ask('alice', `où en est le ticket ${bobs[0]!.ticketNumber} ?`);
    expect(other.answer).toContain('Je ne trouve pas');
    expect(other.answer).not.toContain(bobs[0]!.title);
  });

  it('sans numéro : résumé de ses tickets en cours uniquement', async () => {
    const r = await ask('bob', 'où en sont mes signalements ?');
    const bobs = await api.json<IncidentSummary[]>('bob', '/incidents');
    for (const ref of r.tickets ?? []) expect(bobs.map((b) => b.id)).toContain(ref.id);
  });
});

describe('US-26 périmètre', () => {
  it('refuse un sujet hors campus, sans proposer de ticket', async () => {
    const r = await ask('alice', 'écris-moi ma dissertation de philo');
    expect(r.kind).toBe('out_of_scope');
    expect(r.suggestedTicket).toBeUndefined();
    expect((await ask('alice', 'quelle est la capitale de l’Australie ?')).kind).toBe('out_of_scope');
  });

  it('réservé aux étudiants', async () => {
    expect((await api.post('karim', '/assistant/ask', { message: 'wifi ?' })).status).toBe(403);
  });
});

describe('US-38 langue de la question', () => {
  it('répond en anglais à une question en anglais', async () => {
    const r = await ask('alice', 'the wifi is not working in my room, what should I do?');
    expect(r.language).toBe('en');
    expect(r.sources[0]!.title).toBe('How do I connect to the campus Wi-Fi?');
    expect(r.answer).toContain('Connect to the');
  });
});

describe('US-23 feedback', () => {
  it('👍 enregistré, modifiable, et impossible sur l’échange d’un autre', async () => {
    const r = await ask('alice', 'comment imprimer sur le campus ?');
    expect((await api.post('alice', `/assistant/interactions/${r.interactionId}/feedback`, { helpful: true })).status).toBe(204);
    expect((await api.post('alice', `/assistant/interactions/${r.interactionId}/feedback`, { helpful: false })).status).toBe(204);
    const row = await api.container.prisma.assistantInteraction.findUnique({ where: { id: r.interactionId } });
    expect(row?.feedback).toBe('DOWN');
    expect((await api.post('bob', `/assistant/interactions/${r.interactionId}/feedback`, { helpful: true })).status).toBe(404);
  });

  it('le texte de la question n’est jamais stocké (D20)', async () => {
    const r = await ask('alice', 'question secrète sur le wifi 4815162342');
    const row = await api.container.prisma.assistantInteraction.findUnique({ where: { id: r.interactionId } });
    expect(JSON.stringify(row)).not.toContain('4815162342');
  });
});

describe('US-25 suggestion de qualification', () => {
  it('« fumée qui sort du tableau électrique » → Sécurité · Haute ; texte trop court → rien', async () => {
    const res = await api.post('alice', '/assistant/triage', { description: 'fumée qui sort du tableau électrique' });
    expect(((await res.json()) as { suggestion: TriageSuggestion }).suggestion).toEqual({ categorySlug: 'securite', urgency: 'HAUTE' });
    const short = await api.post('alice', '/assistant/triage', { description: 'wifi' });
    expect(await short.json()).toEqual({ suggestion: null });
  });
});

describe('US-24 base documentaire gérée par l’admin', () => {
  it('une FAQ ajoutée est utilisée immédiatement ; réservé à l’admin', async () => {
    expect((await api.post('karim', '/knowledge/faq', {})).status).toBe(403);
    const res = await api.post('claire', '/knowledge/faq', {
      question: 'Où garer mon vélo ?',
      answer: 'Un parking vélo couvert et sécurisé se trouve derrière le bâtiment B, accessible avec la carte étudiant.',
      keywords: ['vélo', 'parking vélo', 'garer'],
      topic: 'autre',
    });
    expect(res.status).toBe(201);
    const faq = (await res.json()) as FaqEntryDto;
    expect(faq.keywords).toContain('velo');
    const r = await ask('alice', 'où mettre mon vélo ?');
    expect(r.sources[0]?.title).toBe('Où garer mon vélo ?');
    expect((await api.call('claire', `/knowledge/faq/${faq.id}`, { method: 'DELETE' })).status).toBe(204);
  });
});

describe('repli si Bedrock échoue', () => {
  it('l’assistant principal en erreur → réponse du mock', async () => {
    const failing: AiAssistant = {
      name: 'bedrock',
      reply: () => Promise.reject(new Error('AccessDeniedException')),
      suggestTriage: () => Promise.reject(new Error('AccessDeniedException')),
    };
    const p = api.container.prisma;
    const service = new AssistantService(p, { name: 'none', search: async () => [] }, failing, new MockAiAssistant());
    const alice = (await p.user.findUniqueOrThrow({ where: { email: 'alice.martin@esiea.fr' } })) as { id: string; email: string; name: string; role: 'STUDENT' };
    const r = await service.ask({ ...alice, locale: 'fr' }, 'la porte de la salle A102 est bloquée', []);
    expect(r.kind).toBe('needs_ticket');
    expect(await service.triage({ ...alice, locale: 'fr' }, 'le wifi ne marche plus du tout')).toEqual({ categorySlug: 'reseau', urgency: 'NORMALE' });
  });
});
