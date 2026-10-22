# SmartCampus AI

Signaler et suivre un incident du campus en moins de 2 minutes ; donner à l'administration une vision en temps réel de l'état du campus.

- **Personas** : étudiant (`STUDENT`), technicien (`TECHNICIAN`), administrateur (`ADMIN`)
- **Version actuelle : 100 % locale**, aucun compte cloud nécessaire. Migration AWS prévue en phase 9.
- **Stack** : monorepo npm · React + Vite · Node + Express + TypeScript · Prisma + SQLite

Spécifications : [`.kiro/specs/smartcampus-ai/`](.kiro/specs/smartcampus-ai/) · Règles et conventions : [`.kiro/steering/`](.kiro/steering/)

## Prérequis

- Node.js 20.12 ou plus récent, npm
- git

## Démarrer

```bash
npm install        # installe tous les workspaces et génère le client Prisma
npm run setup      # crée apps/api/.env (secret JWT aléatoire) et applique les migrations
npm run dev        # lance l'API (http://localhost:3000) et le front (http://localhost:5173)
```

Ouvrir http://localhost:5173 : la page d'accueil doit afficher « API connectée · base OK · mode local ».

## Scripts (à la racine)

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode watch |
| `npm run setup` | prépare `.env` et la base |
| `npm run typecheck` | TypeScript sur tous les workspaces |
| `npm run lint` | lint (oxlint) |
| `npm run build` | build de production du front |
| `npm run db:migrate` | crée / applique une migration Prisma |
| `npm run db:studio` | explorateur de la base SQLite |

## Arborescence

```
apps/
  web/        front React + Vite (proxy /api → API)
  api/        API Express
    prisma/   schéma et migrations SQLite
    src/
      ports/          interfaces d'adapters (Auth, Repositories, FileStorage, Mailer,
                      AiAssistant, Scheduler, RealtimePublisher)
      adapters/local/ implémentations locales (aws/ en phase 9)
      services/       cas d'usage métier (ne dépendent que des ports)
      http/           routes et middlewares
      container.ts    choix des adapters selon ADAPTERS_MODE
packages/
  shared/     configuration métier, règles pures et types partagés front + API
scripts/      scripts d'administration
.kiro/        specs et steering
```

## Équivalences local → AWS

| Besoin | Local (phases 0 à 8) | AWS (phase 9) |
|---|---|---|
| Authentification | comptes SQLite + JWT | Cognito |
| Données | Prisma + SQLite | DynamoDB (Amplify Data) |
| Photos | disque `apps/api/storage/uploads` | S3 |
| Emails | console + `apps/api/storage/outbox/*.eml` | SES |
| Assistant IA | mock déterministe | Bedrock (Converse) |
| Temps réel | Server-Sent Events | subscriptions AppSync |
| Tâches planifiées | minuterie dans l'API | EventBridge + Lambda |

## Avancement

Voir [`tasks.md`](.kiro/specs/smartcampus-ai/tasks.md). Phase courante : **0 — Spec et setup** (terminée, en attente de validation).
