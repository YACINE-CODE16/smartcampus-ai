/** Réglages métier. Modifier ici, jamais en dur ailleurs. */
export const SETTINGS = {
  /** Délai cible de prise en charge par défaut (US-18), modifiable par catégorie. */
  defaultTargetHours: 24,
  targetHours: { min: 1, max: 720 },
  /** Fréquence du contrôle des délais cibles. */
  overdueCheckMinutes: 5,
  maxPhotoMb: 10,
  /** US-04 : photo (JPG, PNG) ou document (PDF). */
  acceptedPhotoTypes: ['image/jpeg', 'image/png', 'application/pdf'] as readonly string[],
  description: { min: 10, max: 2000 },
  room: { max: 40 },
  reason: { min: 5, max: 500 },
  comment: { max: 1000 },
  note: { max: 1000 },
  ratingComment: { max: 500 },
  /** Saisie minimale avant de demander une suggestion de qualification à l'IA (US-25). */
  triageMinChars: 15,
  /** US-34 : tentatives de connexion par IP et par fenêtre. */
  loginRateLimit: { max: 10, windowMinutes: 15 },
} as const;
