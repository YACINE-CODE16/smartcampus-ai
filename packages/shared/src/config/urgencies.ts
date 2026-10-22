/** Urgence ressentie, saisie par l'étudiant (US-05). */
export const URGENCIES = ['FAIBLE', 'NORMALE', 'HAUTE'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  FAIBLE: 'Faible',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
};

export const DEFAULT_URGENCY: Urgency = 'NORMALE';

/** Priorité de traitement : l'urgence, ou une priorité imposée par la catégorie (Sécurité → CRITIQUE). */
export const PRIORITIES = ['FAIBLE', 'NORMALE', 'HAUTE', 'CRITIQUE'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  FAIBLE: 'Faible',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
  CRITIQUE: 'Critique',
};

/** Ordre de tri des files : critique d'abord. */
export const PRIORITY_RANK: Record<Priority, number> = { CRITIQUE: 0, HAUTE: 1, NORMALE: 2, FAIBLE: 3 };
