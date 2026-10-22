import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Même valeur par défaut que src/config/env.ts (base docker-compose).
    url: process.env.DATABASE_URL ?? 'postgresql://smartcampus:smartcampus@localhost:55432/smartcampus',
  },
});
