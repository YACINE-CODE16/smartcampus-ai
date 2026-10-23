# SmartCampus AI

Application de signalement d'incidents pour le campus de l'ESIEA (workshop Capgemini × ESIEA).
Un étudiant signale un problème (salle, matériel, réseau, propreté, sécurité) en moins de 2 minutes, depuis son téléphone, avec photo ou PDF.
Les agents techniques prennent en charge, traitent et résolvent les tickets ; l'étudiant suit l'avancement et reçoit une notification à chaque étape.
L'administration pilote le campus : tableau de bord, délais cibles par catégorie, alertes, exports, journal d'audit.
Un assistant IA (Amazon Bedrock) répond aux questions courantes et aide à qualifier les tickets. 38 user stories, interface FR/EN.

- **Architecture AWS** : [docs/architecture.md](docs/architecture.md) · **Déploiement** : [DEPLOY.md](DEPLOY.md)
- **User stories** : [docs/user-stories-smartcampus.md](docs/user-stories-smartcampus.md) · **Specs** : [.kiro/specs/smartcampus-ai/](.kiro/specs/smartcampus-ai/) · **Design** : [DESIGN.md](DESIGN.md)

## Stack

| Couche | Technologies |
|---|---|
| Front | React 19, Vite, React Router, Recharts, Lucide ; CSS natif à variables (clair/sombre) |
| API | Node 20, Express 5, TypeScript, zod ; ports/adapters choisis par variables d'environnement |
| Données | PostgreSQL 16, Prisma 7 (sans moteur natif) |
| AWS | CloudFront + S3, API Gateway HTTP API, Cognito, Lambda (×6), RDS, S3, EventBridge, SES, Bedrock Nova Lite ; AWS SAM |
| Qualité | Vitest (108 tests : règles métier + intégration API), oxlint, TypeScript strict |

## Démarrer en local

Prérequis : Node.js 20.12+, Docker Desktop.

```bash
npm install
npm run setup     # .env, PostgreSQL (docker, port 55432), migrations, données de démo
npm run dev       # API http://localhost:3000 + front http://localhost:5173
```

Ouvrir http://localhost:5173 et cliquer sur un compte de démonstration. En local, les emails sont écrits dans `apps/api/storage/outbox/*.eml` et l'assistant utilise un mock.

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode watch |
| `npm run seed` | réinitialise les données de démo (60 tickets sur 30 jours, FAQ, documents) |
| `npm test` | tests (PostgreSQL local requis) |
| `npm run typecheck` · `npm run lint` · `npm run build` | vérifications |
| `npm run deploy:aws` · `npm run migrate:aws` · `npm run destroy:aws` | déploiement AWS en une commande, données de démo, suppression ([DEPLOY.md](DEPLOY.md)) |

## Comptes de démonstration

Mot de passe commun : `Campus2026!` (le SSO de l'école est simulé ; sur AWS, les mêmes comptes existent dans Cognito).

| Rôle | Comptes |
|---|---|
| Étudiant | alice.martin@esiea.fr · bob.durand@esiea.fr |
| Agent technique | karim.benali@esiea.fr · julie.robert@esiea.fr |
| Administration | claire.moreau@esiea.fr |

## Arborescence

```
apps/web/            front React
apps/api/            API Express
  prisma/            schéma, migrations, données de démo
  src/ports/         AuthProvider, FileStorage, Mailer, KnowledgeBase, AiAssistant
  src/adapters/      implémentations locales et AWS (Cognito, S3, SES, Lambda, Bedrock)
  src/services/      cas d'usage : incidents, workflow, notifications, tableau de bord, assistant
  src/lambda/        handlers AWS : http (4 Lambdas API), notifications, migrate
packages/shared/     règles métier pures, configuration, types partagés
template.yaml        infrastructure AWS (SAM)
scripts/aws/         deploy, migrate, destroy
```
