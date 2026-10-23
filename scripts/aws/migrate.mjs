/**
 * npm run migrate:aws — invoque la Lambda Migrate (migrations SQL, données de démo si base vide, comptes Cognito).
 * npm run migrate:aws -- --reset : recharge les données de démo (efface les tickets créés pendant la démo).
 */
import { fail, info, invokeMigrate, STACK, stackOutputs, step, whoami } from './lib.mjs';

step('Identifiants AWS');
whoami();
const out = stackOutputs();
if (!out?.MigrateFunctionName) fail(`Pile « ${STACK} » introuvable : lancez d’abord npm run deploy:aws.`);
const reset = process.argv.includes('--reset');
step(`Lambda ${out.MigrateFunctionName}${reset ? ' (réinitialisation des données de démo)' : ''}`);
const result = invokeMigrate(out.MigrateFunctionName, { reset });
info(`Migrations appliquées : ${result.migrations.length ? result.migrations.join(', ') : 'aucune (déjà à jour)'}`);
info(result.seeded ? 'Données de démo chargées.' : 'Données existantes conservées.');
info(`Comptes Cognito synchronisés : ${result.cognitoUsers}`);
