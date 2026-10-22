---
inclusion: always
---

# Conventions techniques

## Stratégie
- **Phases 0 à 8 : 100 % local**, aucune dépendance AWS ni identifiant cloud.
- **Phase 9 : migration AWS** en remplaçant les adapters (`ADAPTERS_MODE=aws`), sans toucher aux services ni aux règles métier.

## Stack locale
- **Monorepo** npm workspaces, Node ≥ 20.12, TypeScript strict.
- **apps/web** : React 19 + Vite, React Router, Recharts, CSS natif à variables. Proxy Vite `/api` → API.
- **apps/api** : Node + Express 5 + TypeScript (exécuté par `tsx`), validation zod.
- **Base** : Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`), client généré dans `apps/api/src/generated/prisma`.
- **Auth** : JWT signé par l'API, cookie httpOnly ; mots de passe hachés avec `crypto.scrypt`.
- **Fichiers** : disque local (`apps/api/storage/uploads`), URL signées HMAC.
- **Emails** : boîte d'envoi locale (console + `.eml` dans `apps/api/storage/outbox`).
- **Assistant IA** : mock déterministe (même contrat que Bedrock Converse).
- **Temps réel** : Server-Sent Events.
- **Tâches planifiées** : minuterie in-process.

## Cible AWS (phase 9)
Cognito · DynamoDB/Amplify Data (AppSync) · S3 · SES · Bedrock Converse (`BEDROCK_MODEL_ID`) · EventBridge Scheduler · Amplify Hosting · région `eu-west-3` par défaut.

## Architecture : ports et adapters
```
apps/api/src/
  config/env.ts        variables d'environnement validées (zod), défauts sûrs en dev
  ports/               interfaces : AuthProvider, Repositories + UnitOfWork, FileStorage,
                       Mailer, AiAssistant + KnowledgeProvider, Scheduler, RealtimePublisher
  adapters/local/      implémentations locales (Prisma, JWT, disque, outbox, mock, SSE…)
  adapters/aws/        implémentations AWS (phase 9)
  services/            cas d'usage — n'importent QUE des ports et @smartcampus/shared
  jobs/                tâches planifiées (auto-close…)
  http/                app Express, middlewares, routes (fines : auth → validation → service)
  domain/errors.ts     erreurs métier (traduites en HTTP par http/app.ts)
  container.ts         SEUL endroit qui instancie les adapters
packages/shared/src/
  config/              rôles, statuts, transitions, urgences, bâtiments, catégories, réglages
  domain/              règles pures testées (transitions, accès, KPI)
  types/               entités et contrats HTTP
apps/web/src/
  app/                 routage, layouts, garde de rôle
  features/<domaine>/  auth, incidents, technician, admin, dashboard, assistant, notifications
  components/          composants UI réutilisables
  lib/                 client API, authClient, useRealtime
scripts/               setup, set-role, seed, anonymize, job
```

## Règles de code
- Un service ne doit **jamais** importer Prisma, Express, `fs` ou un SDK : uniquement des ports.
- Les routes ne contiennent pas de logique métier.
- Les règles métier vivent dans `packages/shared/src/domain` ; le front s'en sert pour l'affichage, l'API pour l'application.
- Aucune valeur métier en dur : importer depuis `@smartcampus/shared`.
- Dates en ISO 8601 (string) dans les entités et les contrats.
- L'identité vient toujours de `req.user` (jeton vérifié), jamais du corps ou de la query.
- Les événements temps réel ne portent que des identifiants.
- Libellés UI en français ; code, fichiers et commits en anglais.
- Enums en MAJUSCULES sans accent (`EN_COURS`), libellés via la config.
- Commentaires pour expliquer un *pourquoi*.
- Pas de secret dans le dépôt : `apps/api/.env` (ignoré par git), modèle `.env.example`.
- Mobile-first : 360 px puis élargissement.

## Commandes
`npm run setup` (env + migrations) · `npm run dev` (API + web) · `npm run typecheck` · `npm run lint` · `npm run build` · `npm run db:migrate` · `npm run db:studio`

## Git
- Au moins un commit à la fin de chaque phase : `feat(phaseN): ...`.

## Tests
- Vitest (à partir de la phase 1) : règles pures de `packages/shared` et services avec des adapters en mémoire ou SQLite de test.
- Chaque phase se termine par un scénario de test manuel décrit au PO.
