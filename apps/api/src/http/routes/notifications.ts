import { Router } from 'express';
import { z } from 'zod';
import type { Container } from '../../container';
import { currentUser } from '../middlewares/auth';

/** US-10 : notifications de l'utilisateur connecté. */
export function notificationsRouter(container: Container): Router {
  const router = Router();
  const service = container.notifications;

  router.get('/', async (req, res) => {
    res.json(await service.list(currentUser(req).id));
  });

  router.post('/read-all', async (req, res) => {
    res.json({ unread: await service.markRead(currentUser(req).id) });
  });

  router.post('/:id/read', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    res.json({ unread: id.success ? await service.markRead(currentUser(req).id, id.data) : await service.unreadCount(currentUser(req).id) });
  });

  return router;
}
