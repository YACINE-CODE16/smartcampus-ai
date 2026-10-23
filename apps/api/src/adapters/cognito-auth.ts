import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ROLES, type Role, type SessionUser } from '@smartcampus/shared';
import type { PrismaClient } from '../db';
import type { AuthProvider, AuthResult, AuthTokens } from '../ports/auth';
import { LocalAuthProvider } from './local-auth';

/** Contenu (non vérifié) d'un JWT : la signature est vérifiée par API Gateway (authorizer JWT). */
function claims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as Record<string, unknown>;
}

/**
 * Amazon Cognito (AUTH_PROVIDER=cognito). La connexion passe par l'API (flux USER_PASSWORD_AUTH) pour
 * garder l'écran « Connexion école » et les comptes de démo ; le navigateur reçoit l'idToken et l'envoie
 * en `Authorization: Bearer`, vérifié par l'authorizer JWT d'API Gateway.
 * Les utilisateurs et leurs rôles de référence restent en base (lecture déléguée à LocalAuthProvider).
 */
export class CognitoAuthProvider implements AuthProvider {
  readonly name = 'cognito';
  private readonly client: CognitoIdentityProviderClient;
  private readonly db: LocalAuthProvider;

  constructor(
    prisma: PrismaClient,
    private readonly userPoolId: string,
    private readonly clientId: string,
    region: string,
  ) {
    this.client = new CognitoIdentityProviderClient({ region });
    this.db = new LocalAuthProvider(prisma);
  }

  private tokensOf(result: { IdToken?: string; RefreshToken?: string; ExpiresIn?: number } | undefined): AuthTokens | null {
    if (!result?.IdToken) return null;
    return { idToken: result.IdToken, refreshToken: result.RefreshToken, expiresIn: result.ExpiresIn ?? 3600 };
  }

  async authenticate(email: string, password: string): Promise<AuthResult | null> {
    try {
      const res = await this.client.send(
        new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: this.clientId,
          AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
        }),
      );
      const tokens = this.tokensOf(res.AuthenticationResult);
      if (!tokens) return null; // défi inattendu (nouveau mot de passe…) : les comptes de démo sont créés « permanents »
      const user = await this.db.findUserByEmail(String(claims(tokens.idToken).email ?? email));
      return user ? { user, tokens } : null;
    } catch (err) {
      if (err instanceof NotAuthorizedException || err instanceof UserNotFoundException) return null;
      throw err;
    }
  }

  async refresh(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const res = await this.client.send(
        new InitiateAuthCommand({ AuthFlow: 'REFRESH_TOKEN_AUTH', ClientId: this.clientId, AuthParameters: { REFRESH_TOKEN: refreshToken } }),
      );
      const tokens = this.tokensOf(res.AuthenticationResult);
      return tokens ? { ...tokens, refreshToken } : null;
    } catch (err) {
      if (err instanceof NotAuthorizedException) return null;
      throw err;
    }
  }

  findUser(id: string): Promise<SessionUser | null> {
    return this.db.findUser(id);
  }

  findUserByEmail(email: string): Promise<SessionUser | null> {
    return this.db.findUserByEmail(email);
  }

  async syncRole(email: string, role: Role): Promise<void> {
    const username = email.toLowerCase();
    const groups = await this.client.send(new AdminListGroupsForUserCommand({ UserPoolId: this.userPoolId, Username: username }));
    for (const g of groups.Groups ?? []) {
      if (g.GroupName && g.GroupName !== role && (ROLES as readonly string[]).includes(g.GroupName)) {
        await this.client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: this.userPoolId, Username: username, GroupName: g.GroupName }));
      }
    }
    await this.client.send(new AdminAddUserToGroupCommand({ UserPoolId: this.userPoolId, Username: username, GroupName: role }));
  }

  async disableUser(email: string): Promise<void> {
    const username = email.toLowerCase();
    try {
      await this.client.send(new AdminUserGlobalSignOutCommand({ UserPoolId: this.userPoolId, Username: username }));
      await this.client.send(new AdminDisableUserCommand({ UserPoolId: this.userPoolId, Username: username }));
    } catch (err) {
      if (!(err instanceof UserNotFoundException)) throw err;
    }
  }

  /** Utilisé par la Lambda Migrate : crée (ou met à jour) un compte de démo avec mot de passe permanent. */
  async ensureUser(email: string, name: string, role: Role, password: string): Promise<void> {
    const username = email.toLowerCase();
    try {
      await this.client.send(new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: username }));
    } catch (err) {
      if (!(err instanceof UserNotFoundException)) throw err;
      await this.client.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          MessageAction: 'SUPPRESS',
          UserAttributes: [
            { Name: 'email', Value: username },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: name },
          ],
        }),
      );
    }
    await this.client.send(new AdminSetUserPasswordCommand({ UserPoolId: this.userPoolId, Username: username, Password: password, Permanent: true }));
    await this.syncRole(username, role);
  }
}
