import { existsSync } from 'node:fs';
import { z } from 'zod';

// `.env` est facultatif en développement : chaque variable a une valeur par défaut sûre en local.
if (existsSync('.env')) process.loadEnvFile('.env');

const DEV_JWT_SECRET = 'dev-only-secret-change-me-dev-only-secret';
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('postgresql://smartcampus:smartcampus@localhost:55432/smartcampus'),
  JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  /** Cookie `Secure` : true derrière HTTPS (production). */
  COOKIE_SECURE: bool.default(false),
  /** Affiche les comptes de démo sur la page de connexion. */
  DEMO_MODE: bool.default(true),
  DEMO_PASSWORD: z.string().min(8).default('Campus2026!'),

  AUTH_PROVIDER: z.enum(['local']).default('local'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  S3_BUCKET: z.string().optional(),
  AI_DRIVER: z.enum(['mock', 'bedrock']).default('mock'),
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().default('us.amazon.nova-lite-v1:0'),
  /** Dossier du front buildé à servir (optionnel, sinon le front est servi par Vite ou nginx). */
  WEB_DIST_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', z.prettifyError(parsed.error));
  process.exit(1);
}

const e = parsed.data;
const problems: string[] = [];
if (e.NODE_ENV === 'production' && e.JWT_SECRET === DEV_JWT_SECRET) problems.push('JWT_SECRET doit être défini en production.');
if (e.STORAGE_DRIVER === 's3' && !e.S3_BUCKET) problems.push('S3_BUCKET est requis quand STORAGE_DRIVER=s3.');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

export const env = e;
export type Env = typeof env;
