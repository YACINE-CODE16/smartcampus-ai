import { Router } from 'express';
import type { Container } from '../../container';
import { currentUser } from '../middlewares/auth';

/** Flux temps réel (SSE) de l'utilisateur connecté : changements de tickets, notifications, alertes. */
export function eventsRouter(container: Container): Router {
  const router = Router();
  router.get('/', (req, res) => {
    container.hub.attach(currentUser(req), res);
  });
  return router;
}
