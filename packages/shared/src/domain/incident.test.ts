import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  buildTitle,
  canTake,
  canView,
  computePriority,
  findTransition,
  formatTicketNumber,
  isLate,
  type IncidentRef,
} from './incident';

const student = { id: 'stu', role: 'STUDENT' as const };
const otherStudent = { id: 'stu2', role: 'STUDENT' as const };
const agent = { id: 'agt', role: 'AGENT' as const };
const otherAgent = { id: 'agt2', role: 'AGENT' as const };
const admin = { id: 'adm', role: 'ADMIN' as const };

const ticket = (patch: Partial<IncidentRef> = {}): IncidentRef => ({
  status: 'NOUVEAU',
  ownerId: 'stu',
  assignedToId: null,
  ...patch,
});

describe('formatTicketNumber', () => {
  it('pads to 4 digits', () => {
    expect(formatTicketNumber(7)).toBe('SC-0007');
    expect(formatTicketNumber(12345)).toBe('SC-12345');
  });
});

describe('buildTitle', () => {
  it('uses the short building name', () =>
    expect(buildTitle('Réseau', 'Bâtiment A – Enseignement', 'A102')).toBe('Réseau – A102 (Bâtiment A)'));
  it('keeps names without a dash', () => expect(buildTitle('Salle', 'Bibliothèque', 'Box 2')).toBe('Salle – Box 2 (Bibliothèque)'));
});

describe('computePriority', () => {
  it('uses the urgency by default', () => expect(computePriority('HAUTE', null)).toBe('HAUTE'));
  it('category auto-priority wins (Sécurité → CRITIQUE)', () =>
    expect(computePriority('FAIBLE', 'CRITIQUE')).toBe('CRITIQUE'));
});

describe('isLate (R4)', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  it('NOUVEAU older than 24h is late', () =>
    expect(isLate({ status: 'NOUVEAU', createdAt: '2026-10-21T11:00:00Z' }, now)).toBe(true));
  it('NOUVEAU younger than 24h is not late', () =>
    expect(isLate({ status: 'NOUVEAU', createdAt: '2026-10-21T13:00:00Z' }, now)).toBe(false));
  it('taken tickets are never late', () =>
    expect(isLate({ status: 'EN_COURS', createdAt: '2026-10-01T00:00:00Z' }, now)).toBe(false));
});

describe('canView (R1)', () => {
  it('student sees only own tickets', () => {
    expect(canView(student, ticket())).toBe(true);
    expect(canView(otherStudent, ticket())).toBe(false);
  });
  it('agent sees unassigned and own assigned tickets, not a colleague’s', () => {
    expect(canView(agent, ticket())).toBe(true);
    expect(canView(agent, ticket({ assignedToId: 'agt' }))).toBe(true);
    expect(canView(otherAgent, ticket({ assignedToId: 'agt' }))).toBe(false);
  });
  it('admin sees everything', () => expect(canView(admin, ticket({ assignedToId: 'agt' }))).toBe(true));
});

describe('transitions', () => {
  it('assigned agent can start, resolve and reject; cannot skip to RESOLU (D8)', () => {
    const t = ticket({ assignedToId: 'agt' });
    expect(allowedTransitions(agent, t).map((x) => x.to)).toEqual(['EN_COURS', 'REJETE']);
    expect(findTransition(agent, t, 'RESOLU')).toBeUndefined();
    expect(allowedTransitions(agent, { ...t, status: 'EN_COURS' }).map((x) => x.to)).toEqual(['RESOLU', 'REJETE']);
  });
  it('an agent cannot act on an unassigned or colleague ticket (must take it first)', () => {
    expect(allowedTransitions(agent, ticket())).toEqual([]);
    expect(allowedTransitions(otherAgent, ticket({ assignedToId: 'agt' }))).toEqual([]);
  });
  it('owner confirms or contests a resolved ticket; contest counts as reopen', () => {
    const t = ticket({ status: 'RESOLU', assignedToId: 'agt' });
    const moves = allowedTransitions(student, t);
    expect(moves.map((x) => x.to)).toEqual(['FERME', 'EN_COURS']);
    expect(moves.find((x) => x.to === 'EN_COURS')?.countsAsReopen).toBe(true);
    expect(allowedTransitions(otherStudent, t)).toEqual([]);
  });
  it('rejection requires a reason', () => {
    expect(findTransition(admin, ticket(), 'REJETE')?.requiresReason).toBe(true);
  });
  it('closed tickets allow nothing', () => {
    expect(allowedTransitions(admin, ticket({ status: 'FERME' }))).toEqual([]);
    expect(allowedTransitions(admin, ticket({ status: 'REJETE' }))).toEqual([]);
  });
});

describe('canTake (D4)', () => {
  it('agent can take an unassigned NOUVEAU ticket only', () => {
    expect(canTake(agent, ticket())).toBe(true);
    expect(canTake(agent, ticket({ assignedToId: 'agt2' }))).toBe(false);
    expect(canTake(agent, ticket({ status: 'EN_COURS' }))).toBe(false);
    expect(canTake(student, ticket())).toBe(false);
  });
});
