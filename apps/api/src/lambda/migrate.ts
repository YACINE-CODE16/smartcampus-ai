import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USERS, runSeed } from '../../prisma/demo-data';
import { CognitoAuthProvider } from '../adapters/cognito-auth';
import { env } from '../config/env';
import { createPrismaClient } from '../db';
import { applyMigrations } from './migrator';

/** Dossier des migrations : copié à côté du bundle (dist/lambda/migrations), sinon celui du dépôt (local). */
function migrationsDir(): string {
  const bundled = fileURLToPath(new URL('./migrations/', import.meta.url));
  return existsSync(bundled) ? bundled : resolve('prisma/migrations');
}

/**
 * Lambda Migrate, invoquée une fois après la création de RDS (`npm run migrate:aws`) :
 * 1. applique les migrations ; 2. charge les données de démo si la base est vide (ou si `reset: true`) ;
 * 3. crée les comptes de démo dans Cognito (mêmes emails, même mot de passe, groupe = rôle).
 */
export async function handler(event: { reset?: boolean } = {}) {
  const migrations = await applyMigrations(env.DATABASE_URL, migrationsDir());
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const seeded = event.reset === true || (await prisma.user.count()) === 0;
    if (seeded) await runSeed(prisma, env.DEMO_PASSWORD);

    let cognitoUsers = 0;
    if (env.AUTH_PROVIDER === 'cognito') {
      const cognito = new CognitoAuthProvider(prisma, env.COGNITO_USER_POOL_ID!, env.COGNITO_CLIENT_ID!, env.AWS_REGION);
      for (const u of DEMO_USERS) await cognito.ensureUser(u.email, u.name, u.role, env.DEMO_PASSWORD);
      cognitoUsers = DEMO_USERS.length;
    }
    const result = { migrations, seeded, cognitoUsers };
    console.log('[migrate]', JSON.stringify(result));
    return result;
  } finally {
    await prisma.$disconnect();
  }
}
