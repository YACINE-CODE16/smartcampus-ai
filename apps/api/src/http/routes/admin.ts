import { Router } from 'express';
import { z } from 'zod';
import { bi, SETTINGS } from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError } from '../../domain/errors';
import { requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';

const targetSchema = z.object({
  targetHours: z.coerce
    .number()
    .int(bi('Nombre entier d’heures', 'Whole number of hours'))
    .min(SETTINGS.targetHours.min, bi(`Entre ${SETTINGS.targetHours.min} et ${SETTINGS.targetHours.max} h`, `Between ${SETTINGS.targetHours.min} and ${SETTINGS.targetHours.max} h`))
    .max(SETTINGS.targetHours.max, bi(`Entre ${SETTINGS.targetHours.min} et ${SETTINGS.targetHours.max} h`, `Between ${SETTINGS.targetHours.min} and ${SETTINGS.targetHours.max} h`)),
});

/** Routes réservées à l'administration (US-13, US-18 ; enrichies par les blocs suivants). */
export function adminRouter(container: Container): Router {
  const router = Router();
  const { admin } = container;
  router.use(['/agents', '/admin'], requireRole('ADMIN'));

  router.get('/agents', async (_req, res) => {
    res.json(await admin.agents());
  });

  router.get('/admin/alerts', async (_req, res) => {
    res.json(await admin.alerts());
  });

  router.get('/admin/categories', async (_req, res) => {
    res.json(await admin.categories());
  });

  router.patch('/admin/categories/:id', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new NotFoundError();
    const { targetHours } = parseBody(targetSchema, req.body);
    res.json(await admin.setTargetHours(id.data, targetHours));
  });

  return router;
}
