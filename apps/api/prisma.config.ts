import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Même valeur par défaut que src/config/env.ts.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
