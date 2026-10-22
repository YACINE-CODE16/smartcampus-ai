import type { ActorRole } from './roles';

export const INCIDENT_STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME', 'REJETE'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  RESOLU: 'Résolu',
  FERME: 'Fermé',
  REJETE: 'Rejeté',
};

/** Statuts terminaux : plus aucune action de traitement. */
export const CLOSED_STATUSES: readonly IncidentStatus[] = ['FERME', 'REJETE'];

/**
 * Qui peut déclencher une transition :
 * - `assignedAgent` : l'agent affecté au ticket (un agent doit d'abord prendre un ticket non affecté) ;
 * - `owner` : l'étudiant propriétaire du ticket ;
 * - `admin` : tout administrateur.
 */
export type TransitionActor = 'assignedAgent' | 'owner' | 'admin';

export interface Transition {
  from: IncidentStatus;
  to: IncidentStatus;
  actors: readonly TransitionActor[];
  /** Libellé du bouton d'action. */
  action: string;
  requiresReason?: boolean;
  /** Contestation : incrémente le compteur de réouvertures. */
  countsAsReopen?: boolean;
}

/** Table unique des transitions autorisées (D8 : pas de saut NOUVEAU → RESOLU). */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'NOUVEAU', to: 'EN_COURS', actors: ['assignedAgent', 'admin'], action: 'Passer en cours' },
  { from: 'NOUVEAU', to: 'REJETE', actors: ['assignedAgent', 'admin'], action: 'Rejeter', requiresReason: true },
  { from: 'EN_COURS', to: 'RESOLU', actors: ['assignedAgent', 'admin'], action: 'Marquer résolu' },
  { from: 'EN_COURS', to: 'REJETE', actors: ['assignedAgent', 'admin'], action: 'Rejeter', requiresReason: true },
  { from: 'RESOLU', to: 'FERME', actors: ['owner', 'admin'], action: 'Confirmer la résolution' },
  { from: 'RESOLU', to: 'EN_COURS', actors: ['owner'], action: 'Contester', countsAsReopen: true },
];

/** Rôle d'auteur enregistré dans l'historique pour chaque type d'acteur. */
export const ACTOR_ROLE: Record<TransitionActor, ActorRole> = {
  assignedAgent: 'AGENT',
  owner: 'STUDENT',
  admin: 'ADMIN',
};
