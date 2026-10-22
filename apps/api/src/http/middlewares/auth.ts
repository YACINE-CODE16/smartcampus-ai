import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role, SessionUser } from '@smartcampus/shared';
import type { Container } from '../../container';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors';
import { SESSION_COOKIE } from '../session';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser;
  }
}

/** Vérifie le cookie de session et recharge l'utilisateur (le rôle vient de la base, pas du client). */
export function requireAuth(container: Container): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = await container.sessions.verify(req.cookies?.[SESSION_COOKIE]);
    const user = userId ? await container.auth.findUser(userId) : null;
    if (!user) return next(new UnauthorizedError());
    req.user = user;
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ForbiddenError());
    next();
  };
}

/** À utiliser après `requireAuth`. */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
