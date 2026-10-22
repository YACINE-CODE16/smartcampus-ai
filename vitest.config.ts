import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/api/test/**/*.test.ts'],
    // Les tests d'intégration partagent la base de démo : exécution des fichiers en séquence.
    fileParallelism: false,
    // Emails et photos des tests hors du dépôt.
    env: {
      MAIL_OUTBOX_DIR: join(tmpdir(), 'smartcampus-test', 'outbox'),
      UPLOAD_DIR: join(tmpdir(), 'smartcampus-test', 'uploads'),
    },
  },
});
