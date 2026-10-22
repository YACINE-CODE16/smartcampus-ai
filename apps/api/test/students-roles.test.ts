/** Bloc d : rôles (US-02), doublons (US-06), confirmation / notation (US-11, US-12), notifications (US-10). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IncidentDetail, NotificationList } from '@smartcampus/shared';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.stop());

const setRole = (who: 'claire' | 'karim', userId: string, role: string) =>
  api.call(who, `/admin/users/${userId}/role`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) });

describe('US-02 attribution des rôles', () => {
  it('l’admin promeut un étudiant ; effet immédiat ; audit ROLE_CHANGE', async () => {
    expect((await api.call('bob', '/agents')).status).toBe(403);
    const res = await setRole('claire', api.ids.bob, 'AGENT');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { role: string }).role).toBe('AGENT');
    // même session, rôle relu en base : Bob accède maintenant à la file des agents
    expect((await api.call('bob', '/incidents?scope=unassigned')).status).toBe(200);
    expect((await api.post('bob', '/assistant/ask', { message: 'wifi ?' })).status).toBe(403);
    const audit = await api.container.prisma.auditLog.findFirst({ where: { action: 'ROLE_CHANGE', targetId: api.ids.bob }, orderBy: { createdAt: 'desc' } });
    expect(audit?.details).toMatchObject({ from: 'STUDENT', to: 'AGENT' });
    expect((await setRole('claire', api.ids.bob, 'STUDENT')).status).toBe(200);
  });

  it('interdit sur soi-même (409), pour un non-admin (403), et sur un agent ayant des tickets ouverts (409)', async () => {
    expect((await setRole('claire', api.ids.claire, 'STUDENT')).status).toBe(409);
    expect((await setRole('karim', api.ids.bob, 'ADMIN')).status).toBe(403);
    const res = await setRole('claire', api.ids.karim, 'STUDENT');
    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toMatch(/Réaffectez/);
  });

  it('recherche par nom ou email', async () => {
    const rows = await api.json<{ email: string }[]>('claire', '/admin/users?q=durand');
    expect(rows.map((r) => r.email)).toEqual(['bob.durand@esiea.fr']);
  });
});

describe('US-06 incident similaire', () => {
  it('liste les tickets ouverts même catégorie + même bâtiment, sans description ni auteur', async () => {
    const t = await api.createTicket('bob', { slug: 'proprete', buildingIndex: 4 });
    const refs = await api.json<{ categories: { id: string; slug: string }[]; buildings: { id: string }[] }>('alice', '/referentials');
    const cat = refs.categories.find((c) => c.slug === 'proprete')!.id;
    const res = await api.call('alice', `/incidents/similar?categoryId=${cat}&buildingId=${refs.buildings[4]!.id}`);
    const items = (await res.json()) as Record<string, unknown>[];
    expect(items.map((i) => i.ticketNumber)).toContain(t.ticketNumber);
    expect(Object.keys(items[0]!).sort()).toEqual(['createdAt', 'status', 'ticketNumber', 'title']);
  });
});

describe('US-11 confirmation et US-10 notifications', () => {
  it('l’étudiant confirme : FERME ; notification lue individuellement', async () => {
    const t = await api.createTicket('alice');
    await api.post('karim', `/incidents/${t.id}/take`, {});
    await api.post('karim', `/incidents/${t.id}/transition`, { to: 'RESOLU' });
    const list = await api.json<NotificationList>('alice', '/notifications');
    const n = list.items.find((x) => x.incidentId === t.id && !x.read)!;
    expect(n.params).toMatchObject({ ticket: t.ticketNumber, to: 'RESOLU' });
    const after = (await (await api.post('alice', `/notifications/${n.id}/read`, {})).json()) as { unread: number };
    expect(after.unread).toBe(list.unread - 1);

    const res = await api.post('alice', `/incidents/${t.id}/transition`, { to: 'FERME' });
    const detail = (await res.json()) as IncidentDetail;
    expect(detail.status).toBe('FERME');
    expect(detail.closedAt).not.toBeNull();
    // l'étudiant ne peut plus agir sur un ticket fermé
    expect((await api.post('alice', `/incidents/${t.id}/transition`, { to: 'EN_COURS', comment: 'x' })).status).toBe(409);
  });
});
