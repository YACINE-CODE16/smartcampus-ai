/**
 * npm run deploy:aws — déploiement complet en une commande (idempotent, relançable) :
 *  1. vérifie les identifiants ; 2. choisit réseau, rôle IAM et secrets (mémorisés dans .aws-deploy.json) ;
 *  3. build des Lambdas (esbuild) et du front (mode polling) ; 4. sam build + sam deploy ;
 *  5. 2e passage pour l'URL CloudFront (emails, CORS) ; 6. migrations + données de démo + comptes Cognito ;
 *  7. envoi du front dans S3 + invalidation CloudFront ; 8. test de /api/health.
 * Variables facultatives : SES_SENDER, SES_REDIRECT_TO, LAB_ROLE_ARN, VPC_MODE=default|new, AI_DRIVER=mock, STACK_NAME.
 */
import { randomBytes } from 'node:crypto';
import { aws, fail, info, invokeMigrate, loadConfig, REGION, run, sam, saveConfig, STACK, stackOutputs, step, whoami } from './lib.mjs';

const config = loadConfig();

step('1/8 Identifiants AWS');
whoami();

step('2/8 Paramètres du déploiement');
// Secrets générés une fois, jamais commités (.aws-deploy.json est dans .gitignore).
config.dbPassword ??= randomBytes(24).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
config.jwtSecret ??= randomBytes(48).toString('base64url');

// Rôle IAM : LabRole du lab s'il existe (création de rôles souvent interdite), sinon rôle créé par la pile.
if (process.env.LAB_ROLE_ARN !== undefined) config.labRoleArn = process.env.LAB_ROLE_ARN;
if (config.labRoleArn === undefined) {
  const lab = aws(['iam', 'get-role', '--role-name', 'LabRole'], { allowFail: true });
  config.labRoleArn = lab?.Role?.Arn ?? '';
}
info(config.labRoleArn ? `Rôle IAM : ${config.labRoleArn} (rôle du lab)` : 'Rôle IAM : créé par la pile (AppRole)');

// Réseau : VPC par défaut (architecture validée) ; choix mémorisé pour ne jamais recréer les sous-réseaux.
if (!config.network) {
  const wanted = process.env.VPC_MODE ?? 'default';
  const vpc = wanted === 'default' ? aws(['ec2', 'describe-vpcs', '--filters', 'Name=isDefault,Values=true']).Vpcs?.[0] : null;
  if (!vpc) {
    if (wanted === 'default') info('Pas de VPC par défaut dans ce compte : création d’un VPC dédié.');
    config.network = { VpcMode: 'new', ExistingVpcId: '', PublicSubnetId: '', PrivateSubnet1Cidr: '10.20.11.0/24', PrivateSubnet2Cidr: '10.20.12.0/24' };
  } else {
    const subnets = aws(['ec2', 'describe-subnets', '--filters', `Name=vpc-id,Values=${vpc.VpcId}`]).Subnets ?? [];
    const pub = subnets.filter((s) => s.MapPublicIpOnLaunch || s.DefaultForAz).sort((a, b) => a.AvailabilityZone.localeCompare(b.AvailabilityZone))[0];
    if (!pub) fail(`Aucun sous-réseau public dans ${vpc.VpcId} pour la NAT Gateway : relancez avec VPC_MODE=new.`);
    const [c1, c2] = freeCidrs(vpc.CidrBlock, subnets.map((s) => s.CidrBlock), 2);
    config.network = { VpcMode: 'default', ExistingVpcId: vpc.VpcId, PublicSubnetId: pub.SubnetId, PrivateSubnet1Cidr: c1, PrivateSubnet2Cidr: c2 };
  }
}
const n = config.network;
info(n.VpcMode === 'default' ? `VPC par défaut ${n.ExistingVpcId} · NAT dans ${n.PublicSubnetId} · privés ${n.PrivateSubnet1Cidr}, ${n.PrivateSubnet2Cidr}` : 'VPC dédié 10.20.0.0/16');

// SES : adresses à vérifier (sandbox). Un email de confirmation part vers chacune.
if (process.env.SES_SENDER !== undefined) config.sesSender = process.env.SES_SENDER;
if (process.env.SES_REDIRECT_TO !== undefined) config.sesRedirectTo = process.env.SES_REDIRECT_TO;
for (const address of new Set([config.sesSender, config.sesRedirectTo].filter(Boolean))) {
  const identity = aws(['sesv2', 'get-email-identity', '--email-identity', address], { allowFail: true });
  if (!identity) {
    aws(['sesv2', 'create-email-identity', '--email-identity', address]);
    info(`SES : email de vérification envoyé à ${address} (cliquez sur le lien reçu).`);
  } else {
    info(`SES : ${address} ${identity.VerifiedForSendingStatus ? 'vérifiée' : 'en attente de vérification (lien reçu par email)'}`);
  }
}
if (!config.sesSender) info('SES : pas d’expéditeur (SES_SENDER) → emails écrits dans les logs CloudWatch de la Lambda Notifications.');
saveConfig(config);

const params = () => [
  `VpcMode=${n.VpcMode}`,
  `ExistingVpcId=${n.ExistingVpcId}`,
  `PublicSubnetId=${n.PublicSubnetId}`,
  `PrivateSubnet1Cidr=${n.PrivateSubnet1Cidr}`,
  `PrivateSubnet2Cidr=${n.PrivateSubnet2Cidr}`,
  `LabRoleArn=${config.labRoleArn}`,
  `DbPassword=${config.dbPassword}`,
  `JwtSecret=${config.jwtSecret}`,
  `AppUrl=${config.appUrl ?? ''}`,
  `SesSender=${config.sesSender ?? ''}`,
  `MailRedirectTo=${config.sesRedirectTo ?? ''}`,
  `AiDriver=${process.env.AI_DRIVER ?? 'bedrock'}`,
].filter((p) => !p.endsWith('=')); // SAM refuse « Cle= » : un paramètre vide prend la valeur par défaut du template ('')
const deploy = () =>
  sam([
    'deploy', '--template-file', '.aws-sam/build/template.yaml', '--stack-name', STACK, '--region', REGION,
    '--resolve-s3', '--capabilities', 'CAPABILITY_IAM', '--no-confirm-changeset', '--no-fail-on-empty-changeset',
    '--parameter-overrides', ...params(),
  ]);

step('3/8 Build des Lambdas et du front');
run('npm', ['run', 'build:lambda', '-w', '@smartcampus/api']);
run('npm', ['run', 'build', '-w', '@smartcampus/web'], { env: { VITE_REALTIME_MODE: 'poll', VITE_POLL_SECONDS: '20' } });

step('4/8 sam build + sam deploy (1re création : ~15 min, surtout RDS et CloudFront)');
sam(['build', '--template', 'template.yaml']);
deploy();
let out = stackOutputs();
if (!out) fail('Pile introuvable après le déploiement.');

step('5/8 URL CloudFront dans la configuration (emails, CORS des pièces jointes)');
if (config.appUrl !== out.AppUrl) {
  config.appUrl = out.AppUrl;
  saveConfig(config);
  deploy();
  out = stackOutputs();
} else info(`Déjà à jour : ${out.AppUrl}`);

step('6/8 Migrations, données de démo et comptes Cognito (Lambda Migrate)');
const migrated = invokeMigrate(out.MigrateFunctionName, {});
info(`Migrations appliquées : ${migrated.migrations.length ? migrated.migrations.join(', ') : 'aucune (déjà à jour)'}`);
info(migrated.seeded ? 'Données de démo chargées.' : 'Données existantes conservées (npm run migrate:aws -- --reset pour repartir de zéro).');
info(`Comptes Cognito synchronisés : ${migrated.cognitoUsers}`);

step('7/8 Front dans S3 + invalidation CloudFront');
run('aws', ['s3', 'sync', 'apps/web/dist', `s3://${out.FrontBucketName}`, '--delete', '--exclude', 'index.html', '--cache-control', 'public,max-age=31536000,immutable', '--region', REGION]);
run('aws', ['s3', 'cp', 'apps/web/dist/index.html', `s3://${out.FrontBucketName}/index.html`, '--cache-control', 'no-cache', '--region', REGION]);
aws(['cloudfront', 'create-invalidation', '--distribution-id', out.DistributionId, '--paths', '/*']);
info('Invalidation demandée (1 à 2 min).');

step('8/8 Vérification');
let health = null;
for (let i = 0; i < 12 && !health; i++) {
  try {
    const res = await fetch(`${out.AppUrl}/api/health`);
    if (res.ok) health = await res.json();
  } catch {
    // CloudFront encore en propagation
  }
  if (!health) await new Promise((r) => setTimeout(r, 10_000));
}
if (health) info(`/api/health : ${health.status} · base ${health.database} · ${Object.entries(health.adapters).map(([k, v]) => `${k}=${v}`).join(' ')}`);
else info('/api/health ne répond pas encore (propagation CloudFront) : réessayez dans quelques minutes.');

console.log(`
\x1b[32m✔ SmartCampus AI est en ligne : ${out.AppUrl}\x1b[0m
  Comptes de démo (mot de passe Campus2026!) : alice.martin@esiea.fr, bob.durand@esiea.fr (étudiants),
  karim.benali@esiea.fr, julie.robert@esiea.fr (agents), claire.moreau@esiea.fr (admin).
  Coût : NAT Gateway ~1,1 $/jour + RDS ~0,4 $/jour. Pensez à « npm run destroy:aws » après la démo.`);

/** Deux blocs /24 libres dans le VPC, pris en haut de la plage (les sous-réseaux par défaut sont en bas). */
function freeCidrs(vpcCidr, used, count) {
  const toInt = (ip) => ip.split('.').reduce((a, b) => a * 256 + Number(b), 0);
  const toIp = (x) => [24, 16, 8, 0].map((s) => Math.floor(x / 2 ** s) % 256).join('.');
  const range = (cidr) => {
    const [ip, bits] = cidr.split('/');
    const size = 2 ** (32 - Number(bits));
    const start = toInt(ip) - (toInt(ip) % size);
    return [start, start + size - 1];
  };
  const [vStart, vEnd] = range(vpcCidr);
  const taken = used.map(range);
  const result = [];
  for (let start = vEnd - 255; start >= vStart && result.length < count; start -= 256) {
    if (!taken.some(([a, b]) => start <= b && start + 255 >= a)) result.push(`${toIp(start)}/24`);
  }
  if (result.length < count) fail(`Pas assez de place libre dans ${vpcCidr} : relancez avec VPC_MODE=new.`);
  return result;
}
