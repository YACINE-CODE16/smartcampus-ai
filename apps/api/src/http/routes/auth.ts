import { Router } from 'express';
import { z } from 'zod';
import { bi, LANGS, type DemoAccount } from '@smartcampus/shared';
import type { Container } from '../../container';
import { UnauthorizedError } from '../../domain/errors';
import { currentUser, requireAuth } from '../middlewares/auth';
import { parseBody } from '../validation';

const loginSchema = z.object({
  email: z.email({ error: bi('Email invalide', 'Invalid email') }),
  password: z.string({ error: bi('Mot de passe requis', 'Password required') }).min(1, bi('Mot de passe requis', 'Password required')),
});

/** Comptes de démo affichés sur la page de connexion (les adresses sont publiques dans DEMO.md). */
const DEMO_EMAILS = [
  'alice.martin@esiea.fr',
  'bob.durand@esiea.fr',
  'karim.benali@esiea.fr',
  'julie.robert@esiea.fr',
  'claire.moreau@esiea.fr',
];

export function authRouter(container: Container): Router {
  const router = Router();

  router.post('/login', container.loginLimiter.guard(), async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await container.auth.authenticate(email, password);
    if (!user) {
      container.loginLimiter.fail(req);
      throw new UnauthorizedError(bi('Email ou mot de passe incorrect.', 'Incorrect email or password.'));
    }
    container.loginLimiter.succeed(req);
    await container.sessions.issue(res, user);
    res.json(user);
  });

  router.post('/logout', (_req, res) => {
    container.sessions.clear(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth(container), (req, res) => {
    res.json(currentUser(req));
  });

  /** US-38 : langue préférée (interface et emails). */
  router.patch('/me', requireAuth(container), async (req, res) => {
    const { locale } = parseBody(z.object({ locale: z.enum(LANGS) }), req.body);
    const user = currentUser(req);
    await container.prisma.user.update({ where: { id: user.id }, data: { locale } });
    res.json({ ...user, locale });
  });

  router.get('/demo-accounts', async (_req, res) => {
    if (!container.env.DEMO_MODE) {
      res.json({ accounts: [], password: null });
      return;
    }
    const users = await container.prisma.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      select: { email: true, name: true, role: true },
    });
    const accounts: DemoAccount[] = DEMO_EMAILS.flatMap((e) => users.filter((u) => u.email === e));
    res.json({ accounts, password: container.env.DEMO_PASSWORD });
  });

  return router;
}
