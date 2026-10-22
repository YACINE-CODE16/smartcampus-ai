import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { INCIDENT_STATUSES, SETTINGS, URGENCIES, type IncidentListQuery, type Referentials } from '@smartcampus/shared';
import type { Container } from '../../container';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { currentUser, requireAuth, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';

const PHOTO_ERROR = `Photo JPG ou PNG de ${SETTINGS.maxPhotoMb} Mo maximum`;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SETTINGS.maxPhotoMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (SETTINGS.acceptedPhotoTypes.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError('Certains champs sont invalides.', { photo: PHOTO_ERROR }));
  },
});

/** Traduit les erreurs multer (taille, nombre de fichiers) en erreur de validation sur le champ photo. */
const photoUpload: RequestHandler = (req, res, next) => {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) return next(new ValidationError('Certains champs sont invalides.', { photo: PHOTO_ERROR }));
    next(err);
  });
};

const createSchema = z.object({
  categoryId: z.uuid({ error: 'Choisissez un type' }),
  buildingId: z.uuid({ error: 'Choisissez un bâtiment' }),
  room: z
    .string({ error: 'La salle est obligatoire' })
    .trim().min(1, 'La salle est obligatoire').max(SETTINGS.room.max, 'Salle trop longue'),
  description: z
    .string({ error: 'La description est obligatoire' })
    .trim()
    .min(1, 'La description est obligatoire')
    .min(SETTINGS.description.min, `Au moins ${SETTINGS.description.min} caractères`)
    .max(SETTINGS.description.max, `${SETTINGS.description.max} caractères maximum`),
  urgency: z.enum(URGENCIES).default('NORMALE'),
});

const listSchema = z.object({
  scope: z.enum(['mine', 'unassigned']).optional(),
  status: z.enum(INCIDENT_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  buildingId: z.uuid().optional(),
  assignedToId: z.uuid().optional(),
}) satisfies z.ZodType<IncidentListQuery>;

const idParam = z.uuid();
function parseId(raw: string | string[] | undefined): string {
  const result = idParam.safeParse(raw);
  if (!result.success) throw new NotFoundError('Ticket introuvable.');
  return result.data;
}

export function incidentsRouter(container: Container): Router {
  const router = Router();
  const service = container.incidents;
  router.use(requireAuth(container));

  router.get('/referentials', async (_req, res) => {
    const body: Referentials = await service.referentials();
    res.json(body);
  });

  router.post('/incidents', requireRole('STUDENT'), photoUpload, async (req, res) => {
    const input = parseBody(createSchema, req.body);
    const photo = req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : undefined;
    const created = await service.create(currentUser(req), input, photo);
    res.status(201).json(created);
  });

  router.get('/incidents', async (req, res) => {
    const query = parseBody(listSchema, req.query);
    res.json(await service.list(currentUser(req), query));
  });

  router.get('/incidents/:id', async (req, res) => {
    res.json(await service.get(currentUser(req), parseId(req.params.id)));
  });

  router.get('/incidents/:id/photo', async (req, res) => {
    const file = await service.photo(currentUser(req), parseId(req.params.id));
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    file.body.pipe(res);
  });

  return router;
}
