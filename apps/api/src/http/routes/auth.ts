import { Router } from 'express';
import { z } from 'zod';
import type { DemoAccount } from '@smartcampus/shared';
import type { Container } from '../../container';
import { UnauthorizedError } from '../../domain/errors';
import { currentUser, requireAuth } from '../middlewares/auth';
import { parseBody } from '../validation';

const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
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

  router.post('/login', async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await container.auth.authenticate(email, password);
    if (!user) throw new UnauthorizedError('Email ou mot de passe incorrect.');
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
