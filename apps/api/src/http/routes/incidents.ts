import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  bi,
  INCIDENT_STATUSES,
  PRIORITIES,
  SETTINGS,
  URGENCIES,
  type IncidentListQuery,
  type Referentials,
} from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { currentUser, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';

const PHOTO_ERROR = bi(`Photo JPG ou PNG de ${SETTINGS.maxPhotoMb} Mo maximum`, `JPG or PNG photo, ${SETTINGS.maxPhotoMb} MB max`);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SETTINGS.maxPhotoMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (SETTINGS.acceptedPhotoTypes.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError(undefined, { photo: PHOTO_ERROR }));
  },
});

/** Traduit les erreurs multer (taille, nombre de fichiers) en erreur de validation sur le champ photo. */
const photoUpload: RequestHandler = (req, res, next) => {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return next(new ValidationError(undefined, { photo: PHOTO_ERROR }));
    next(err);
  });
};

const createSchema = z.object({
  categoryId: z.uuid({ error: bi('Choisissez un type', 'Choose a type') }),
  buildingId: z.uuid({ error: bi('Choisissez un bâtiment', 'Choose a building') }),
  room: z
    .string({ error: bi('La salle est obligatoire', 'Room is required') })
    .trim()
    .min(1, bi('La salle est obligatoire', 'Room is required'))
    .max(SETTINGS.room.max, bi('Salle trop longue', 'Room is too long')),
  description: z
    .string({ error: bi('La description est obligatoire', 'Description is required') })
    .trim()
    .min(1, bi('La description est obligatoire', 'Description is required'))
    .min(SETTINGS.description.min, bi(`Au moins ${SETTINGS.description.min} caractères`, `At least ${SETTINGS.description.min} characters`))
    .max(SETTINGS.description.max, bi(`${SETTINGS.description.max} caractères maximum`, `${SETTINGS.description.max} characters max`)),
  urgency: z.enum(URGENCIES).default('NORMALE'),
  assistantInteractionId: z.uuid().optional(),
});

export const listSchema = z.object({
  scope: z.enum(['mine', 'unassigned']).optional(),
  status: z.enum(INCIDENT_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  buildingId: z.uuid().optional(),
  assignedToId: z.uuid().optional(),
  priority: z.enum(PRIORITIES).optional(),
  late: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().trim().max(100).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
}) satisfies z.ZodType<IncidentListQuery>;

const transitionSchema = z.object({
  to: z.enum(INCIDENT_STATUSES),
  comment: z.string().max(SETTINGS.comment.max, bi('Commentaire trop long', 'Comment is too long')).optional(),
  reason: z.string().max(SETTINGS.reason.max, bi('Motif trop long', 'Reason is too long')).optional(),
});

const requalifySchema = z
  .object({ categoryId: z.uuid().optional(), urgency: z.enum(URGENCIES).optional() })
  .refine((v) => v.categoryId || v.urgency, { message: bi('Rien à modifier', 'Nothing to change') });

const mergeSchema = z.object({
  /** Accepte `SC-0009`, `sc9` ou `9`. */
  target: z
    .string({ error: bi('Numéro du ticket principal requis', 'Main ticket number required') })
    .trim()
    .transform((v) => Number(v.replace(/^sc-?/i, '')))
    .pipe(z.number({ error: bi('Numéro invalide', 'Invalid number') }).int(bi('Numéro invalide', 'Invalid number')).positive(bi('Numéro invalide', 'Invalid number'))),
});

const noteSchema = z.object({
  body: z
    .string({ error: bi('La note est vide', 'The note is empty') })
    .trim()
    .min(1, bi('La note est vide', 'The note is empty'))
    .max(SETTINGS.note.max, bi('Note trop longue', 'Note is too long')),
});

const ratingSchema = z.object({
  score: z.coerce.number().int().min(1, bi('Note de 1 à 5', 'Score from 1 to 5')).max(5, bi('Note de 1 à 5', 'Score from 1 to 5')),
  comment: z.string().max(SETTINGS.ratingComment.max, bi('Commentaire trop long', 'Comment is too long')).optional(),
});

const similarSchema = z.object({ categoryId: z.uuid(), buildingId: z.uuid() });

const idParam = z.uuid();
function parseId(raw: string | string[] | undefined): string {
  const result = idParam.safeParse(raw);
  if (!result.success) throw new NotFoundError(bi('Ticket introuvable.', 'Ticket not found.'));
  return result.data;
}

export function incidentsRouter(container: Container): Router {
  const router = Router();
  const { incidents, workflow } = container;

  router.get('/referentials', async (_req, res) => {
    const body: Referentials = await incidents.referentials();
    res.json(body);
  });

  router.post('/incidents', requireRole('STUDENT'), photoUpload, async (req, res) => {
    const input = parseBody(createSchema, req.body);
    const photo = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined;
    res.status(201).json(await incidents.create(currentUser(req), input, photo));
  });

  router.get('/incidents', async (req, res) => {
    res.json(await incidents.list(currentUser(req), parseBody(listSchema, req.query)));
  });

  // US-06 : doit précéder `/incidents/:id`.
  router.get('/incidents/similar', requireRole('STUDENT'), async (req, res) => {
    const { categoryId, buildingId } = parseBody(similarSchema, req.query);
    res.json(await incidents.similar(categoryId, buildingId));
  });

  router.get('/incidents/:id', async (req, res) => {
    res.json(await incidents.get(currentUser(req), parseId(req.params.id)));
  });

  router.get('/incidents/:id/photo', async (req, res) => {
    const file = await incidents.photo(currentUser(req), parseId(req.params.id));
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    file.body.pipe(res);
  });

  router.post('/incidents/:id/take', requireRole('AGENT', 'ADMIN'), async (req, res) => {
    res.json(await workflow.take(currentUser(req), parseId(req.params.id)));
  });

  router.post('/incidents/:id/transition', async (req, res) => {
    res.json(await workflow.transition(currentUser(req), parseId(req.params.id), parseBody(transitionSchema, req.body)));
  });

  router.post('/incidents/:id/assign', requireRole('ADMIN'), async (req, res) => {
    const { agentId } = parseBody(z.object({ agentId: z.uuid({ error: bi('Choisissez un agent', 'Choose an agent') }) }), req.body);
    res.json(await workflow.assign(currentUser(req), parseId(req.params.id), agentId));
  });

  router.patch('/incidents/:id', requireRole('AGENT', 'ADMIN'), async (req, res) => {
    res.json(await workflow.requalify(currentUser(req), parseId(req.params.id), parseBody(requalifySchema, req.body)));
  });

  router.post('/incidents/:id/merge', requireRole('AGENT', 'ADMIN'), async (req, res) => {
    const { target } = parseBody(mergeSchema, req.body);
    res.json(await workflow.merge(currentUser(req), parseId(req.params.id), target));
  });

  router.get('/incidents/:id/notes', async (req, res) => {
    res.json(await workflow.listNotes(currentUser(req), parseId(req.params.id)));
  });

  router.post('/incidents/:id/notes', requireRole('AGENT', 'ADMIN'), async (req, res) => {
    const { body } = parseBody(noteSchema, req.body);
    res.status(201).json(await workflow.addNote(currentUser(req), parseId(req.params.id), body));
  });

  router.post('/incidents/:id/rating', requireRole('STUDENT'), async (req, res) => {
    const { score, comment } = parseBody(ratingSchema, req.body);
    res.status(201).json(await workflow.rate(currentUser(req), parseId(req.params.id), score, comment));
  });

  return router;
}
