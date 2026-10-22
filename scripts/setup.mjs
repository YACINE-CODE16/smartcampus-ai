// Prépare l'environnement local en une commande :
// 1. apps/api/.env (secret JWT aléatoire)  2. PostgreSQL (docker compose)  3. migrations  4. données de démo
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });

const envFile = 'apps/api/.env';
if (existsSync(envFile)) {
  console.log(`${envFile} existe déjà, conservé.`);
} else {
  copyFileSync('apps/api/.env.example', envFile);
  const secret = randomBytes(32).toString('hex');
  writeFileSync(envFile, readFileSync(envFile, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log(`${envFile} créé.`);
}

run('docker compose up -d --wait');
run('npx prisma migrate deploy', 'apps/api');
run('npm run seed', 'apps/api');
