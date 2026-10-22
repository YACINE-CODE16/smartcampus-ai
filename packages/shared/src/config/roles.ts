export const ROLES = ['STUDENT', 'AGENT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Auteur d'une action automatique (ex. contrôle des retards). */
export type ActorRole = Role | 'SYSTEM';

export const ROLE_LABELS: Record<ActorRole, string> = {
  STUDENT: 'Étudiant',
  AGENT: 'Agent',
  ADMIN: 'Administrateur',
  SYSTEM: 'Système',
};

/** Espace d'accueil de chaque rôle. */
export const ROLE_HOME: Record<Role, string> = {
  STUDENT: '/etudiant',
  AGENT: '/agent',
  ADMIN: '/admin',
};
