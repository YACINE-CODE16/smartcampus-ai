/** Bloc b : tableau de bord (US-27 à US-32) et export CSV (US-33). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DashboardResponse, IncidentSummary } from '@smartcampus/shared';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.stop());

describe('GET /admin/dashboard', () => {
  it('réservé à l’admin', async () => {
    expect((await api.call('karim', '/dashboard')).status).toBe(403);
    expect((await api.call('alice', '/dashboard')).status).toBe(403);
  });

  it('US-27 : la somme des statuts vaut le total de la période ; US-29 : 5 bâtiments triés', async () => {
    const d = await api.json<DashboardResponse>('claire', '/dashboard?period=all');
    const sum = Object.values(d.byStatus).reduce((a, b) => a + b, 0);
    expect(sum).toBe(d.kpis.total);
    expect(d.kpis.total).toBe(await api.container.prisma.incident.count());
    expect(d.byBuilding).toHaveLength(5);
    expect(d.byBuilding.map((b) => b.count)).toEqual([...d.byBuilding.map((b) => b.count)].sort((a, b) => b - a));
    expect(d.byCategory.reduce((a, c) => a + c.count, 0)).toBe(d.kpis.total);
  });

  it('US-28 : indicateurs bornés et satisfaction issue des notes (US-12)', async () => {
    const d = await api.json<DashboardResponse>('claire', '/dashboard?period=30d');
    expect(d.kpis.resolutionRate).toBeGreaterThan(0);
    expect(d.kpis.resolutionRate).toBeLessThanOrEqual(1);
    expect(d.kpis.reopenRate).toBeGreaterThan(0);
    expect(d.kpis.avgResolutionHours).toBeGreaterThan(0);
    expect(d.kpis.satisfaction).toBeGreaterThanOrEqual(1);
    expect(d.kpis.satisfaction).toBeLessThanOrEqual(5);
    expect(d.kpis.ratingsCount).toBeGreaterThan(0);
    expect(d.kpis.openCritical).toBeGreaterThanOrEqual(2);
    expect(d.kpis.late).toBeGreaterThanOrEqual(3);
  });

  it('US-30 : granularités jour / semaine / mois et créés = total', async () => {
    for (const g of ['day', 'week', 'month'] as const) {
      const d = await api.json<DashboardResponse>('claire', `/dashboard?period=30d&granularity=${g}`);
      expect(d.series.reduce((a, p) => a + p.created, 0)).toBe(d.kpis.total);
    }
    const days = await api.json<DashboardResponse>('claire', '/dashboard?period=7d&granularity=day');
    expect(days.series.length).toBeGreaterThanOrEqual(7);
  });

  it('US-32 : charge par agent cohérente avec les tickets ouverts affectés', async () => {
    const d = await api.json<DashboardResponse>('claire', '/dashboard');
    const karim = d.agents.find((a) => a.id === api.ids.karim)!;
    const open = await api.container.prisma.incident.count({ where: { assignedToId: api.ids.karim, status: { in: ['NOUVEAU', 'EN_COURS'] } } });
    expect(karim.open).toBe(open);
  });

  it('400 sur une période inconnue', async () => {
    expect((await api.call('claire', '/dashboard?period=12y')).status).toBe(400);
  });
});

describe('US-33 export CSV', () => {
  it('exporte les tickets filtrés, en UTF-8 avec BOM, et trace l’export', async () => {
    const before = await api.container.prisma.auditLog.count({ where: { action: 'EXPORT' } });
    const res = await api.call('claire', '/dashboard/incidents.csv?late=true');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    // `text()` retire le BOM au décodage : on contrôle les octets bruts.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes);
    const lines = csv.trim().split('\r\n');
    const late = await api.json<IncidentSummary[]>('claire', '/incidents?late=true');
    expect(lines).toHaveLength(late.length + 1);
    expect(lines[0]).toContain('Ticket;Créé le;Statut');
    expect(csv).not.toContain('Ticket créé par les tests'); // pas de description
    expect(await api.container.prisma.auditLog.count({ where: { action: 'EXPORT' } })).toBe(before + 1);
  });

  it('en-têtes en anglais avec Accept-Language: en ; refusé aux agents', async () => {
    const res = await api.call('claire', '/dashboard/incidents.csv', { headers: { 'accept-language': 'en' } });
    expect((await res.text()).split('\r\n')[0]).toContain('Ticket;Created;Status');
    expect((await api.call('karim', '/dashboard/incidents.csv')).status).toBe(403);
  });
});
