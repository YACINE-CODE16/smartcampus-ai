/** Bloc a : traitement agent/admin (US-13 à US-18) et notifications (US-10). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AlertsResponse, CategoryDto, IncidentDetail, InternalNoteDto, NotificationList } from '@smartcampus/shared';
import { checkOverdue } from '../src/jobs/overdue';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.stop());

const notificationsOf = (userId: string, incidentId: string) =>
  api.container.prisma.notification.findMany({ where: { userId, incidentId }, orderBy: { createdAt: 'asc' } });

describe('US-14 prise en charge et transitions', () => {
  it('un seul agent peut prendre un ticket non affecté (écriture conditionnelle)', async () => {
    const t = await api.createTicket('alice');
    const [a, b] = await Promise.all([api.post('karim', `/incidents/${t.id}/take`, {}), api.post('julie', `/incidents/${t.id}/take`, {})]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const detail = await api.json<IncidentDetail>('alice', `/incidents/${t.id}`);
    expect(detail.status).toBe('EN_COURS');
    expect(detail.takenAt).not.toBeNull();
  });

  it('refuse NOUVEAU → RESOLU (409) puis résout depuis EN_COURS et notifie l’étudiant (US-10)', async () => {
    const t = await api.createTicket('alice');
    await api.post('claire', `/incidents/${t.id}/assign`, { agentId: api.ids.karim });
    expect((await api.post('karim', `/incidents/${t.id}/transition`, { to: 'RESOLU' })).status).toBe(409);
    expect((await api.post('karim', `/incidents/${t.id}/transition`, { to: 'EN_COURS', comment: 'Technicien en route' })).status).toBe(200);
    expect((await api.post('karim', `/incidents/${t.id}/transition`, { to: 'RESOLU' })).status).toBe(200);

    const detail = await api.json<IncidentDetail>('alice', `/incidents/${t.id}`);
    expect(detail.events.map((e) => e.toStatus)).toEqual(['NOUVEAU', 'NOUVEAU', 'EN_COURS', 'RESOLU']);
    expect(detail.events[2]!.comment).toBe('Technicien en route');
    const notes = await notificationsOf(api.ids.alice, t.id);
    expect(notes.map((n) => n.type)).toEqual(['STATUS_CHANGED', 'STATUS_CHANGED']);
  });

  it('un agent ne peut pas agir sur le ticket d’un collègue', async () => {
    const t = await api.createTicket('alice');
    await api.post('karim', `/incidents/${t.id}/take`, {});
    expect((await api.post('julie', `/incidents/${t.id}/transition`, { to: 'RESOLU' })).status).toBe(404);
  });
});

describe('US-13 affectation', () => {
  it('l’admin affecte, l’agent est notifié, l’historique trace l’affectation sans changer le statut', async () => {
    const t = await api.createTicket('alice');
    const res = await api.post('claire', `/incidents/${t.id}/assign`, { agentId: api.ids.julie });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as IncidentDetail;
    expect(detail.status).toBe('NOUVEAU');
    expect(detail.assignedTo?.id).toBe(api.ids.julie);
    expect(detail.events.at(-1)!.type).toBe('ASSIGN');
    expect((await notificationsOf(api.ids.julie, t.id))[0]!.type).toBe('ASSIGNED');
  });

  it('403 pour un agent, 400 pour un utilisateur qui n’est pas agent', async () => {
    const t = await api.createTicket('alice');
    expect((await api.post('karim', `/incidents/${t.id}/assign`, { agentId: api.ids.karim })).status).toBe(403);
    expect((await api.post('claire', `/incidents/${t.id}/assign`, { agentId: api.ids.bob })).status).toBe(400);
  });
});

describe('US-15 notes internes', () => {
  it('visibles par agents et admins, jamais par l’étudiant', async () => {
    const t = await api.createTicket('alice');
    await api.post('karim', `/incidents/${t.id}/take`, {});
    expect((await api.post('karim', `/incidents/${t.id}/notes`, { body: 'Pièce commandée, livraison jeudi' })).status).toBe(201);
    const notes = await api.json<InternalNoteDto[]>('claire', `/incidents/${t.id}/notes`);
    expect(notes.map((n) => n.body)).toEqual(['Pièce commandée, livraison jeudi']);
    expect((await api.call('alice', `/incidents/${t.id}/notes`)).status).toBe(404);
    expect((await api.post('alice', `/incidents/${t.id}/notes`, { body: 'x' })).status).toBe(403);
    expect(JSON.stringify(await api.json('alice', `/incidents/${t.id}`))).not.toContain('Pièce commandée');
  });
});

describe('US-16 requalification', () => {
  it('passer en Sécurité rend le ticket CRITIQUE et alerte les admins (R3)', async () => {
    const t = await api.createTicket('alice', { slug: 'autre', urgency: 'NORMALE' });
    await api.post('karim', `/incidents/${t.id}/take`, {});
    const refs = await api.json<{ categories: CategoryDto[] }>('karim', '/incidents/referentials');
    const res = await api.call('karim', `/incidents/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categoryId: refs.categories.find((c) => c.slug === 'securite')!.id }),
    });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as IncidentDetail;
    expect(detail.priority).toBe('CRITIQUE');
    expect(detail.title).toMatch(/^Sécurité/);
    expect(detail.events.at(-1)!.type).toBe('UPDATE');
    expect((await notificationsOf(api.ids.claire, t.id)).map((n) => n.type)).toContain('CRITICAL_CREATED');
  });

  it('un ticket Sécurité créé par un étudiant alerte immédiatement les admins', async () => {
    const t = await api.createTicket('alice', { slug: 'securite', urgency: 'FAIBLE' });
    expect(t.priority).toBe('CRITIQUE');
    const alerts = await api.json<AlertsResponse>('claire', '/sla/alerts');
    expect(alerts.critical.map((x) => x.id)).toContain(t.id);
  });
});

describe('US-17 rejet et fusion', () => {
  it('rejet : motif obligatoire, étudiant notifié, audit REJECT', async () => {
    const t = await api.createTicket('alice');
    await api.post('karim', `/incidents/${t.id}/take`, {});
    expect((await api.post('karim', `/incidents/${t.id}/transition`, { to: 'REJETE' })).status).toBe(400);
    const res = await api.post('karim', `/incidents/${t.id}/transition`, { to: 'REJETE', reason: 'Hors périmètre : scolarité' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as IncidentDetail).rejectionReason).toBe('Hors périmètre : scolarité');
    expect((await notificationsOf(api.ids.alice, t.id)).at(-1)!.type).toBe('REJECTED');
    expect(await api.container.prisma.auditLog.count({ where: { action: 'REJECT', targetId: t.id } })).toBe(1);
  });

  it('fusion : le doublon passe REJETE « Doublon de SC-x », les deux historiques le mentionnent', async () => {
    const main = await api.createTicket('alice');
    const dup = await api.createTicket('bob');
    const res = await api.post('claire', `/incidents/${dup.id}/merge`, { target: main.ticketNumber });
    expect(res.status).toBe(200);
    const d = (await res.json()) as IncidentDetail;
    expect(d.status).toBe('REJETE');
    expect(d.mergedInto?.ticketNumber).toBe(main.ticketNumber);
    const m = await api.json<IncidentDetail>('claire', `/incidents/${main.id}`);
    expect(m.events.at(-1)!.type).toBe('MERGE');
    expect((await notificationsOf(api.ids.bob, dup.id)).at(-1)!.type).toBe('MERGED');
    expect(await api.container.prisma.auditLog.count({ where: { action: 'MERGE', targetId: dup.id } })).toBe(1);
    // Fusion dans soi-même ou dans un ticket clos impossible
    expect((await api.post('claire', `/incidents/${main.id}/merge`, { target: main.ticketNumber })).status).toBe(409);
    expect((await api.post('claire', `/incidents/${main.id}/merge`, { target: dup.ticketNumber })).status).toBe(409);
  });
});

describe('US-11 / US-12 côté étudiant', () => {
  it('contestation : commentaire obligatoire, réouverture comptée, agent notifié ; puis note unique', async () => {
    const t = await api.createTicket('alice');
    await api.post('karim', `/incidents/${t.id}/take`, {});
    await api.post('karim', `/incidents/${t.id}/transition`, { to: 'RESOLU' });
    expect((await api.post('alice', `/incidents/${t.id}/transition`, { to: 'EN_COURS' })).status).toBe(400);
    const res = await api.post('alice', `/incidents/${t.id}/transition`, { to: 'EN_COURS', comment: 'Toujours en panne' });
    expect(((await res.json()) as IncidentDetail).reopenCount).toBe(1);
    expect((await notificationsOf(api.ids.karim, t.id)).map((n) => n.type)).toContain('REOPENED');

    expect((await api.post('alice', `/incidents/${t.id}/rating`, { score: 4 })).status).toBe(409); // pas encore résolu
    await api.post('karim', `/incidents/${t.id}/transition`, { to: 'RESOLU' });
    await api.post('alice', `/incidents/${t.id}/transition`, { to: 'FERME' });
    expect((await api.post('bob', `/incidents/${t.id}/rating`, { score: 5 })).status).toBe(404);
    const rated = await api.post('alice', `/incidents/${t.id}/rating`, { score: 4, comment: 'Rapide' });
    expect(rated.status).toBe(201);
    expect(((await rated.json()) as IncidentDetail).rating).toMatchObject({ score: 4, comment: 'Rapide' });
    expect((await api.post('alice', `/incidents/${t.id}/rating`, { score: 5 })).status).toBe(409);
  });
});

describe('US-18 délais cibles', () => {
  it('ticket au-delà du délai de sa catégorie : en retard, étudiant notifié une seule fois, alerte admin', async () => {
    const t = await api.createTicket('alice', { slug: 'reseau' });
    await api.container.prisma.incident.update({ where: { id: t.id }, data: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    expect(await checkOverdue(api.container)).toBeGreaterThanOrEqual(1);
    expect(await checkOverdue(api.container)).toBe(0);
    expect((await notificationsOf(api.ids.alice, t.id)).map((n) => n.type)).toEqual(['OVERDUE']);
    const alerts = await api.json<AlertsResponse>('claire', '/sla/alerts');
    expect(alerts.late.map((x) => x.id)).toContain(t.id);
  });

  it('l’admin règle le délai par catégorie (1–720 h) ; refusé aux agents', async () => {
    const cats = await api.json<CategoryDto[]>('claire', '/sla/categories');
    const reseau = cats.find((c) => c.slug === 'reseau')!;
    const patch = (who: 'claire' | 'karim', targetHours: number) =>
      api.call(who, `/sla/categories/${reseau.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetHours }),
      });
    expect((await patch('karim', 12)).status).toBe(403);
    expect((await patch('claire', 0)).status).toBe(400);
    expect(((await (await patch('claire', 12)).json()) as CategoryDto).targetHours).toBe(12);
    await patch('claire', reseau.targetHours);
  });
});

describe('US-10 notifications', () => {
  it('liste, compteur et marquage comme lues', async () => {
    const before = await api.json<NotificationList>('alice', '/notifications');
    expect(before.unread).toBeGreaterThan(0);
    const after = await (await api.post('alice', '/notifications/read-all', {})).json();
    expect(after).toEqual({ unread: 0 });
  });

  it('messages d’erreur en anglais avec Accept-Language: en (US-38)', async () => {
    const t = await api.createTicket('alice');
    const res = await api.call('karim', `/incidents/${t.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept-language': 'en' },
      body: JSON.stringify({ to: 'RESOLU' }),
    });
    expect(((await res.json()) as { message: string }).message).toBe('Transition not allowed.');
  });
});
