import type { AuthTokens, Role, SessionUser } from '@smartcampus/shared';

export type { AuthTokens };

export interface AuthResult {
  user: SessionUser;
  /** Absent en mode local (la session est un cookie httpOnly posé par l'API). */
  tokens?: AuthTokens;
}

/**
 * Fournisseur d'identité (« SSO école », US-01).
 * - `local` : comptes de démo en base, mot de passe vérifié par l'API, session en cookie JWT.
 * - `cognito` : User Pool Amazon Cognito (groupes STUDENT, AGENT, ADMIN) ; API Gateway vérifie le jeton.
 * Le rôle de référence reste en base (relu à chaque requête) ; Cognito est synchronisé (US-02, US-34).
 */
export interface AuthProvider {
  readonly name: string;
  /** Renvoie l'utilisateur (et ses jetons éventuels) si les identifiants sont valides, sinon `null`. */
  authenticate(email: string, password: string): Promise<AuthResult | null>;
  /** Nouveau jeton à partir d'un jeton de rafraîchissement (Cognito) ; `null` en mode local ou si invalide. */
  refresh(refreshToken: string): Promise<AuthTokens | null>;
  findUser(id: string): Promise<SessionUser | null>;
  findUserByEmail(email: string): Promise<SessionUser | null>;
  /** US-02 : reporte un changement de rôle chez le fournisseur (groupe Cognito). */
  syncRole(email: string, role: Role): Promise<void>;
  /** US-34 : empêche toute nouvelle connexion du compte (désactivation Cognito). */
  disableUser(email: string): Promise<void>;
}
