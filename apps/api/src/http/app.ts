import express, { type ErrorRequestHandler } from 'express';
import type { ApiError } from '@smartcampus/shared';
import type { Container } from '../container';
import { DomainError } from '../domain/errors';
import { healthRouter } from './routes/health';

const STATUS_BY_CODE: Record<DomainError['code'], number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export function createApp(container: Container) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter(container));

  app.use('/api', (_req, res) => {
    const body: ApiError = { error: 'NOT_FOUND', message: 'Route inconnue.' };
    res.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof DomainError) {
      const body: ApiError = { error: err.code, message: err.message };
      res.status(STATUS_BY_CODE[err.code]).json(body);
      return;
    }
    console.error(err);
    const body: ApiError = { error: 'INTERNAL', message: 'Erreur interne du serveur.' };
    res.status(500).json(body);
  };
  app.use(errorHandler);

  return app;
}
