import { Router } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, bi, DASHBOARD_PERIODS, GRANULARITIES, ROLES, SETTINGS } from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError } from '../../domain/errors';
import { requestLang } from '../lang';
import { currentUser, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';
import { listSchema } from './incidents';

const dashboardSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('30d'),
  granularity: z.enum(GRANULARITIES).default('day'),
});

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

  router.get('/admin/dashboard', async (req, res) => {
    const { period, granularity } = parseBody(dashboardSchema, req.query);
    res.json(await container.dashboard.get(period, granularity));
  });

  /** US-27 : export CSV des tickets filtrés, tracé dans le journal d'audit. */
  router.get('/admin/incidents/export.csv', async (req, res) => {
    const { csv } = await container.exports.incidentsCsv(currentUser(req), parseBody(listSchema, req.query), requestLang(req));
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="smartcampus-tickets-${date}.csv"`);
    res.send(csv);
  });

  /** US-02 : comptes et rôles. */
  router.get('/admin/users', async (req, res) => {
    const { q } = parseBody(z.object({ q: z.string().max(100).optional() }), req.query);
    res.json(await container.users.list(q));
  });

  router.patch('/admin/users/:id/role', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new NotFoundError();
    const { role } = parseBody(z.object({ role: z.enum(ROLES, { error: bi('Rôle inconnu', 'Unknown role') }) }), req.body);
    res.json(await container.users.setRole(currentUser(req), id.data, role));
  });

  /** US-34 : suppression des données d'un étudiant (confirmation par saisie de son email). */
  router.post('/admin/users/:id/erase', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new NotFoundError();
    const { confirmEmail } = parseBody(z.object({ confirmEmail: z.string({ error: bi('Email requis', 'Email required') }) }), req.body);
    res.json(await container.users.erase(currentUser(req), id.data, confirmEmail));
  });

  /** US-37 : journal des actions sensibles (lecture seule, aucune route de modification). */
  router.get('/admin/audit', async (req, res) => {
    const { action } = parseBody(z.object({ action: z.enum(AUDIT_ACTIONS).optional() }), req.query);
    res.json(await container.admin.auditLog(action));
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
