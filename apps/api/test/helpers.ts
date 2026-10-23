/**
 * Outils des tests d'intégration : API démarrée sur un port libre, sessions des comptes de démo.
 * Prérequis : PostgreSQL démarré et données de démo chargées (`npm run setup` ou `npm run seed`).
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { IncidentSummary, Referentials } from '@smartcampus/shared';
import { env } from '../src/config/env';
import { createContainer, type Container } from '../src/container';
import { createApp } from '../src/http/app';

export const DEMO = {
  alice: 'alice.martin@esiea.fr',
  bob: 'bob.durand@esiea.fr',
  karim: 'karim.benali@esiea.fr',
  julie: 'julie.robert@esiea.fr',
  claire: 'claire.moreau@esiea.fr',
} as const;
export type Who = keyof typeof DEMO;

export interface TestApi {
  container: Container;
  /** Origine HTTP de l'API de test (pour les URL relatives renvoyées par /api/files). */
  origin: string;
  ids: Record<Who, string>;
  call(who: Who | null, path: string, init?: RequestInit): Promise<Response>;
  json<T>(who: Who | null, path: string, init?: RequestInit): Promise<T>;
  post(who: Who, path: string, body: unknown): Promise<Response>;
  createTicket(who: Who, opts?: { slug?: string; buildingIndex?: number; urgency?: string; room?: string }): Promise<IncidentSummary>;
  /** Ids des tickets créés pendant le test (supprimés à la fin). */
  created: string[];
  stop(): Promise<void>;
}

export async function startApi(): Promise<TestApi> {
  const container = createContainer(env);
  const server: Server = createApp(container).listen(0);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const base = `${origin}/api`;
  const cookies = {} as Record<Who, string>;
  const ids = {} as Record<Who, string>;
  const created: string[] = [];

  for (const [who, email] of Object.entries(DEMO) as [Who, string][]) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: env.DEMO_PASSWORD }),
    });
    if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : lancez « npm run seed »`);
    cookies[who] = res.headers.get('set-cookie')!.split(';')[0]!;
    ids[who] = ((await res.json()) as { id: string }).id;
  }

  const call = (who: Who | null, path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (who) headers.set('cookie', cookies[who]);
    return fetch(`${base}${path}`, { ...init, headers });
  };
  const json = async <T>(who: Who | null, path: string, init?: RequestInit) => (await (await call(who, path, init)).json()) as T;
  const post = (who: Who, path: string, body: unknown) =>
    call(who, path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  let refs: Referentials | null = null;
  const createTicket: TestApi['createTicket'] = async (who, opts = {}) => {
    refs ??= await json<Referentials>(who, '/incidents/referentials');
    const form = new FormData();
    form.set('categoryId', refs.categories.find((c) => c.slug === (opts.slug ?? 'materiel'))!.id);
    form.set('buildingId', refs.buildings[opts.buildingIndex ?? 0]!.id);
    form.set('room', opts.room ?? 'T-TEST');
    form.set('description', 'Ticket créé par les tests automatisés');
    form.set('urgency', opts.urgency ?? 'NORMALE');
    const res = await call(who, '/incidents', { method: 'POST', body: form });
    if (res.status !== 201) throw new Error(`Création impossible : ${res.status} ${await res.text()}`);
    const t = (await res.json()) as IncidentSummary;
    created.push(t.id);
    return t;
  };

  return {
    container,
    origin,
    ids,
    call,
    json,
    post,
    createTicket,
    created,
    async stop() {
      const p = container.prisma;
      await p.auditLog.deleteMany({ where: { targetId: { in: created } } });
      await p.incident.updateMany({ where: { mergedIntoId: { in: created } }, data: { mergedIntoId: null } });
      await p.incident.deleteMany({ where: { id: { in: created } } });
      server.close();
      await container.dispose();
    },
  };
}
