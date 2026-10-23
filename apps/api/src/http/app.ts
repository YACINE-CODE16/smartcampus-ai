import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { localize, type ApiError } from '@smartcampus/shared';
import type { Container } from '../container';
import { DomainError } from '../domain/errors';
import { requestLang } from './lang';
import { securityHeaders } from './security';
import { requireAuth } from './middlewares/auth';
import { auditRouter, dashboardRouter, privacyRouter, slaRouter, usersRouter } from './routes/admin';
import { assistantRouter, knowledgeRouter } from './routes/assistant';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { filesRouter } from './routes/files';
import { healthRouter } from './routes/health';
import { incidentsRouter } from './routes/incidents';
import { notificationsRouter } from './routes/notifications';

const STATUS_BY_CODE: Record<DomainError['code'], number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/** US-36 : toute requête API au-delà de ce seuil est signalée dans les logs (temps de réponse). */
const SLOW_REQUEST_MS = 2000;

export function createApp(container: Container) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // derrière CloudFront + API Gateway (ou un reverse proxy)
  app.use(securityHeaders(container.env.COOKIE_SECURE));
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

  // Préfixes alignés sur le routage API Gateway → Lambdas (template.yaml) :
  //  Incidents : incidents, drafts, sla, users, notifications, audit, privacy, auth
  //  Dashboard : dashboard · Assistant : assistant, knowledge · Fichiers : files
  app.use('/api/health', healthRouter(container));
  app.use('/api/auth', authRouter(container));
  app.use('/api/files', filesRouter(container)); // gère lui-même l'authentification (jetons d'envoi locaux)

  // Toutes les routes suivantes exigent une session valide.
  app.use('/api', requireAuth(container));
  app.use('/api', incidentsRouter(container)); // /incidents*, /drafts*
  app.use('/api/notifications', notificationsRouter(container));
  app.use('/api/users', usersRouter(container));
  app.use('/api/privacy', privacyRouter(container));
  app.use('/api/sla', slaRouter(container));
  app.use('/api/audit', auditRouter(container));
  app.use('/api/dashboard', dashboardRouter(container));
  app.use('/api/assistant', assistantRouter(container));
  app.use('/api/knowledge', knowledgeRouter(container));
  if (container.env.REALTIME_MODE === 'sse') app.use('/api/events', eventsRouter(container));

  app.use('/api', (req, res) => {
    const body: ApiError = { error: 'NOT_FOUND', message: requestLang(req) === 'en' ? 'Unknown route.' : 'Route inconnue.' };
    res.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const lang = requestLang(req);
    if (err instanceof DomainError) {
      const fields = err.fields ? Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, localize(v, lang)])) : undefined;
      const body: ApiError = { error: err.code, message: localize(err.message, lang), fields };
      res.status(STATUS_BY_CODE[err.code]).json(body);
      return;
    }
    console.error(err);
    const body: ApiError = { error: 'INTERNAL', message: lang === 'en' ? 'Internal server error.' : 'Erreur interne du serveur.' };
    res.status(500).json(body);
  };
  app.use(errorHandler);

  return app;
}
