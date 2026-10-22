import { Router } from 'express';
import type { HealthResponse } from '@smartcampus/shared';
import { isDatabaseReachable } from '../../adapters/local/prisma';
import type { Container } from '../../container';

export function healthRouter(container: Container): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const dbOk = await isDatabaseReachable(container.prisma);
    const body: HealthResponse = {
      status: dbOk ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '0.0.0',
      mode: container.env.ADAPTERS_MODE,
      database: dbOk ? 'ok' : 'error',
      adapters: container.adapterNames,
    };
    res.status(dbOk ? 200 : 503).json(body);
  });

  return router;
}
