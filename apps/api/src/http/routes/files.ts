import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { bi, SETTINGS } from '@smartcampus/shared';
import { LocalFileStorage } from '../../adapters/local-storage';
import type { Container } from '../../container';
import { NotFoundError, ValidationError } from '../../domain/errors';
import { currentUser, requireAuth, requireRole } from '../middlewares/auth';
import { parseBody } from '../validation';

const uploadSchema = z.object({
  contentType: z.string().max(100),
  size: z.coerce.number().int().positive(),
});

/**
 * US-04 : pièces jointes (Lambda Fichiers en production).
 *  POST /api/files/uploads         → URL d'envoi direct (S3 présigné, ou jeton signé en local)
 *  GET  /api/files/incidents/:id   → URL de lecture à courte durée, si l'utilisateur peut voir le ticket
 */
export function filesRouter(container: Container): Router {
  const router = Router();

  // Mode local uniquement : ces deux routes jouent le rôle de S3 (autorisation par jeton signé, sans session).
  if (container.storage instanceof LocalFileStorage) {
    const storage = container.storage;
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SETTINGS.maxPhotoMb * 1024 * 1024, files: 1 } });

    router.post('/local/upload', (req, res, next) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err) return next(new ValidationError(undefined, { photo: bi('Fichier de 10 Mo maximum', 'File 10 MB max') }));
        const token = storage.verify(String(req.body?.token ?? ''), 'upload');
        if (!token || !req.file || req.file.size > (token.maxBytes ?? 0)) {
          return next(new ValidationError(undefined, { photo: bi('Envoi refusé', 'Upload refused') }));
        }
        storage.put(token.key, req.file.buffer).then(() => res.status(204).end(), next);
      });
    });

    router.get('/local/download', async (req, res) => {
      const token = storage.verify(String(req.query.token ?? ''), 'read');
      const file = token ? await storage.get(token.key) : null;
      if (!file) throw new NotFoundError();
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      file.body.pipe(res);
    });
  }

  router.use(requireAuth(container));

  router.post('/uploads', requireRole('STUDENT'), async (req, res) => {
    const { contentType, size } = parseBody(uploadSchema, req.body);
    res.status(201).json(await container.incidents.requestUpload(contentType, size));
  });

  router.get('/incidents/:id', async (req, res) => {
    const id = z.uuid().safeParse(req.params.id);
    if (!id.success) throw new NotFoundError();
    res.json(await container.incidents.attachmentUrl(currentUser(req), id.data));
  });

  return router;
}
