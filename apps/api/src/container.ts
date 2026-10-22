import type { Env } from './config/env';
import { createPrismaClient, type PrismaClient } from './db';
import { LocalAuthProvider } from './adapters/local-auth';
import { SessionService } from './http/session';
import type { AuthProvider } from './ports/auth';

/**
 * Racine de composition : SEUL endroit qui choisit les implémentations des ports
 * selon les variables d'environnement (AUTH_PROVIDER, STORAGE_DRIVER, AI_DRIVER).
 */
export interface Container {
  env: Env;
  prisma: PrismaClient;
  auth: AuthProvider;
  sessions: SessionService;
  /** Nom de l'implémentation active par port (affiché par /api/health). */
  adapterNames: Record<string, string>;
  dispose(): Promise<void>;
}

export function createContainer(env: Env): Container {
  const prisma = createPrismaClient(env.DATABASE_URL);
  const auth = new LocalAuthProvider(prisma);

  return {
    env,
    prisma,
    auth,
    sessions: new SessionService(env),
    adapterNames: { database: 'postgresql', auth: auth.name },
    dispose: () => prisma.$disconnect(),
  };
}
