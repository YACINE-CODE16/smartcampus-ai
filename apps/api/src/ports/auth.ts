import type { Role } from '@smartcampus/shared';

/** Identité vérifiée de l'appelant. Toujours issue du jeton, jamais d'un paramètre client. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  /** Durée de validité en secondes. */
  expiresIn: number;
  user: AuthUser;
}

/**
 * Authentification et annuaire des rôles.
 *
 * - local (phase 1) : comptes en SQLite, mots de passe hachés, JWT signé par l'API,
 *   code de vérification envoyé via le `Mailer`.
 * - aws (phase 9) : Cognito. `signUp` / `confirmSignUp` / `signIn` passent alors côté
 *   navigateur (Amplify Auth) ; l'API ne garde que `verifyAccessToken` (aws-jwt-verify)
 *   et la gestion des groupes (Cognito Admin API).
 */
export interface AuthProvider {
  readonly name: string;
  signUp(input: SignUpInput): Promise<{ userId: string }>;
  confirmSignUp(email: string, code: string): Promise<void>;
  signIn(email: string, password: string): Promise<AuthSession>;
  /** Lève `UnauthorizedError` si le jeton est absent, invalide ou expiré. */
  verifyAccessToken(token: string): Promise<AuthUser>;
  addUserToRole(email: string, role: Role): Promise<void>;
  removeUserFromRole(email: string, role: Role): Promise<void>;
  listUsersInRole(role: Role): Promise<AuthUser[]>;
  countUsersInRole(role: Role): Promise<number>;
}
