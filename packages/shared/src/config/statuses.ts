import type { ActorRole } from './roles';

export const INCIDENT_STATUSES = ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
  FERME: 'Fermé',
};

export interface Transition {
  from: IncidentStatus;
  to: IncidentStatus;
  roles: readonly ActorRole[];
}

/**
 * Table unique des transitions autorisées (choix D8 : pas de saut OUVERT → RESOLU).
 * Les conditions contextuelles (propriétaire, technicien assigné) sont vérifiées
 * dans les règles de domaine, pas ici.
 */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'OUVERT', to: 'EN_COURS', roles: ['TECHNICIAN', 'ADMIN'] },
  { from: 'EN_COURS', to: 'RESOLU', roles: ['TECHNICIAN', 'ADMIN'] },
  { from: 'RESOLU', to: 'OUVERT', roles: ['STUDENT'] }, // réouverture par le propriétaire
  { from: 'RESOLU', to: 'FERME', roles: ['STUDENT', 'ADMIN', 'SYSTEM'] },
];
