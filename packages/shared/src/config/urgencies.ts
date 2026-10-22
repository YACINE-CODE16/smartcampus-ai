export const URGENCIES = ['FAIBLE', 'NORMALE', 'HAUTE'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  FAIBLE: 'Faible',
  NORMALE: 'Normale',
  HAUTE: 'Haute',
};

export const DEFAULT_URGENCY: Urgency = 'NORMALE';

/** Ordre de tri des files de traitement : haute d'abord. */
export const URGENCY_RANK: Record<Urgency, number> = { HAUTE: 0, NORMALE: 1, FAIBLE: 2 };
