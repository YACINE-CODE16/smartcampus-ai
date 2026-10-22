# SmartCampus AI

Signaler et suivre un incident du campus en moins de 2 minutes ; donner à l'administration une vision en temps réel de l'état du campus.

- **Personas** : étudiant (`STUDENT`), technicien (`TECHNICIAN`), administrateur (`ADMIN`)
- **Stack** : AWS Amplify Gen 2 (Cognito, AppSync/DynamoDB, S3, Lambda, Bedrock, SES) · React + Vite + TypeScript
- **Région AWS** : `eu-west-3` (Paris)

Spécifications : [`.kiro/specs/smartcampus-ai/`](.kiro/specs/smartcampus-ai/) · Règles et conventions : [`.kiro/steering/`](.kiro/steering/)

## Prérequis

- Node.js 20 ou plus récent, npm
- AWS CLI v2
- Un profil AWS nommé `smartcampus` réglé sur la région `eu-west-3` (voir ci-dessous)

### Configurer le profil AWS `smartcampus`

Avec des clés d'accès IAM :

```bash
aws configure --profile smartcampus
# AWS Access Key ID / Secret Access Key : vos clés
# Default region name : eu-west-3
# Default output format : json
```

Avec IAM Identity Center (SSO) :

```bash
aws configure sso --profile smartcampus   # région SSO de votre organisation, région par défaut : eu-west-3
aws sso login --profile smartcampus
```

Vérification :

```bash
aws sts get-caller-identity --profile smartcampus
```

Au premier lancement dans un compte/région, Amplify demande d'amorcer CDK (« bootstrap ») et ouvre une page de la console AWS : validez-la, puis relancez la commande.

## Démarrer en local

```bash
npm install
npm run sandbox   # déploie un backend personnel dans AWS et génère amplify_outputs.json (laisser tourner)
npm run dev       # dans un second terminal : http://localhost:5173
```

`npm run dev` a besoin de `amplify_outputs.json` : lancez la sandbox d'abord.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run sandbox` | backend de développement personnel (redéploie à chaque modification de `amplify/`) |
| `npm run sandbox:delete` | supprime la sandbox et ses ressources AWS |
| `npm run dev` | serveur de développement Vite |
| `npm run build` | build de production |
| `npm run typecheck` | vérification TypeScript front + backend |
| `npm run lint` | lint (oxlint) |

## Arborescence

```
amplify/   backend Amplify Gen 2 (auth, data, storage, functions)
shared/    configuration et règles métier partagées front + Lambdas
src/       application React
scripts/   scripts d'administration (rôles, seed, anonymisation)
.kiro/     specs (requirements, design, tasks) et steering
```

## Avancement

Voir [`tasks.md`](.kiro/specs/smartcampus-ai/tasks.md). Phase courante : **0 — Spec et setup**.
