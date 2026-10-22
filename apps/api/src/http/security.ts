import type { Request, RequestHandler } from 'express';
import { bi, localize, SETTINGS } from '@smartcampus/shared';
import { requestLang } from './lang';

/** US-36 : en-têtes de sécurité des réponses de l'API (le front est servi par nginx avec sa propre politique). */
export function securityHeaders(hsts: boolean): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // L'API ne sert que du JSON, du CSV, des images et un flux SSE : rien ne doit s'exécuter.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; frame-ancestors 'none'");
    if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * US-36 : au plus 10 échecs de connexion par IP sur 15 minutes (mémoire de l'instance unique).
 * Une connexion réussie remet le compteur à zéro.
 */
export class LoginLimiter {
  private readonly failures = new Map<string, number[]>();
  private readonly windowMs = SETTINGS.loginRateLimit.windowMinutes * 60_000;

  private key(req: Request) {
    return req.ip ?? 'unknown';
  }

  private recent(key: string, now: number) {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.failures.set(key, list);
    return list;
  }

  /** Middleware à placer avant la route de connexion. */
  guard(): RequestHandler {
    return (req, res, next) => {
      const list = this.recent(this.key(req), Date.now());
      if (list.length >= SETTINGS.loginRateLimit.max) {
        const retry = Math.ceil((list[0]! + this.windowMs - Date.now()) / 1000);
        res.setHeader('Retry-After', String(retry));
        res.status(429).json({
          error: 'TOO_MANY_REQUESTS',
          message: localize(
            bi('Trop de tentatives de connexion. Réessayez dans quelques minutes.', 'Too many sign-in attempts. Try again in a few minutes.'),
            requestLang(req),
          ),
        });
        return;
      }
      next();
    };
  }

  fail(req: Request) {
    const key = this.key(req);
    this.recent(key, Date.now()).push(Date.now());
  }

  succeed(req: Request) {
    this.failures.delete(this.key(req));
  }

  reset() {
    this.failures.clear();
  }
}
