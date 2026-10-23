import { Router, type Response } from 'express';
import { z } from 'zod';
import { AUDIT_ACTIONS, bi, DASHBOARD_PERIODS, GRANULARITIES, ROLES, SETTINGS } from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError } from '../../domain/errors';
import { periodStart } from '../../services/dashboard';
import { requestLang } from '../lang';
import { currentUser, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';
import { listSchema } from './incidents';

/*
 * Routes d'administration, découpées par préfixe comme dans l'architecture AWS
 * (chaque préfixe est routé vers sa Lambda par API Gateway) :
 *   /api/users, /api/privacy, /api/sla, /api/audit  → Lambda Incidents
 *   /api/dashboard                                 → Lambda Dashboard
 */

const dashboardSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('30d'),
  granularity: z.enum(GRANULARITIES).default('day'),
  categoryId: z.uuid().optional(),
  buildingId: z.uuid().optional(),
});

const targetSchema = z.object({
  targetHours: z.coerce
    .number()
    .int(bi('Nombre entier d’heures', 'Whole number of hours'))
    .min(SETTINGS.targetHours.min, bi(`Entre ${SETTINGS.targetHours.min} et ${SETTINGS.targetHours.max} h`, `Between ${SETTINGS.targetHours.min} and ${SETTINGS.targetHours.max} h`))
    .max(SETTINGS.targetHours.max, bi(`Entre ${SETTINGS.targetHours.min} et ${SETTINGS.targetHours.max} h`, `Between ${SETTINGS.targetHours.min} and ${SETTINGS.targetHours.max} h`)),
});

function uuidParam(raw: unknown): string {
  const id = z.uuid().safeParse(raw);
  if (!id.success) throw new NotFoundError();
  return id.data;
}

function sendCsv(res: Response, csv: string, name: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}

/** US-02 : comptes, rôles et agents assignables (US-13). */
export function usersRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('ADMIN'));

  router.get('/', async (req, res) => {
    const { q } = parseBody(z.object({ q: z.string().max(100).optional() }), req.query);
    res.json(await container.users.list(q));
  });

  router.get('/agents', async (_req, res) => {
    res.json(await container.admin.agents());
  });

  router.patch('/:id/role', async (req, res) => {
    const { role } = parseBody(z.object({ role: z.enum(ROLES, { error: bi('Rôle inconnu', 'Unknown role') }) }), req.body);
    res.json(await container.users.setRole(currentUser(req), uuidParam(req.params.id), role));
  });

  return router;
}

/** US-34 : suppression des données d'un étudiant sur demande (confirmation par saisie de son email). */
export function privacyRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('ADMIN'));
  router.post('/users/:id/erase', async (req, res) => {
    const { confirmEmail } = parseBody(z.object({ confirmEmail: z.string({ error: bi('Email requis', 'Email required') }) }), req.body);
    res.json(await container.users.erase(currentUser(req), uuidParam(req.params.id), confirmEmail));
  });
  return router;
}

/** US-18 : délais cibles par catégorie et alertes (critiques, retards). */
export function slaRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('ADMIN'));

  router.get('/alerts', async (_req, res) => {
    res.json(await container.admin.alerts());
  });

  router.get('/categories', async (_req, res) => {
    res.json(await container.admin.categories());
  });

  router.patch('/categories/:id', async (req, res) => {
    const { targetHours } = parseBody(targetSchema, req.body);
    res.json(await container.admin.setTargetHours(uuidParam(req.params.id), targetHours));
  });

  return router;
}

/** US-37 : journal des actions sensibles (lecture seule, aucune route de modification). */
export function auditRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('ADMIN'));
  router.get('/', async (req, res) => {
    const { action } = parseBody(z.object({ action: z.enum(AUDIT_ACTIONS).optional() }), req.query);
    res.json(await container.admin.auditLog(action));
  });
  return router;
}

/** US-27 à US-33 : tableau de bord, filtres et exports. */
export function dashboardRouter(container: Container): Router {
  const router = Router();
  router.use(requireRole('ADMIN'));

  router.get('/', async (req, res) => {
    const { period, granularity, categoryId, buildingId } = parseBody(dashboardSchema, req.query);
    res.json(await container.dashboard.get(period, granularity, { categoryId, buildingId }));
  });

  /** US-33 : export CSV des tickets correspondant aux filtres du tableau de bord (tracé dans l'audit). */
  router.get('/export.csv', async (req, res) => {
    const { period, categoryId, buildingId } = parseBody(dashboardSchema, req.query);
    const from = periodStart(period);
    const { csv } = await container.exports.incidentsCsv(currentUser(req), { categoryId, buildingId, from: from?.toISOString() }, requestLang(req));
    sendCsv(res, csv, 'smartcampus-tableau-de-bord');
  });

  /** US-33 : export CSV de la liste filtrée des tickets (mêmes filtres que la liste admin). */
  router.get('/incidents.csv', async (req, res) => {
    const { csv } = await container.exports.incidentsCsv(currentUser(req), parseBody(listSchema, req.query), requestLang(req));
    sendCsv(res, csv, 'smartcampus-tickets');
  });

  return router;
}
