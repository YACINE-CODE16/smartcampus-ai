import type { Role } from '../config/roles';
import { SETTINGS } from '../config/settings';
import { TRANSITIONS, type IncidentStatus, type Transition, type TransitionActor } from '../config/statuses';
import type { Priority, Urgency } from '../config/urgencies';

/** Le strict nécessaire d'un ticket pour appliquer les règles. */
export interface IncidentRef {
  status: IncidentStatus;
  ownerId: string;
  assignedToId: string | null;
}

export interface Actor {
  id: string;
  role: Role;
}

export function formatTicketNumber(n: number): string {
  return `SC-${String(n).padStart(4, '0')}`;
}

export function buildTitle(categoryLabel: string, buildingName: string, room: string): string {
  return `${categoryLabel} – ${buildingName} ${room}`.trim();
}

export function computePriority(urgency: Urgency, categoryAutoPriority: Priority | null): Priority {
  return categoryAutoPriority ?? urgency;
}

export function isLate(incident: { status: IncidentStatus; createdAt: Date | string }, now: Date = new Date()): boolean {
  if (incident.status !== 'NOUVEAU') return false;
  const ageMs = now.getTime() - new Date(incident.createdAt).getTime();
  return ageMs > SETTINGS.lateAfterHours * 3_600_000;
}

/** R1 : qui peut voir un ticket. */
export function canView(actor: Actor, incident: IncidentRef): boolean {
  switch (actor.role) {
    case 'ADMIN':
      return true;
    case 'AGENT':
      return incident.assignedToId === null || incident.assignedToId === actor.id;
    case 'STUDENT':
      return incident.ownerId === actor.id;
  }
}

/** Qualités de l'acteur vis-à-vis de ce ticket. */
function actorQualities(actor: Actor, incident: IncidentRef): TransitionActor[] {
  const q: TransitionActor[] = [];
  if (actor.role === 'ADMIN') q.push('admin');
  if (actor.role === 'AGENT' && incident.assignedToId === actor.id) q.push('assignedAgent');
  if (actor.role === 'STUDENT' && incident.ownerId === actor.id) q.push('owner');
  return q;
}

/** Transitions que cet acteur peut déclencher maintenant (utilisé pour afficher les boutons). */
export function allowedTransitions(actor: Actor, incident: IncidentRef): Transition[] {
  const qualities = actorQualities(actor, incident);
  return TRANSITIONS.filter((t) => t.from === incident.status && t.actors.some((a) => qualities.includes(a)));
}

export function findTransition(actor: Actor, incident: IncidentRef, to: IncidentStatus): Transition | undefined {
  return allowedTransitions(actor, incident).find((t) => t.to === to);
}

/** « Prendre en charge » (D4) : agent ou admin, ticket NOUVEAU non affecté. */
export function canTake(actor: Actor, incident: IncidentRef): boolean {
  return (actor.role === 'AGENT' || actor.role === 'ADMIN') && incident.status === 'NOUVEAU' && incident.assignedToId === null;
}
