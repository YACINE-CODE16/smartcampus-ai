import type { Response } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import type { SessionUser } from '@smartcampus/shared';
import type { Env } from '../config/env';

export const SESSION_COOKIE = 'sc_session';
const SESSION_HOURS = 8;

/** Session applicative signée par l'API, indépendante du fournisseur d'identité. */
export class SessionService {
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

  /** Renvoie l'id utilisateur du jeton, ou `null` s'il est absent, invalide ou expiré. */
  async verify(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
