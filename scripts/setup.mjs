// Prépare l'environnement local : apps/api/.env (avec un secret JWT aléatoire) puis migrations.
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const envFile = 'apps/api/.env';
if (existsSync(envFile)) {
  console.log(`${envFile} existe déjà, conservé.`);
} else {
  copyFileSync('apps/api/.env.example', envFile);
  const secret = randomBytes(32).toString('hex');
  writeFileSync(envFile, readFileSync(envFile, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log(`${envFile} créé.`);
}

if (existsSync('apps/api/prisma/migrations')) {
  execSync('npx prisma migrate deploy', { cwd: 'apps/api', stdio: 'inherit' });
} else {
  console.log('Aucune migration à appliquer pour le moment.');
}
