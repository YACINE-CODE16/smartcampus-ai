import type { Env } from './config/env';
import { createPrismaClient, type PrismaClient } from './db';
import { BedrockAiAssistant } from './adapters/bedrock-assistant';
import { BedrockKnowledgeBase, CompositeKnowledgeBase } from './adapters/bedrock-knowledge-base';
import { ConsoleMailer } from './adapters/console-mailer';
import { LocalAuthProvider } from './adapters/local-auth';
import { LocalFileStorage } from './adapters/local-storage';
import { LocalKnowledgeBase } from './adapters/local-knowledge-base';
import { MockAiAssistant } from './adapters/mock-assistant';
import { S3FileStorage } from './adapters/s3-storage';
import { SesMailer } from './adapters/ses-mailer';
import { LoginLimiter } from './http/security';
import { SessionService } from './http/session';
import type { AiAssistant } from './ports/ai-assistant';
import type { AuthProvider } from './ports/auth';
import type { FileStorage } from './ports/file-storage';
import type { KnowledgeBase } from './ports/knowledge-base';
import type { Mailer } from './ports/mailer';
import { LiveHub } from './realtime/hub';
import { AdminService } from './services/admin';
import { AssistantService } from './services/assistant/assistant-service';
import { AuditService } from './services/audit';
import { DashboardService } from './services/dashboard';
import { ExportService } from './services/export';
import { IncidentService } from './services/incidents';
import { KnowledgeAdminService } from './services/knowledge-admin';
import { NotificationService } from './services/notifications';
import { UserAdminService } from './services/users';
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
  loginLimiter: LoginLimiter;
  storage: FileStorage;
  mailer: Mailer;
  hub: LiveHub;
  notifications: NotificationService;
  audit: AuditService;
  incidents: IncidentService;
  workflow: WorkflowService;
  admin: AdminService;
  dashboard: DashboardService;
  exports: ExportService;
  assistant: AssistantService;
  knowledge: KnowledgeAdminService;
  users: UserAdminService;
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

  const localKb = new LocalKnowledgeBase(prisma);
  const kb: KnowledgeBase =
    env.KB_DRIVER === 'bedrock' ? new CompositeKnowledgeBase([localKb, new BedrockKnowledgeBase(env.BEDROCK_KB_ID!, env.AWS_REGION)]) : localKb;
  const mock = new MockAiAssistant();
  const ai: AiAssistant =
    env.AI_DRIVER === 'bedrock'
      ? new BedrockAiAssistant(env.BEDROCK_MODEL_ID, env.AWS_REGION, env.BEDROCK_GUARDRAIL_ID, env.BEDROCK_GUARDRAIL_VERSION)
      : mock;

  const hub = new LiveHub();
  const notifications = new NotificationService(prisma, mailer, hub, env.APP_URL);
  const audit = new AuditService(prisma);
  const incidents = new IncidentService(prisma, storage, notifications, hub);

  return {
    env,
    prisma,
    auth,
    sessions: new SessionService(env),
    loginLimiter: new LoginLimiter(),
    storage,
    mailer,
    hub,
    notifications,
    audit,
    incidents,
    workflow: new WorkflowService(prisma, incidents, notifications, audit, hub),
    admin: new AdminService(prisma),
    dashboard: new DashboardService(prisma),
    exports: new ExportService(prisma, audit),
    assistant: new AssistantService(prisma, kb, ai, mock),
    knowledge: new KnowledgeAdminService(prisma),
    users: new UserAdminService(prisma, audit, storage),
    adapterNames: { database: 'postgresql', auth: auth.name, storage: storage.name, mail: mailer.name, knowledgeBase: kb.name, ai: ai.name },
    dispose: () => prisma.$disconnect(),
  };
}
