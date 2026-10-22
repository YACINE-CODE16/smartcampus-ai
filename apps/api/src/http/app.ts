import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import type { ApiError } from '@smartcampus/shared';
import type { Container } from '../container';
import { DomainError } from '../domain/errors';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';

const STATUS_BY_CODE: Record<DomainError['code'], number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/** NFR-2 : toute requête API au-delà de ce seuil est signalée dans les logs. */
const SLOW_REQUEST_MS = 2000;

export function createApp(container: Container) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière Traefik en production
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', (req, res, next) => {
    const start = performance.now();
    res.on('finish', () => {
      const ms = Math.round(performance.now() - start);
      if (ms > SLOW_REQUEST_MS) console.warn(`[lent] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms} ms`);
      else if (container.env.NODE_ENV !== 'test') console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms} ms`);
    });
    next();
  });

  app.use('/api/health', healthRouter(container));
  app.use('/api/auth', authRouter(container));

  app.use('/api', (_req, res) => {
    const body: ApiError = { error: 'NOT_FOUND', message: 'Route inconnue.' };
    res.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof DomainError) {
      const body: ApiError = { error: err.code, message: err.message, fields: err.fields };
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
