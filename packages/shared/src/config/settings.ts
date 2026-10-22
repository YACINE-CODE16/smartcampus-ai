/** Réglages métier. Modifier ici, jamais en dur ailleurs. */
export const SETTINGS = {
  /** Au-delà, un ticket encore NOUVEAU est « en retard » (R4). */
  lateAfterHours: 24,
  maxPhotoMb: 10,
  acceptedPhotoTypes: ['image/jpeg', 'image/png'] as readonly string[],
  description: { min: 10, max: 2000 },
  room: { max: 40 },
  reason: { min: 5, max: 500 },
  comment: { max: 1000 },
} as const;
