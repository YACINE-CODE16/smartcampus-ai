import type { Role } from '../config/roles';
import { CLOSED_STATUSES, TRANSITIONS, type IncidentStatus, type Transition, type TransitionActor } from '../config/statuses';
import type { Priority, Urgency } from '../config/urgencies';

/** Le strict nécessaire d'un ticket pour appliquer les règles. */
export interface IncidentRef {
  status: IncidentStatus;
  ownerId: string;
  assignedToId: string | null;
}

/** Convertit un ticket tel que renvoyé par l'API (DTO) vers la forme attendue par les règles. */
export function refOf(t: { status: IncidentStatus; owner: { id: string }; assignedTo: { id: string } | null }): IncidentRef {
  return { status: t.status, ownerId: t.owner.id, assignedToId: t.assignedTo?.id ?? null };
}

export interface Actor {
  id: string;
  role: Role;
}

export function formatTicketNumber(n: number): string {
  return `SC-${String(n).padStart(4, '0')}`;
}

/** Titre généré (D14) : « Réseau – A102 (Bâtiment A) ». Le nom court du bâtiment précède « – ». */
export function buildTitle(categoryLabel: string, buildingName: string, room: string): string {
  const shortBuilding = buildingName.split(' – ')[0];
  return `${categoryLabel} – ${room} (${shortBuilding})`;
}

export function computePriority(urgency: Urgency, categoryAutoPriority: Priority | null): Priority {
  return categoryAutoPriority ?? urgency;
}

/** US-18 : un ticket est en retard s'il est encore NOUVEAU au-delà du délai cible de sa catégorie. */
export function isLate(
  incident: { status: IncidentStatus; createdAt: Date | string },
  targetHours: number,
  now: Date = new Date(),
): boolean {
  if (incident.status !== 'NOUVEAU') return false;
  const ageMs = now.getTime() - new Date(incident.createdAt).getTime();
  return ageMs > targetHours * 3_600_000;
}

export function isClosed(status: IncidentStatus): boolean {
  return CLOSED_STATUSES.includes(status);
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

/** US-16 : requalification (catégorie, urgence) par l'agent affecté ou l'admin, ticket non clos. */
export function canRequalify(actor: Actor, incident: IncidentRef): boolean {
  if (isClosed(incident.status)) return false;
  return actor.role === 'ADMIN' || (actor.role === 'AGENT' && incident.assignedToId === actor.id);
}

/** US-17 : fusion d'un doublon dans un ticket principal (deux tickets distincts, non clos). */
export function canMerge(
  actor: Actor,
  duplicate: IncidentRef & { id: string },
  target: IncidentRef & { id: string },
): boolean {
  if (duplicate.id === target.id) return false;
  if (isClosed(duplicate.status) || isClosed(target.status)) return false;
  return canRequalify(actor, duplicate) && canView(actor, target);
}

/** US-12 : le propriétaire note une fois un ticket résolu ou fermé. */
export function canRate(actor: Actor, incident: IncidentRef, alreadyRated: boolean): boolean {
  return (
    actor.role === 'STUDENT' &&
    incident.ownerId === actor.id &&
    (incident.status === 'RESOLU' || incident.status === 'FERME') &&
    !alreadyRated
  );
}
