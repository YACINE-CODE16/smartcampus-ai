import type { SessionUser } from '@smartcampus/shared';

/**
 * Fournisseur d'identité (« SSO école »).
 * - `local` : comptes de démo seedés, mot de passe vérifié en base (SSO simulé).
 * - plus tard : OIDC/SAML de l'école. L'API émet ensuite sa propre session (JWT en
 *   cookie), donc le reste du code ne change pas.
 */
export interface AuthProvider {
  readonly name: string;
  /** Renvoie l'utilisateur si les identifiants sont valides, sinon `null`. */
  authenticate(email: string, password: string): Promise<SessionUser | null>;
  /** Recharge l'utilisateur d'une session (compte supprimé ou rôle modifié → `null`). */
  findUser(id: string): Promise<SessionUser | null>;
}
