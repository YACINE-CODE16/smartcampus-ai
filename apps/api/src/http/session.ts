import type { Request, Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { SessionUser } from '@smartcampus/shared';
import type { Env } from '../config/env';

export const SESSION_COOKIE = 'sc_session';
const SESSION_HOURS = 8;

/** Qui appelle : id interne (cookie local) ou email (jeton Cognito vérifié par API Gateway). */
export type Identity = { userId: string } | { email: string };

/** Manière dont une requête porte la session, selon le fournisseur d'identité. */
export interface SessionStrategy {
  /** Après une connexion réussie (pose le cookie en local ; rien avec Cognito, les jetons partent dans la réponse). */
  issue(res: Response, user: SessionUser): Promise<void>;
  identify(req: Request): Promise<Identity | null>;
  clear(res: Response): void;
}

/** Mode local : JWT signé par l'API, en cookie httpOnly (compatible SSE). */
export class CookieSession implements SessionStrategy {
  private readonly key: Uint8Array;

  constructor(private readonly env: Env) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  async issue(res: Response, user: SessionUser): Promise<void> {
    const token = await new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(this.key);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.COOKIE_SECURE,
      maxAge: SESSION_HOURS * 3_600_000,
      path: '/',
    });
  }

  async identify(req: Request): Promise<Identity | null> {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      return payload.sub ? { userId: payload.sub } : null;
    } catch {
      return null;
    }
  }

  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}

/** Requête Express enrichie par serverless-http (événement API Gateway HTTP API v2). */
interface ApiGatewayRequest extends Request {
  apiGateway?: { event?: { requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } } } };
}

/**
 * Mode Cognito : l'authorizer JWT d'API Gateway a déjà vérifié la signature, l'émetteur, l'audience
 * et l'expiration du jeton ; l'API lit les claims qu'il transmet. Sans claims (appel hors API Gateway) : refus.
 */
export class CognitoSession implements SessionStrategy {
  async issue(): Promise<void> {}

  async identify(req: Request): Promise<Identity | null> {
    const email = (req as ApiGatewayRequest).apiGateway?.event?.requestContext?.authorizer?.jwt?.claims?.email;
    return typeof email === 'string' && email ? { email } : null;
  }

  clear(): void {}
}
