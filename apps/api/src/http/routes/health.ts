import { Router } from 'express';
import type { HealthResponse } from '@smartcampus/shared';
import type { Container } from '../../container';
import { isDatabaseReachable } from '../../db';

export function healthRouter(container: Container): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const dbOk = await isDatabaseReachable(container.prisma);
    const body: HealthResponse = {
      status: dbOk ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '0.0.0',
      database: dbOk ? 'ok' : 'error',
      adapters: container.adapterNames,
      realtime: { mode: container.env.REALTIME_MODE, pollSeconds: container.env.POLL_SECONDS },
    };
    res.status(dbOk ? 200 : 503).json(body);
  });

  return router;
}
