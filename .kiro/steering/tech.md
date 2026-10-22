---
inclusion: always
---

# Conventions techniques

## Stack (imposée)
- **Backend** : AWS Amplify Gen 2 (TypeScript, dossier `amplify/`)
  - Auth : Cognito, groupes `STUDENT`, `TECHNICIAN`, `ADMIN`
  - Data : Amplify Data (AppSync + DynamoDB), autorisations déclarées dans le schéma
  - Storage : S3 (photos), chemins par identité
  - Functions : Lambda Node.js/TypeScript (workflow incidents, assistant Bedrock Converse, fermeture J+7 planifiée, notifications SES)
- **Front** : React + Vite + TypeScript, Amplify UI (auth), React Router, Recharts
- **Région** : `eu-west-3` (Paris). Modèle Bedrock configurable via `BEDROCK_MODEL_ID`.
- **Hébergement** : Amplify Hosting, déploiement auto sur `main`.

## Arborescence
```
amplify/                 backend Amplify Gen 2
  auth/ data/ storage/   ressources
  functions/<nom>/       une Lambda par dossier (resource.ts + handler.ts)
shared/                  code partagé front + Lambdas (aucune dépendance AWS/React)
  config/                catégories par défaut, statuts, transitions, urgences, bâtiments
  domain/                règles pures (ex. canTransition), testables unitairement
  faq/faq.json           FAQ versionnée de l'assistant
src/
  app/                   routage, layout, garde de rôle
  features/<domaine>/    incidents, technician, admin, dashboard, assistant, notifications
  components/            composants UI réutilisables
  lib/                   client Amplify, helpers
scripts/                 set-role, seed, anonymize (exécutés avec tsx)
.kiro/                   specs et steering
```

## Règles de code
- TypeScript strict partout ; pas de `any` sauf justification commentée.
- Les règles métier vivent dans `shared/domain` et sont réutilisées par le front (affichage) **et** les Lambdas (validation).
- Aucune valeur métier en dur dans les composants : importer depuis `shared/config`.
- Libellés UI en français ; identifiants de code, noms de fichiers et commits en anglais.
- Enums stockés en MAJUSCULES sans accent (`EN_COURS`), libellés affichés via la config.
- Commentaires là où ils expliquent un *pourquoi*, pas un *quoi*.
- Pas de secret dans le code : variables d'environnement Amplify / `secret()`.
- Composants petits, une responsabilité ; hooks `useXxx` pour l'accès aux données.
- Mobile-first : styles pensés pour 360 px puis élargis.

## Git
- Un commit (au minimum) à la fin de chaque phase : `feat(phaseN): ...`.
- Branche `main` = production (Amplify Hosting).

## Tests
- Logique pure (`shared/domain`) couverte par des tests unitaires (Vitest).
- Chaque phase se termine par un scénario de test manuel décrit au PO.
