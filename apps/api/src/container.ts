import type { Env } from './config/env';
import { createPrismaClient, type PrismaClient } from './db';
import { ConsoleMailer } from './adapters/console-mailer';
import { LocalAuthProvider } from './adapters/local-auth';
import { LocalFileStorage } from './adapters/local-storage';
import { S3FileStorage } from './adapters/s3-storage';
import { SesMailer } from './adapters/ses-mailer';
import { SessionService } from './http/session';
import type { AuthProvider } from './ports/auth';
import type { FileStorage } from './ports/file-storage';
import type { Mailer } from './ports/mailer';
import { LiveHub } from './realtime/hub';
import { AdminService } from './services/admin';
import { AuditService } from './services/audit';
import { IncidentService } from './services/incidents';
import { NotificationService } from './services/notifications';
import { WorkflowService } from './services/workflow';

/**
 * Racine de composition : SEUL endroit qui choisit les implémentations des ports
 * selon les variables d'environnement (AUTH_PROVIDER, STORAGE_DRIVER, MAIL_DRIVER, KB_DRIVER, AI_DRIVER).
 */
export interface Container {
  env: Env;
  prisma: PrismaClient;
  auth: AuthProvider;
  sessions: SessionService;
  storage: FileStorage;
  mailer: Mailer;
  hub: LiveHub;
  notifications: NotificationService;
  audit: AuditService;
  incidents: IncidentService;
  workflow: WorkflowService;
  admin: AdminService;
  /** Nom de l'implémentation active par port (affiché par /api/health). */
  adapterNames: Record<string, string>;
  dispose(): Promise<void>;
}

export function createContainer(env: Env): Container {
  const prisma = createPrismaClient(env.DATABASE_URL);
  const auth = new LocalAuthProvider(prisma);
  const storage: FileStorage =
    env.STORAGE_DRIVER === 's3' ? new S3FileStorage(env.S3_BUCKET!, env.AWS_REGION) : new LocalFileStorage(env.UPLOAD_DIR);
  const mailer: Mailer =
    env.MAIL_DRIVER === 'ses'
      ? new SesMailer(env.MAIL_FROM, env.AWS_REGION)
      : new ConsoleMailer(env.MAIL_OUTBOX_DIR, env.MAIL_FROM, env.NODE_ENV === 'test');

  const hub = new LiveHub();
  const notifications = new NotificationService(prisma, mailer, hub, env.APP_URL);
  const audit = new AuditService(prisma);
  const incidents = new IncidentService(prisma, storage, notifications, hub);

  return {
    env,
    prisma,
    auth,
    sessions: new SessionService(env),
    storage,
    mailer,
    hub,
    notifications,
    audit,
    incidents,
    workflow: new WorkflowService(prisma, incidents, notifications, audit, hub),
    admin: new AdminService(prisma),
    adapterNames: { database: 'postgresql', auth: auth.name, storage: storage.name, mail: mailer.name },
    dispose: () => prisma.$disconnect(),
  };
}
