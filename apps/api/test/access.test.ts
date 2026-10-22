/**
 * Tests d'intégration du contrôle d'accès (R1, NFR-3).
 * Prérequis : PostgreSQL démarré et données de démo chargées (`npm run setup` ou `npm run seed`).
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IncidentDetail, IncidentSummary, Referentials } from '@smartcampus/shared';
import { env } from '../src/config/env';
import { createContainer } from '../src/container';
import { createApp } from '../src/http/app';

const container = createContainer(env);
let server: Server;
let base: string;
const cookies: Record<string, string> = {};
const createdIds: string[] = [];

async function call(who: string | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (who) headers.set('cookie', cookies[who]!);
  return fetch(`${base}/api${path}`, { ...init, headers });
}

async function login(who: string, email: string) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: env.DEMO_PASSWORD }),
  });
  expect(res.status).toBe(200);
  cookies[who] = res.headers.get('set-cookie')!.split(';')[0]!;
  return (await res.json()) as { id: string };
}

const ids: Record<string, string> = {};

beforeAll(async () => {
  server = createApp(container).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (const [who, email] of Object.entries({
    alice: 'alice.martin@esiea.fr',
    bob: 'bob.durand@esiea.fr',
    karim: 'karim.benali@esiea.fr',
    julie: 'julie.robert@esiea.fr',
    claire: 'claire.moreau@esiea.fr',
  })) {
    ids[who] = (await login(who, email)).id;
  }
});

afterAll(async () => {
  await container.prisma.incident.deleteMany({ where: { id: { in: createdIds } } });
  server.close();
  await container.dispose();
});

describe('authentification', () => {
  it('401 sans session', async () => {
    expect((await call(null, '/incidents')).status).toBe(401);
    expect((await call(null, '/auth/me')).status).toBe(401);
  });
  it('401 avec un cookie falsifié', async () => {
    const res = await fetch(`${base}/api/incidents`, { headers: { cookie: 'sc_session=eyJhbGciOiJIUzI1NiJ9.e30.bad' } });
    expect(res.status).toBe(401);
  });
});

describe('étudiant (R1)', () => {
  it('ne voit que ses propres tickets', async () => {
    const list = (await (await call('alice', '/incidents')).json()) as IncidentSummary[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.owner.id === ids.alice)).toBe(true);
  });

  it("reçoit 404 sur le ticket et la photo d'un autre étudiant", async () => {
    const [aliceTicket] = (await (await call('alice', '/incidents')).json()) as IncidentSummary[];
    expect((await call('bob', `/incidents/${aliceTicket!.id}`)).status).toBe(404);
    expect((await call('bob', `/incidents/${aliceTicket!.id}/photo`)).status).toBe(404);
  });

  it('crée un ticket NOUVEAU avec historique initial ; Sécurité → CRITIQUE', async () => {
    const refs = (await (await call('alice', '/referentials')).json()) as Referentials;
    const form = new FormData();
    form.set('categoryId', refs.categories.find((c) => c.slug === 'securite')!.id);
    form.set('buildingId', refs.buildings[0]!.id);
    form.set('room', 'Hall');
    form.set('description', 'Porte coupe-feu bloquée ouverte');
    form.set('urgency', 'FAIBLE');
    const res = await call('alice', '/incidents', { method: 'POST', body: form });
    expect(res.status).toBe(201);
    const created = (await res.json()) as IncidentSummary;
    createdIds.push(created.id);
    expect(created.status).toBe('NOUVEAU');
    expect(created.priority).toBe('CRITIQUE');
    expect(created.ticketNumber).toMatch(/^SC-\d{4,}$/);

    const detail = (await (await call('alice', `/incidents/${created.id}`)).json()) as IncidentDetail;
    expect(detail.events).toHaveLength(1);
    expect(detail.events[0]).toMatchObject({ type: 'CREATED', toStatus: 'NOUVEAU', authorRole: 'STUDENT' });
  });

  it('400 avec les erreurs par champ', async () => {
    const res = await call('alice', '/incidents', { method: 'POST', body: new FormData() });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(body.fields).sort()).toEqual(['buildingId', 'categoryId', 'description', 'room']);
  });
});

describe('agent (R1)', () => {
  it('voit ses tickets et les non affectés, jamais ceux d’un collègue', async () => {
    const list = (await (await call('karim', '/incidents')).json()) as IncidentSummary[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.assignedTo === null || t.assignedTo.id === ids.karim)).toBe(true);

    const all = (await (await call('claire', '/incidents')).json()) as IncidentSummary[];
    const julies = all.find((t) => t.assignedTo?.id === ids.julie)!;
    expect((await call('karim', `/incidents/${julies.id}`)).status).toBe(404);
  });

  it('scope=unassigned ne renvoie que des tickets non affectés', async () => {
    const list = (await (await call('karim', '/incidents?scope=unassigned')).json()) as IncidentSummary[];
    expect(list.every((t) => t.assignedTo === null)).toBe(true);
  });

  it('403 pour créer un signalement', async () => {
    expect((await call('karim', '/incidents', { method: 'POST', body: new FormData() })).status).toBe(403);
  });
});

describe('admin', () => {
  it('voit tous les tickets', async () => {
    const list = (await (await call('claire', '/incidents')).json()) as IncidentSummary[];
    const total = await container.prisma.incident.count();
    expect(list).toHaveLength(total);
  });
});

it('id invalide → 404', async () => {
  expect((await call('claire', '/incidents/not-a-uuid')).status).toBe(404);
});
