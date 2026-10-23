import { describe, expect, it } from 'vitest';
import {
  aiResolvedRate,
  averageScore,
  avgResolutionHours,
  bucketKey,
  reopenRate,
  resolutionRate,
  timeSeries,
  type KpiTicket,
} from './kpi';

const at = (h: number) => new Date(Date.UTC(2026, 9, 1, 8) + h * 3_600_000).toISOString();
const ticket = (status: KpiTicket['status'], resolvedAfterH: number | null, reopenCount = 0): KpiTicket => ({
  status,
  createdAt: at(0),
  resolvedAt: resolvedAfterH === null ? null : at(resolvedAfterH),
  reopenCount,
});

/** Scénario de US-28 : 10 tickets, 6 résolus/fermés en 12 h en moyenne, 1 contesté. */
const scenario: KpiTicket[] = [
  ticket('RESOLU', 6),
  ticket('RESOLU', 18),
  ticket('FERME', 10),
  ticket('FERME', 14),
  ticket('FERME', 12, 1), // contesté puis re-résolu
  ticket('FERME', 12),
  ticket('EN_COURS', null),
  ticket('EN_COURS', null),
  ticket('NOUVEAU', null),
  ticket('NOUVEAU', null),
];

describe('US-28 indicateurs de performance', () => {
  it('délai moyen de résolution = 12 h', () => expect(avgResolutionHours(scenario)).toBe(12));
  it('taux de résolution = 60 %', () => expect(resolutionRate(scenario)).toBeCloseTo(0.6));
  it('taux de réouverture = 1/6 ≈ 17 %', () => expect(reopenRate(scenario)).toBeCloseTo(1 / 6));
  it('les rejetés sont exclus du taux de résolution', () =>
    expect(resolutionRate([...scenario, ticket('REJETE', null), ticket('REJETE', null)])).toBeCloseTo(0.6));
  it('un ticket contesté encore en cours compte comme réouvert', () =>
    expect(reopenRate([ticket('EN_COURS', null, 1), ticket('FERME', 5)])).toBe(0.5));
  it('aucune donnée → null (affiché « — »)', () => {
    expect(avgResolutionHours([])).toBeNull();
    expect(resolutionRate([])).toBeNull();
    expect(reopenRate([ticket('NOUVEAU', null)])).toBeNull();
  });
});

describe('US-12 satisfaction moyenne', () => {
  it('moyenne des notes', () => expect(averageScore([5, 4, 3])).toBe(4));
  it('null sans note', () => expect(averageScore([])).toBeNull());
});

describe('US-30 regroupements temporels (heure de Paris)', () => {
  it('jour, semaine ISO, mois, année', () => {
    const d = '2026-10-22T10:00:00Z';
    expect(bucketKey(d, 'day')).toBe('2026-10-22');
    expect(bucketKey(d, 'week')).toBe('2026-W43');
    expect(bucketKey(d, 'month')).toBe('2026-10');
    expect(bucketKey(d, 'year')).toBe('2026');
  });
  it('23h30 UTC le 31/12 est déjà le 1er janvier à Paris', () => expect(bucketKey('2026-12-31T23:30:00Z', 'year')).toBe('2027'));
  it('la semaine du 1er janvier 2027 (vendredi) appartient à 2026-W53', () => expect(bucketKey('2027-01-01T12:00:00Z', 'week')).toBe('2026-W53'));

  it('série continue de créés / résolus, sans trou', () => {
    const tickets: KpiTicket[] = [
      { status: 'FERME', createdAt: '2026-10-01T09:00:00Z', resolvedAt: '2026-10-03T09:00:00Z', reopenCount: 0 },
      { status: 'NOUVEAU', createdAt: '2026-10-03T09:00:00Z', resolvedAt: null, reopenCount: 0 },
    ];
    const s = timeSeries(tickets, 'day', new Date('2026-10-01T00:00:00Z'), new Date('2026-10-04T12:00:00Z'));
    expect(s).toEqual([
      { bucket: '2026-10-01', created: 1, resolved: 0 },
      { bucket: '2026-10-02', created: 0, resolved: 0 },
      { bucket: '2026-10-03', created: 1, resolved: 1 },
      { bucket: '2026-10-04', created: 0, resolved: 0 },
    ]);
  });
});

describe('US-31 part résolue par l’IA', () => {
  it('réponses fondées, 👍 et sans ticket / réponses évaluées', () => {
    expect(
      aiResolvedRate([
        { kind: 'faq', feedback: 'UP', createdIncidentId: null }, // résolue
        { kind: 'faq', feedback: 'UP', createdIncidentId: 'x' }, // a quand même mené à un ticket
        { kind: 'needs_ticket', feedback: 'UP', createdIncidentId: null },
        { kind: 'document', feedback: 'DOWN', createdIncidentId: null },
        { kind: 'faq', feedback: null, createdIncidentId: null }, // non évaluée : exclue
      ]),
    ).toBe(0.25);
  });
});
