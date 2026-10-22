import type { Bilingual } from './i18n';
import type { ActorRole } from './roles';

export const INCIDENT_STATUSES = ['NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME', 'REJETE'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const STATUS_LABELS: Record<IncidentStatus, Bilingual> = {
  NOUVEAU: { fr: 'Nouveau', en: 'New' },
  EN_COURS: { fr: 'En cours', en: 'In progress' },
  RESOLU: { fr: 'Résolu', en: 'Resolved' },
  FERME: { fr: 'Fermé', en: 'Closed' },
  REJETE: { fr: 'Rejeté', en: 'Rejected' },
};

/** Statuts terminaux : plus aucune action de traitement. */
export const CLOSED_STATUSES: readonly IncidentStatus[] = ['FERME', 'REJETE'];
/** Statuts « ouverts » (comptés dans la charge, les alertes et les doublons). */
export const OPEN_STATUSES: readonly IncidentStatus[] = ['NOUVEAU', 'EN_COURS'];

/**
 * Qui peut déclencher une transition :
 * - `assignedAgent` : l'agent affecté (un agent doit d'abord prendre un ticket non affecté) ;
 * - `owner` : l'étudiant propriétaire ;
 * - `admin` : tout administrateur.
 */
export type TransitionActor = 'assignedAgent' | 'owner' | 'admin';

export interface Transition {
  from: IncidentStatus;
  to: IncidentStatus;
  actors: readonly TransitionActor[];
  /** Libellé du bouton d'action. */
  action: Bilingual;
  requiresReason?: boolean;
  /** Commentaire obligatoire (contestation). */
  requiresComment?: boolean;
  /** Contestation : incrémente le compteur de réouvertures. */
  countsAsReopen?: boolean;
}

/** Table unique des transitions autorisées (D8 : pas de saut NOUVEAU → RESOLU). */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'NOUVEAU', to: 'EN_COURS', actors: ['assignedAgent', 'admin'], action: { fr: 'Passer en cours', en: 'Start work' } },
  { from: 'NOUVEAU', to: 'REJETE', actors: ['assignedAgent', 'admin'], action: { fr: 'Rejeter', en: 'Reject' }, requiresReason: true },
  { from: 'EN_COURS', to: 'RESOLU', actors: ['assignedAgent', 'admin'], action: { fr: 'Marquer résolu', en: 'Mark resolved' } },
  { from: 'EN_COURS', to: 'REJETE', actors: ['assignedAgent', 'admin'], action: { fr: 'Rejeter', en: 'Reject' }, requiresReason: true },
  { from: 'RESOLU', to: 'FERME', actors: ['owner', 'admin'], action: { fr: 'Confirmer la résolution', en: 'Confirm resolution' } },
  {
    from: 'RESOLU',
    to: 'EN_COURS',
    actors: ['owner'],
    action: { fr: 'Contester', en: 'Dispute' },
    requiresComment: true,
    countsAsReopen: true,
  },
];

/** Rôle d'auteur enregistré dans l'historique pour chaque type d'acteur. */
export const ACTOR_ROLE: Record<TransitionActor, ActorRole> = {
  assignedAgent: 'AGENT',
  owner: 'STUDENT',
  admin: 'ADMIN',
};
