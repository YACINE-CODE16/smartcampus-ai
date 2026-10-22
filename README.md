# SmartCampus AI

Signaler et suivre un incident du campus en moins de 2 minutes ; donner à l'administration une vision en temps réel de l'état du campus.
Workshop Capgemini × ESIEA — MVP déployé sur AWS (EC2 + RDS + S3 + Bedrock, us-east-1).

- **Rôles** : étudiant (`STUDENT`), agent (`AGENT`), administrateur (`ADMIN`)
- **Stack** : monorepo npm · React + Vite · Node + Express + TypeScript · Prisma + PostgreSQL
- Spécifications : [`.kiro/specs/smartcampus-ai/`](.kiro/specs/smartcampus-ai/) · Règles et conventions : [`.kiro/steering/`](.kiro/steering/)

## Prérequis
- Node.js 20.12+ et npm
- Docker Desktop (PostgreSQL de développement)

## Démarrer en local

```bash
npm install
npm run setup     # .env, PostgreSQL (docker, port 55432), migrations, données de démo
npm run dev       # API http://localhost:3000 + front http://localhost:5173
```

Ouvrir http://localhost:5173 et cliquer sur un compte de démonstration.

## Comptes de démo (mot de passe `Campus2026!`)

| Rôle | Email |
|---|---|
| Étudiant | alice.martin@esiea.fr |
| Étudiant | bob.durand@esiea.fr |
| Agent | karim.benali@esiea.fr |
| Agent | julie.robert@esiea.fr |
| Admin | claire.moreau@esiea.fr |

Le SSO école est **simulé** par ces comptes (aucune inscription).

## Scripts (à la racine)

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode watch |
| `npm run setup` | prépare l'environnement local complet |
| `npm run seed` | réinitialise les données de démo (60 tickets sur 30 jours) |
| `npm test` | tests unitaires + tests d'accès de l'API (PostgreSQL requis) |
| `npm run typecheck` / `npm run lint` | vérifications |
| `npm run db:migrate` / `npm run db:studio` | migrations Prisma / explorateur de base |

## Adapters (variables de `apps/api/.env`)

| Port | Variable | Valeurs |
|---|---|---|
| Authentification | `AUTH_PROVIDER` | `local` (SSO simulé) |
| Stockage des photos | `STORAGE_DRIVER` | `local` (dossier `apps/api/storage/uploads`) · `s3` (`S3_BUCKET`) |
| Assistant IA | `AI_DRIVER` | `mock` (FAQ par mots-clés) · `bedrock` (`BEDROCK_MODEL_ID`, us-east-1) |

## Arborescence

```
apps/web/        front React (proxy /api → API en dev)
apps/api/        API Express
  prisma/        schéma, migrations, seed, FAQ
  src/ports/     AuthProvider, FileStorage (AiAssistant à venir)
  src/adapters/  implémentations locales et AWS
  src/services/  cas d'usage métier
  src/http/      routes et middlewares
  test/          tests d'accès (intégration)
packages/shared/ règles métier pures, configuration, types partagés
```

## Avancement
Voir [`tasks.md`](.kiro/specs/smartcampus-ai/tasks.md). Étapes 1 à 3 terminées (connexion, signalement, suivi).
