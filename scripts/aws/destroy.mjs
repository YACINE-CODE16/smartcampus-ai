/**
 * npm run destroy:aws — supprime tout : vide les deux buckets (CloudFormation refuse de supprimer un bucket non vide),
 * puis supprime la pile (CloudFront, Lambdas, API, RDS, NAT, VPC/sous-réseaux, Cognito…). Compter 10 à 20 min.
 * `-- --yes` pour ne pas demander de confirmation.
 */
import { createInterface } from 'node:readline/promises';
import { existsSync, rmSync } from 'node:fs';
import { info, REGION, ROOT, run, sam, STACK, stackOutputs, step, whoami } from './lib.mjs';

step('Identifiants AWS');
whoami();
const out = stackOutputs();
if (!out) {
  info(`Aucune pile « ${STACK} » dans ${REGION} : rien à supprimer.`);
  process.exit(0);
}

if (!process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nSupprimer définitivement la pile « ${STACK} » et toutes ses données (base, fichiers) ? Tapez « oui » : `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'oui') {
    info('Annulé.');
    process.exit(0);
  }
}

step('1/2 Vidage des buckets');
for (const bucket of [out.FrontBucketName, out.FilesBucketName].filter(Boolean)) {
  run('aws', ['s3', 'rm', `s3://${bucket}`, '--recursive', '--region', REGION], { allowFail: true });
  info(`${bucket} vidé`);
}

step('2/2 Suppression de la pile (RDS, NAT, CloudFront… ~10 à 20 min)');
sam(['delete', '--stack-name', STACK, '--region', REGION, '--no-prompts']);

// Le prochain déploiement repart d'un réseau et de secrets neufs.
const config = `${ROOT}.aws-deploy.json`;
if (existsSync(config)) rmSync(config);
info('Pile supprimée. Restent hors pile : identités SES vérifiées et bucket d’artefacts SAM (aws-sam-cli-managed-default).');
