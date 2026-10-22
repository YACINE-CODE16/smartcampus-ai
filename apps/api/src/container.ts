import type { Env } from './config/env';
import { createPrismaClient, type PrismaClient } from './db';
import { LocalAuthProvider } from './adapters/local-auth';
import { LocalFileStorage } from './adapters/local-storage';
import { S3FileStorage } from './adapters/s3-storage';
import { SessionService } from './http/session';
import type { AuthProvider } from './ports/auth';
import type { FileStorage } from './ports/file-storage';
import { IncidentService } from './services/incidents';

/**
 * Racine de composition : SEUL endroit qui choisit les implémentations des ports
 * selon les variables d'environnement (AUTH_PROVIDER, STORAGE_DRIVER, AI_DRIVER).
 */
export interface Container {
  env: Env;
  prisma: PrismaClient;
  auth: AuthProvider;
  sessions: SessionService;
  storage: FileStorage;
  incidents: IncidentService;
  /** Nom de l'implémentation active par port (affiché par /api/health). */
  adapterNames: Record<string, string>;
  dispose(): Promise<void>;
}

export function createContainer(env: Env): Container {
  const prisma = createPrismaClient(env.DATABASE_URL);
  const auth = new LocalAuthProvider(prisma);
  const storage: FileStorage =
    env.STORAGE_DRIVER === 's3' ? new S3FileStorage(env.S3_BUCKET!, env.AWS_REGION) : new LocalFileStorage(env.UPLOAD_DIR);

  return {
    env,
    prisma,
    auth,
    sessions: new SessionService(env),
    storage,
    incidents: new IncidentService(prisma, storage),
    adapterNames: { database: 'postgresql', auth: auth.name, storage: storage.name },
    dispose: () => prisma.$disconnect(),
  };
}
