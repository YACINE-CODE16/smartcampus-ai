import { existsSync } from 'node:fs';
import { z } from 'zod';

// `.env` est facultatif en développement : chaque variable a une valeur par défaut sûre en local.
if (existsSync('.env')) process.loadEnvFile('.env');

const DEV_JWT_SECRET = 'dev-only-secret-change-me-dev-only-secret';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** `local` aujourd'hui ; `aws` après la phase 9. */
  ADAPTERS_MODE: z.enum(['local']).default('local'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  MAIL_OUTBOX_DIR: z.string().default('./storage/outbox'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', z.prettifyError(parsed.error));
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === DEV_JWT_SECRET) {
  console.error('JWT_SECRET doit être défini en production.');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
