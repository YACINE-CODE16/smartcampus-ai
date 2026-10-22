/** Réglages métier (délais, limites). Modifier ici, jamais en dur ailleurs. */
export const SETTINGS = {
  autoCloseDays: 7,
  anonymizeAfterMonths: 12,
  maxPhotoMb: 10,
  acceptedPhotoTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  activeStudentWindowDays: 30,
  /** Durée de validité d'une URL de fichier signée (équivalent URL présignée S3). */
  fileUrlTtlSeconds: 300,
} as const;
