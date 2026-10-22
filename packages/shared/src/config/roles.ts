/** Rôles applicatifs (groupes Cognito à la migration AWS). */
export const ROLES = ['STUDENT', 'TECHNICIAN', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Auteur d'une action automatique (fermeture J+7, anonymisation). */
export type ActorRole = Role | 'SYSTEM';

export const ROLE_LABELS: Record<ActorRole, string> = {
  STUDENT: 'Étudiant',
  TECHNICIAN: 'Technicien',
  ADMIN: 'Administrateur',
  SYSTEM: 'Système',
};

/** Rôle attribué automatiquement à l'inscription. */
export const DEFAULT_ROLE: Role = 'STUDENT';

/** Un utilisateur multi-rôles voit l'espace du rôle le plus élevé. */
export const ROLE_PRIORITY: readonly Role[] = ['ADMIN', 'TECHNICIAN', 'STUDENT'];

export function primaryRole(roles: readonly Role[]): Role {
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? DEFAULT_ROLE;
}
