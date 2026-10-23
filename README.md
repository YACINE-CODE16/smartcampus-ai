# SmartCampus AI

Signaler et suivre un incident du campus en moins de 2 minutes ; donner à l'administration une vision en temps réel de l'état du campus.
Workshop Capgemini × ESIEA — 38 user stories (US-01 à US-38), déploiement AWS us-east-1.

- **Rôles** : étudiant (`STUDENT`), agent (`AGENT`), administrateur (`ADMIN`)
- **Stack** : monorepo npm · React + Vite · Node + Express + TypeScript · Prisma + PostgreSQL · SSE · FR/EN
- **Specs** : [`.kiro/specs/smartcampus-ai/`](.kiro/specs/smartcampus-ai/) · **Règles** : [`.kiro/steering/`](.kiro/steering/) · **Déploiement** : [`DEPLOY.md`](DEPLOY.md)

## Démarrer en local

Prérequis : Node.js 20.12+, Docker Desktop.

```bash
npm install
npm run setup     # .env, PostgreSQL (docker, port 55432), migrations, données de démo
npm run dev       # API http://localhost:3000 + front http://localhost:5173
```

Ouvrir http://localhost:5173 et cliquer sur un compte de démonstration.

| Rôle | Email (mot de passe `Campus2026!`) |
|---|---|
| Étudiant | alice.martin@esiea.fr · bob.durand@esiea.fr |
| Agent | karim.benali@esiea.fr · julie.robert@esiea.fr |
| Admin | claire.moreau@esiea.fr |

Le SSO école est **simulé** par ces comptes. Les emails sont écrits dans `apps/api/storage/outbox/*.eml`.

## Scripts (à la racine)

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode watch |
| `npm run setup` | environnement local complet |
| `npm run seed` | réinitialise les données de démo (60 tickets sur 30 jours, FAQ, documents) |
| `npm test` | 101 tests : règles métier + intégration API (PostgreSQL requis) |
| `npm run typecheck` · `npm run lint` · `npm run build` | vérifications |
| `npm run db:migrate` · `npm run db:studio` | migrations Prisma, explorateur de base |

## Adapters (variables d'environnement de l'API)

| Port | Variable | Local | Production |
|---|---|---|---|
| Authentification | `AUTH_PROVIDER` | `local` (SSO simulé) | `local` |
| Photos | `STORAGE_DRIVER` | `local` (`storage/uploads`) | `s3` (`S3_BUCKET`) |
| Emails | `MAIL_DRIVER` | `console` (`.eml`) | `ses` ou `console` |
| Base documentaire | `KB_DRIVER` | `local` (FAQ + documents en base) | `local` ou `bedrock` (`BEDROCK_KB_ID`) |
| Assistant IA | `AI_DRIVER` | `mock` | `bedrock` (Nova Lite + Guardrail), repli automatique sur `mock` |

## Arborescence

```
apps/web/          front React (proxy /api en dev ; nginx en production)
apps/api/          API Express
  prisma/          schéma, migrations, seed, FAQ bilingue, documents
  src/ports/       AuthProvider, FileStorage, Mailer, KnowledgeBase, AiAssistant
  src/adapters/    implémentations locales et AWS (S3, SES, Bedrock)
  src/services/    cas d'usage : incidents, workflow, notifications, dashboard, assistant, admin
  src/http/        routes, middlewares, sécurité
  test/            tests d'intégration
packages/shared/   règles métier pures (transitions, accès, KPI, langue), configuration, types
docker-compose.yml             PostgreSQL de développement
docker-compose.prod.yml        production : Traefik + api + web (RDS en externe)
docker-compose.local-test.yml  test local de la pile de production
```

## Avancement

Toutes les user stories US-01 à US-38 sont implémentées. Le détail est dans [`tasks.md`](.kiro/specs/smartcampus-ai/tasks.md).
