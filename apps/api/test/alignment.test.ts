/** Réalignement sur les user stories officielles : US-04 (fichier), US-25 (agent), US-29 (salle), US-33 (filtres + export). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DashboardResponse, IncidentSummary, Referentials } from '@smartcampus/shared';
import { startApi, type TestApi } from './helpers';

let api: TestApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(() => api.stop());

async function post(file: Blob, name: string) {
  const refs = await api.json<Referentials>('alice', '/referentials');
  const form = new FormData();
  form.set('categoryId', refs.categories[0]!.id);
  form.set('buildingId', refs.buildings[0]!.id);
  form.set('room', 'A101');
  form.set('description', 'Plan de la salle joint en PDF');
  form.set('photo', file, name);
  return api.call('alice', '/incidents', { method: 'POST', body: form });
}

describe('US-04 photo ou fichier', () => {
  it('accepte un document PDF et le signale comme tel', async () => {
    const pdf = new Blob([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')], { type: 'application/pdf' });
    const res = await post(pdf, 'plan.pdf');
    expect(res.status).toBe(201);
    const t = (await res.json()) as IncidentSummary;
    api.created.push(t.id);
    expect(t.attachmentKind).toBe('pdf');
    const file = await api.call('alice', `/incidents/${t.id}/photo`);
    expect(file.headers.get('content-type')).toBe('application/pdf');
  });

  it('refuse un faux PDF (signature binaire vérifiée)', async () => {
    const fake = new Blob([Buffer.from('MZ\x90\x00 exécutable déguisé')], { type: 'application/pdf' });
    expect((await post(fake, 'facture.pdf')).status).toBe(400);
  });
});

describe('US-25 suggestion de qualification pour l’agent', () => {
  it('l’agent obtient une catégorie et une urgence proposées', async () => {
    const res = await api.post('karim', '/assistant/triage', { description: 'Fumée qui sort du tableau électrique du couloir' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { suggestion: unknown }).suggestion).toEqual({ categorySlug: 'securite', urgency: 'HAUTE' });
  });
});

describe('US-29 / US-33 tableau de bord filtré', () => {
  it('filtre par catégorie et par lieu, et classe les salles', async () => {
    const refs = await api.json<Referentials>('claire', '/referentials');
    const reseau = refs.categories.find((c) => c.slug === 'reseau')!;
    const all = await api.json<DashboardResponse>('claire', '/admin/dashboard?period=all');
    const net = await api.json<DashboardResponse>('claire', `/admin/dashboard?period=all&categoryId=${reseau.id}`);
    expect(net.kpis.total).toBe(await api.container.prisma.incident.count({ where: { categoryId: reseau.id } }));
    expect(net.kpis.total).toBeLessThan(all.kpis.total);
    expect(net.byCategory.find((c) => c.id === reseau.id)!.count).toBe(net.kpis.total);

    const a = refs.buildings.find((b) => b.code === 'A')!;
    const inA = await api.json<DashboardResponse>('claire', `/admin/dashboard?period=all&buildingId=${a.id}`);
    expect(inA.byBuilding.filter((b) => b.count > 0).map((b) => b.id)).toEqual([a.id]);
    expect(inA.byRoom.every((r) => r.building.code === 'A')).toBe(true);
    expect(all.byRoom.length).toBeGreaterThan(0);
    expect(all.byRoom.map((r) => r.count)).toEqual([...all.byRoom.map((r) => r.count)].sort((x, y) => y - x));
  });

  it('export CSV avec les filtres du tableau de bord, tracé dans l’audit', async () => {
    const refs = await api.json<Referentials>('claire', '/referentials');
    const reseau = refs.categories.find((c) => c.slug === 'reseau')!;
    const before = await api.container.prisma.auditLog.count({ where: { action: 'EXPORT' } });
    const res = await api.call('claire', `/admin/dashboard/export.csv?period=30d&categoryId=${reseau.id}`);
    expect(res.status).toBe(200);
    const lines = (await res.text()).trim().split('\r\n').slice(1);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.split(';')[3] === 'Réseau')).toBe(true);
    expect(await api.container.prisma.auditLog.count({ where: { action: 'EXPORT' } })).toBe(before + 1);
  });
});
