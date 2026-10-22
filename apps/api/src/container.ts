import type { Env } from './config/env';
import { createPrismaClient, type PrismaClient } from './adapters/local/prisma';

/**
 * Racine de composition : seul endroit qui choisit les implémentations des ports
 * (`src/ports`) selon `ADAPTERS_MODE`. Le reste du code ne dépend que des interfaces.
 *
 * Les adapters sont ajoutés au fil des phases :
 *   phase 1 AuthProvider · phase 2 Repositories, UnitOfWork, FileStorage
 *   phase 4 RealtimePublisher, Scheduler · phase 6 AiAssistant, KnowledgeProvider
 *   phase 7 Mailer · phase 9 implémentations `aws`
 */
export interface Container {
  env: Env;
  prisma: PrismaClient;
  /** Nom de l'implémentation active par port (affiché par /api/health). */
  adapterNames: Record<string, string>;
  dispose(): Promise<void>;
}

export function createContainer(env: Env): Container {
  switch (env.ADAPTERS_MODE) {
    case 'local': {
      const prisma = createPrismaClient(env.DATABASE_URL);
      return {
        env,
        prisma,
        adapterNames: { database: 'prisma-sqlite' },
        dispose: () => prisma.$disconnect(),
      };
    }
  }
}
