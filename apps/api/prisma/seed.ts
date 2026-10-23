/** `npm run seed` : recharge les données de démo dans la base de DATABASE_URL. */
import { env } from '../src/config/env';
import { createPrismaClient } from '../src/db';
import { runSeed } from './demo-data';

const prisma = createPrismaClient(env.DATABASE_URL);
runSeed(prisma, env.DEMO_PASSWORD)
  .then(() => console.log(`Mot de passe des comptes de démo : ${env.DEMO_PASSWORD}`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
