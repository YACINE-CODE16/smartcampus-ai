---
inclusion: always
---

# Conventions techniques

## Stack
- **Monorepo** npm workspaces, Node ≥ 20.12 (Node 22 dans les images Docker), TypeScript strict.
- **apps/web** : React 19 + Vite, React Router, Recharts, CSS natif à variables. Proxy Vite `/api` → API en dev.
- **apps/api** : Express 5 + TypeScript (exécuté par `tsx`), validation zod, upload multipart (multer).
- **Base** : PostgreSQL 16 (docker-compose en local, RDS en production) via Prisma 7 (`@prisma/adapter-pg`).
- **Auth** : comptes seedés, JWT en cookie httpOnly, scrypt natif. Derrière `AuthProvider`.
- **Adapters par variable d'environnement** : `STORAGE_DRIVER=local|s3`, `AI_DRIVER=mock|bedrock`.
- **Temps réel** : SSE (instance unique).
- **Production** : EC2 + Docker Compose (Traefik + api + web nginx), RDS, S3, Bedrock — région **us-east-1**.

## Arborescence
```
apps/api/src/
  config/env.ts      variables validées (zod), défauts sûrs en dev
  ports/             AuthProvider, FileStorage, AiAssistant
  adapters/          local-auth, local-storage, s3-storage, mock-ai, bedrock-ai
  services/          cas d'usage (incidents, dashboard, assistant)
  http/              app Express, middlewares, routes fines
  realtime/          hub SSE
  jobs/              contrôle des retards 24 h
  container.ts       SEUL endroit qui choisit les adapters
  db.ts              client Prisma
apps/api/prisma/     schéma, migrations, seed
packages/shared/src/ config/, domain/ (règles pures testées), types/
apps/web/src/        app/ (routes, layouts), features/<domaine>/, components/, lib/
```

## Règles de code
- Contrôle d'accès dans les services (filtres Prisma), jamais seulement dans l'UI.
- L'identité vient de `req.user` (jeton vérifié), jamais du corps ou de la query.
- Règles métier pures dans `packages/shared/src/domain`, réutilisées par le front et l'API.
- Pas de valeur métier en dur dans les composants.
- Dates ISO 8601 dans les contrats HTTP.
- Libellés UI en français ; code, fichiers et commits en anglais.
- Pas de secret dans le dépôt (`.env` ignoré, `.env.example` fourni).
- Mobile-first, labels sur tous les champs, contrastes AA, focus visible.

## Commandes
`docker compose up -d` (PostgreSQL) · `npm run setup` · `npm run dev` · `npm run seed` · `npm test` · `npm run typecheck` · `npm run lint`

## Git
Commit à la fin de chaque étape : `feat(<étape>): ...`.
