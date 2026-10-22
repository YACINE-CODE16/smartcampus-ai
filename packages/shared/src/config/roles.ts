import type { Bilingual } from './i18n';

export const ROLES = ['STUDENT', 'AGENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Auteur d'une action automatique (ex. contrôle des délais cibles). */
export type ActorRole = Role | 'SYSTEM';

export const ROLE_LABELS: Record<ActorRole, Bilingual> = {
  STUDENT: { fr: 'Étudiant', en: 'Student' },
  AGENT: { fr: 'Agent', en: 'Agent' },
  ADMIN: { fr: 'Administrateur', en: 'Administrator' },
  SYSTEM: { fr: 'Système', en: 'System' },
};

/** Espace d'accueil de chaque rôle. */
export const ROLE_HOME: Record<Role, string> = {
  STUDENT: '/etudiant',
  AGENT: '/agent',
  ADMIN: '/admin',
};
