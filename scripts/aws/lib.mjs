/**
 * Outils communs aux scripts AWS (deploy, migrate, destroy) : appels aws/sam, détection des identifiants
 * expirés, configuration locale du déploiement (.aws-deploy.json, ignoré par git : contient des secrets).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const STACK = process.env.STACK_NAME || 'smartcampus';
export const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const CONFIG_FILE = `${ROOT}.aws-deploy.json`;
const SAM = process.env.SAM_CLI || 'sam';

export const step = (msg) => console.log(`\n\x1b[1m▶ ${msg}\x1b[0m`);
export const info = (msg) => console.log(`  ${msg}`);
export function fail(msg) {
  console.error(`\n\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}

const EXPIRED = /ExpiredToken|security token included in the request is expired|InvalidClientTokenId|token has expired/i;
const NO_CREDENTIALS = /Unable to locate credentials|NoCredentialProviders|could not be found|no credentials/i;

function checkCredentialsError(text) {
  if (EXPIRED.test(text)) {
    console.error(
      '\n\x1b[31m✖ Identifiants AWS expirés (ExpiredToken).\x1b[0m\n' +
        '  Dans la console du lab : « Get AWS CLI credentials », recopiez AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY\n' +
        '  et AWS_SESSION_TOKEN (dans ~/.aws/credentials ou en variables d’environnement), puis relancez la commande.\n' +
        '  Le déploiement reprend où il s’était arrêté.',
    );
    process.exit(2);
  }
  if (NO_CREDENTIALS.test(text)) fail('Aucun identifiant AWS trouvé : voir DEPLOY.md, étape « Se connecter ».');
}

/**
 * Lance une commande. `capture` : renvoie la sortie standard (erreurs analysées).
 * Sinon tout s'affiche en direct (sam deploy dure plusieurs minutes) et, en cas d'échec,
 * on vérifie si les identifiants ont expiré.
 */
export function run(cmd, args, { capture = false, allowFail = false, env } = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, AWS_REGION: REGION, AWS_DEFAULT_REGION: REGION, SAM_CLI_TELEMETRY: '0', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) fail(`${cmd} introuvable : installez-le (voir DEPLOY.md, prérequis).`);
  if (res.status !== 0) {
    if (capture) checkCredentialsError(`${res.stderr ?? ''}${res.stdout ?? ''}`);
    else if (cmd !== 'aws' || args[0] !== 'sts') aws(['sts', 'get-caller-identity']); // sort avec le bon message si expirés
    if (allowFail) return null;
    fail(`Échec : ${cmd} ${args.join(' ')}${capture ? `\n${(res.stderr ?? '').trim()}` : ''}`);
  }
  return capture ? res.stdout : '';
}

/** Appel AWS CLI qui renvoie du JSON (ou `null` si `allowFail` et échec). */
export function aws(args, opts = {}) {
  const out = run('aws', [...args, '--region', REGION, '--output', 'json'], { ...opts, capture: true });
  return out === null ? null : out.trim() ? JSON.parse(out) : {};
}

export function sam(args) {
  return run(SAM, args);
}

export function whoami() {
  const id = aws(['sts', 'get-caller-identity']);
  info(`Compte ${id.Account} · ${id.Arn} · région ${REGION}`);
  return id;
}

export function loadConfig() {
  return existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {};
}
export function saveConfig(config) {
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

/** Sorties de la pile CloudFormation (`{}` si elle n'existe pas). */
export function stackOutputs() {
  const res = aws(['cloudformation', 'describe-stacks', '--stack-name', STACK], { allowFail: true });
  const stack = res?.Stacks?.[0];
  if (!stack) return null;
  return Object.fromEntries((stack.Outputs ?? []).map((o) => [o.OutputKey, o.OutputValue]));
}

/** Invoque la Lambda Migrate et renvoie son résultat. */
export function invokeMigrate(functionName, payload) {
  const out = join(tmpdir(), 'smartcampus-migrate-result.json');
  const res = aws([
    'lambda', 'invoke', '--function-name', functionName,
    '--payload', JSON.stringify(payload), '--cli-binary-format', 'raw-in-base64-out',
    '--cli-read-timeout', '330', out,
  ]);
  const body = readFileSync(out, 'utf8');
  if (res.FunctionError) fail(`La Lambda Migrate a échoué : ${body}\n  Logs : aws logs tail /aws/lambda/${functionName} --since 10m`);
  return JSON.parse(body);
}
