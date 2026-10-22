/** Bloc e : suppression des données (US-34), sécurité (US-36), audit (US-37). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuditEntryDto, IncidentSummary, Referentials } from '@smartcampus/shared';
import { hashPassword } from '../src/adapters/password';
import { env } from '../src/config/env';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  api.container.loginLimiter.reset();
  await api.stop();
});

const base = () => {
  // URL de l'API de test, retrouvée via un appel factice.
  return api.call(null, '/health').then((r) => r.url.replace(/\/health$/, ''));
};

describe('US-36 sécurité', () => {
  it('en-têtes de sécurité sur chaque réponse', async () => {
    const res = await api.call(null, '/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('au-delà de 10 échecs de connexion, 429 même avec le bon mot de passe', async () => {
    api.container.loginLimiter.reset();
    const url = `${await base()}/auth/login`;
    const login = (password: string) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'alice.martin@esiea.fr', password }) });
    for (let i = 0; i < 10; i++) expect((await login('mauvais')).status).toBe(401);
    const blocked = await login(env.DEMO_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).not.toBeNull();
    api.container.loginLimiter.reset();
    expect((await login(env.DEMO_PASSWORD)).status).toBe(200);
  });
});

describe('US-34 suppression des données d’un étudiant', () => {
  it('anonymise le compte et ses contenus, conserve les tickets pour les statistiques, trace l’action sans l’email', async () => {
    const p = api.container.prisma;
    const email = `rgpd.test.${Date.now()}@esiea.fr`;
    const student = await p.user.create({ data: { email, name: 'Étudiant RGPD', role: 'STUDENT', passwordHash: await hashPassword('Secret-123!') } });
    const url = await base();
    const loginRes = await fetch(`${url}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Secret-123!' }) });
    const cookie = loginRes.headers.get('set-cookie')!.split(';')[0]!;

    // Un ticket avec photo, une notification et un échange avec l'assistant
    const refs = (await (await fetch(`${url}/referentials`, { headers: { cookie } })).json()) as Referentials;
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3d6b3b50000000049454e44ae426082', 'hex');
    const form = new FormData();
    form.set('categoryId', refs.categories[0]!.id);
    form.set('buildingId', refs.buildings[0]!.id);
    form.set('room', 'A101');
    form.set('description', 'Mon nom est Étudiant RGPD, téléphone 0600000000');
    form.set('photo', new Blob([png], { type: 'image/png' }), 'p.png');
    const t = (await (await fetch(`${url}/incidents`, { method: 'POST', headers: { cookie }, body: form })).json()) as IncidentSummary;
    api.created.push(t.id);
    await api.post('karim', `/incidents/${t.id}/take`, {});
    await fetch(`${url}/assistant/ask`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'wifi ?' }) });

    const erase = (confirmEmail: string, id = student.id) => api.post('claire', `/admin/users/${id}/erase`, { confirmEmail });
    expect((await erase('autre@esiea.fr')).status).toBe(400);
    expect((await erase(DEMO_AGENT, api.ids.karim)).status).toBe(409); // pas un étudiant
    expect((await erase('x', api.ids.claire)).status).toBe(409); // soi-même
    expect((await api.post('karim', `/admin/users/${student.id}/erase`, { confirmEmail: email })).status).toBe(403);
    const res = await erase(email.toUpperCase());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tickets: 1, photos: 1 });

    const user = await p.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(user.name).toBe('Utilisateur supprimé');
    expect(user.email).not.toContain('rgpd.test');
    expect(user.anonymizedAt).not.toBeNull();
    const ticket = await p.incident.findUniqueOrThrow({ where: { id: t.id } });
    expect(ticket.description).not.toContain('0600000000');
    expect(ticket.photoKey).toBeNull();
    expect(ticket.categoryId).toBe(refs.categories[0]!.id); // conservé pour les statistiques
    expect(await p.notification.count({ where: { userId: student.id } })).toBe(0);
    expect(await p.assistantInteraction.count({ where: { userId: student.id } })).toBe(0);
    // l'ancienne session et une nouvelle connexion sont refusées
    expect((await fetch(`${url}/auth/me`, { headers: { cookie } })).status).toBe(401);
    expect((await fetch(`${url}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Secret-123!' }) })).status).toBe(401);

    const audit = await api.json<AuditEntryDto[]>('claire', '/admin/audit?action=DATA_DELETION');
    const entry = audit.find((a) => a.targetId === student.id)!;
    expect(entry.details).toEqual({ tickets: 1, photos: 1 });
    expect(entry.targetLabel).toBe('Utilisateur supprimé');
    expect(JSON.stringify(audit)).not.toContain('rgpd.test');
  });
});

const DEMO_AGENT = 'karim.benali@esiea.fr';

describe('US-37 journal d’audit', () => {
  it('lecture seule, réservée à l’admin, filtrable par action', async () => {
    await api.call('claire', '/admin/incidents/export.csv');
    const all = await api.json<AuditEntryDto[]>('claire', '/admin/audit');
    expect(all.length).toBeGreaterThan(0);
    const exports = await api.json<AuditEntryDto[]>('claire', '/admin/audit?action=EXPORT');
    expect(exports.every((e) => e.action === 'EXPORT')).toBe(true);
    expect(exports[0]!.actor?.id).toBe(api.ids.claire);
    expect((await api.call('karim', '/admin/audit')).status).toBe(403);
    expect((await api.call('claire', `/admin/audit/${all[0]!.id}`, { method: 'DELETE' })).status).toBe(404);
  });
});
