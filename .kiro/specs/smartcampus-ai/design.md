# Conception — SmartCampus AI

> Stratégie : une version **100 % locale** d'abord (phases 0 à 8), sans dépendance AWS, puis une **migration AWS en phase 9** en remplaçant les adapters. Le code métier ne change pas entre les deux.

## 1. Vue d'ensemble (local)

```
 Navigateur ──▶ apps/web  (React + Vite, http://localhost:5173)
                   │  /api/*  (proxy Vite → même origine, cookie httpOnly)
                   ▼
               apps/api  (Node + Express + TypeScript, http://localhost:3000)
                   │
     ┌─────────────┼──────────────────────────────────────────────┐
     │  http/      routes, middlewares (auth, rôle, validation)    │
     │  services/  cas d'usage métier — ne dépendent QUE des ports │
     │  ports/     interfaces d'adapters                           │
     │  adapters/local/  implémentations locales                   │
     └─────────────┬──────────────────────────────────────────────┘
                   ▼
   SQLite (Prisma) · disque (photos) · boîte d'envoi locale (emails)
   assistant mock · minuterie in-process · SSE (temps réel)

 packages/shared : configuration métier, règles pures, types — importé par web ET api
```

**Principe clé :** les routes HTTP sont fines ; elles authentifient, valident l'entrée puis appellent un service. Les services appliquent les règles (`packages/shared/src/domain`) et les droits d'accès, et n'utilisent que les **ports**. Seule la racine de composition (`apps/api/src/container.ts`) choisit les implémentations, selon `ADAPTERS_MODE` (`local` aujourd'hui, `aws` en phase 9).

## 2. Ports (interfaces d'adapters)

Définis dans `apps/api/src/ports/`.

| Port | Rôle | Implémentation locale | Implémentation AWS (phase 9) | Phase |
|---|---|---|---|---|
| `AuthProvider` | inscription, vérification, connexion, vérification du jeton, rôles | comptes SQLite, mots de passe hachés (scrypt natif Node), **JWT** HS256 en cookie httpOnly | Cognito (groupes) ; inscription/connexion côté navigateur via Amplify Auth ; vérification avec `aws-jwt-verify` | 1 |
| `Repositories` (incidents, événements, notes, conversations, notifications, catégories) + `UnitOfWork` | persistance, écritures atomiques et conditionnelles | **Prisma + SQLite**, transactions Prisma | DynamoDB via Amplify Data / AppSync, `TransactWriteItems` | 2+ |
| `FileStorage` | photos : cible d'envoi, URL de lecture temporaire, suppression | **disque local** (`UPLOAD_DIR`), URL signées HMAC servies par l'API | S3, URL présignées | 2 |
| `RealtimePublisher` | pousser « quelque chose a changé » aux bons destinataires | **SSE** (`GET /api/events`) | subscriptions AppSync | 4 |
| `Scheduler` | tâches planifiées (fermeture J+7) | minuterie dans le processus de l'API | EventBridge Scheduler → Lambda | 4 |
| `AiAssistant` + `KnowledgeProvider` | réponses de l'assistant, recherche FAQ | **mock** déterministe + FAQ JSON | Bedrock Converse (`BEDROCK_MODEL_ID`) + FAQ JSON (puis Knowledge Base) | 6 |
| `Mailer` | emails | **boîte d'envoi locale** : console + fichiers `.eml` dans `storage/outbox` | Amazon SES | 1 (code de vérification), 7 |

`RealtimePublisher` n'était pas dans la liste du brief. Je l'ai ajouté parce que le temps réel est la partie qui change le plus entre local (SSE) et AWS (AppSync).

## 3. Configuration et règles partagées (`packages/shared`)

Aucune règle métier en dur dans l'UI ni dans l'API : tout vient de `@smartcampus/shared`.

- `config/roles.ts` : rôles, libellés, priorité `ADMIN > TECHNICIAN > STUDENT`, `primaryRole()`.
- `config/statuses.ts` : statuts, libellés, **table unique des transitions** (`TRANSITIONS`).
- `config/urgencies.ts`, `config/buildings.ts`, `config/categories.ts` (catégories par défaut, ensuite gérées en base), `config/settings.ts` (J+7, 12 mois, 10 Mo, TTL des URL).
- `types/entities.ts` : entités ; dates en chaînes ISO 8601 (identique en SQLite, JSON et DynamoDB).
- `types/api.ts` : contrats HTTP.
- `domain/` (phase 2+) : fonctions pures testées (`allowedTransitions`, `canTransition`, `buildTitle`, `trackingNumber`, politique d'accès, calculs KPI). Le front s'en sert pour afficher les bonnes actions et l'API pour les imposer.
- `faq/faq.json` (phase 6) : 20 Q/R.

## 4. Modèle de données (Prisma / SQLite)

Les modèles sont ajoutés à `apps/api/prisma/schema.prisma` au fil des phases ; les types exposés sont ceux de `packages/shared/src/types/entities.ts`.

| Modèle | Champs principaux | Phase |
|---|---|---|
| **User** | id, email (unique), name, passwordHash, emailVerified, verificationCode(+expiration), roles (table `UserRole`), createdAt | 1 |
| **Incident** | id, trackingNumber, title, categoryId, categoryLabel*, building, room, description, photoKey?, urgency, status, ownerId, ownerName*, assignedToId?, assignedToName*, technicianComment?, createdAt, updatedAt, resolvedAt?, closedAt?, anonymizedAt? | 2 |
| **IncidentEvent** | id, incidentId, type (`CREATED`/`STATUS`/`ASSIGN`/`URGENCY`/`COMMENT`), fromStatus?, toStatus, comment?, authorId?, authorName*, authorRole, createdAt | 2 |
| **Category** | id, label, description?, active, order | 2 |
| **Rating** | id, incidentId (unique), ownerId, score 1–5, comment?, createdAt | 3 |
| **AssistantConversation** | id, ownerId, messages (JSON), helpful?, ticketCreated, incidentId?, createdAt | 6 |
| **Notification** | id, userId, type, incidentId, title, read, createdAt | 7 |

`*` champs dénormalisés (choix D9) : affichage sans jointure ni exposition de l'annuaire, et transposition directe vers DynamoDB.

**Numéro de suivi (D3)** : `SC-` + 8 premiers caractères de l'id en majuscules.

## 5. Authentification et autorisations

- **Jeton** : JWT signé par l'API (`JWT_SECRET`), contenant `sub`, `email`, `name`, `roles` ; durée 8 h ; transmis en **cookie httpOnly `SameSite=Lax`**. Le cookie permet aussi d'authentifier le flux SSE (`EventSource` ne sait pas envoyer d'en-tête).
- **Inscription** : nom, email, mot de passe → code à 6 chiffres envoyé via `Mailer` (visible dans la console de l'API et dans `apps/api/storage/outbox/`) → compte activé + rôle `STUDENT`.
- **Middlewares** : `requireAuth` (vérifie le jeton via `AuthProvider`, place `req.user`), `requireRole(...roles)`.
- **Politique d'accès** (service + règles pures partagées), appliquée côté API sur chaque lecture et écriture :

| Ressource | STUDENT | TECHNICIAN | ADMIN |
|---|---|---|---|
| Incident (lecture) | les siens | assignés à lui + file « à prendre » via route dédiée | tous |
| Historique d'un incident | si l'incident est lisible | idem | tous |
| Photos | les siennes | incidents assignés | toutes |
| Conversations IA | les siennes | ✗ | ✗ (statistiques agrégées uniquement) |
| Catégories | lecture (actives) | lecture | CRUD |
| Tableau de bord | ✗ | ✗ | ✓ |

- **File « à prendre » (décision PO)** : route dédiée `GET /api/technician/queue` (rôles TECHNICIAN, ADMIN) qui ne renvoie que les incidents non assignés et non fermés. Un technicien ne peut jamais lire un incident assigné à un collègue (`GET /api/incidents/:id` → 403).
- L'identité vient **toujours** du jeton, jamais du corps ou de la query de la requête.

## 6. API HTTP (prévisionnelle)

| Méthode et route | Rôles | Service | Phase |
|---|---|---|---|
| `GET /api/health` | public | — | 0 |
| `POST /api/auth/signup` · `/confirm` · `/login` · `/logout` · `GET /api/auth/me` | public / connecté | AuthService | 1 |
| `GET /api/categories` | connecté | CategoryService | 2 |
| `POST /api/files/upload-target` · `PUT /api/files/upload/:token` · `GET /api/files/:token` | connecté | FileService | 2 |
| `POST /api/incidents` | STUDENT | IncidentWorkflow.report | 2 |
| `GET /api/incidents?mine=1` · `GET /api/incidents/:id` · `GET /api/incidents/:id/events` | selon politique | IncidentQueries | 3 |
| `POST /api/incidents/:id/reopen` · `POST /api/incidents/:id/rating` | STUDENT (propriétaire) | IncidentWorkflow | 3 |
| `GET /api/technician/queue` · `GET /api/technician/incidents` | TECHNICIAN, ADMIN | IncidentQueries | 4 |
| `POST /api/incidents/:id/take` | TECHNICIAN | IncidentWorkflow.take (écriture conditionnelle) | 4 |
| `POST /api/incidents/:id/status` · `PATCH /api/incidents/:id/urgency` | TECHNICIAN (assigné), ADMIN | IncidentWorkflow | 4 |
| `GET /api/admin/incidents?status&categoryId&building&urgency&assignedToId` · `POST /api/incidents/:id/assign` · `GET /api/admin/technicians` | ADMIN | IncidentQueries / Workflow | 4 |
| `POST/PATCH /api/admin/categories` | ADMIN | CategoryService | 4 |
| `GET /api/events` (SSE) | connecté | RealtimePublisher | 4 |
| `GET /api/admin/dashboard` | ADMIN | DashboardService | 5 |
| `POST /api/assistant/messages` · `POST /api/assistant/conversations/:id/feedback` | STUDENT | AssistantService | 6 |
| `GET /api/notifications` · `POST /api/notifications/:id/read` · `/read-all` | connecté | NotificationService | 7 |

Erreurs : corps `{ error, message }` ; `DomainError` → 400/401/403/404/409.

## 7. Temps réel (SSE)

- `GET /api/events` garde une connexion ouverte par onglet ; le hub en mémoire indexe les connexions par `userId` et par rôle.
- Les services publient des événements **sans contenu sensible** (`incident.changed`, `queue.changed`, `notification.created` + identifiant). Le client recharge la ressource via l'API, qui applique les droits.
- Destinataires : propriétaire + technicien assigné + rôle ADMIN pour `incident.changed` ; rôle TECHNICIAN pour `queue.changed` ; destinataire seul pour `notification.created`.
- Reconnexion automatique native d'`EventSource` ; ping toutes les 25 s.
- Phase 9 : remplacé par les subscriptions AppSync ; le hook front `useRealtime` garde la même signature.

## 8. Services métier (`apps/api/src/services/`)

- **AuthService** : délègue à `AuthProvider`, pose et retire le cookie.
- **IncidentWorkflow** : `report`, `take`, `assign`, `changeStatus`, `updateUrgency`, `reopen`, `rate`. Pour chaque action : contrôle d'accès, `canTransition`, écriture atomique (incident + événement [+ note] [+ notification]) via `UnitOfWork`, publication temps réel, email (dont l'échec est journalisé sans bloquer).
- **IncidentQueries** : lectures filtrées par la politique d'accès.
- **DashboardService** : KPIs et séries des graphiques (calculs purs dans `shared/domain/kpi.ts`).
- **AssistantService** : charge la conversation (propriétaire uniquement), récupère les passages FAQ et **les incidents de l'utilisateur connecté uniquement**, appelle `AiAssistant`, persiste.
- **NotificationService** : crée la notification, publie, envoie l'email.
- **Jobs** (`apps/api/src/jobs/`) : `auto-close` (quotidien, `0 3 * * *`), enregistré auprès du `Scheduler` ; exécutable à la demande (`npm run job -- auto-close`).

## 9. Assistant IA (mock local)

- Le **mock** est déterministe et suffisant pour la démo et les tests :
  1. intention « suivi » (`mon signalement`, `où en est`, `SC-…`) → répond avec le statut réel des incidents de l'utilisateur ;
  2. sinon, recherche FAQ (normalisation des accents, recouvrement de mots-clés, seuil de score) → réponse tirée de la FAQ ;
  3. sinon → « Je ne sais pas répondre à cette question » + `suggestedIncident` (catégorie devinée par mots-clés, description = message de l'étudiant).
- Chaque réponse rappelle que l'assistant peut être incomplet.
- Contrat de sortie identique à celui de Bedrock (phase 9) : `{ answer, answeredFromSources, suggestedIncident? }`. Le prompt système de la version Bedrock est versionné dès la phase 6 (`apps/api/src/services/assistant/system-prompt.ts`).

## 10. Front-end (`apps/web`)

```
/connexion · /inscription · /verification     écrans d'auth (FR)
/                             redirection selon le rôle principal
/etudiant                     Mes signalements
/etudiant/signaler            Formulaire (pré-remplissable via state de navigation)
/etudiant/incidents/:id       Détail, timeline, réouverture, note
/etudiant/assistant           Chat
/technicien                   Onglets « À prendre » / « Mes incidents »
/technicien/incidents/:id     Détail + actions
/admin                        Tableau de bord
/admin/incidents(/:id)        Liste filtrable, assignation
/admin/categories             Catégories
/mentions                     Mentions et données personnelles (publique)
```

- React Router, Recharts, CSS natif à variables, mobile-first.
- Amplify UI n'est plus utilisé en local : les écrans d'auth sont faits maison (formulaires simples). En phase 9, choix entre garder ces écrans branchés sur Amplify Auth ou passer à l'`Authenticator` Amplify UI.
- Accès aux données via un petit client `api.ts` (fetch + gestion d'erreurs) et des hooks `useXxx` ; `authClient` isole l'authentification pour la phase 9.

## 11. Préparation des « Could »

- `packages/shared/src/domain/triage.ts` : interface `TriageSuggester` (`suggest(description) → { categoryId?, urgency?, confidence }`) sans implémentation.
- Le formulaire de signalement accepte des valeurs initiales (déjà utilisé par l'assistant).
- `GET /api/admin/dashboard` renvoie des sections nommées, extensibles.

## 12. RGPD — anonymisation

Service `anonymizeClosedIncidents(now)` + script `npm run anonymize` : incidents `FERME` depuis plus de 12 mois → description `[anonymisé]`, photo supprimée via `FileStorage`, commentaires effacés, `ownerId`/`ownerName` remplacés, `anonymizedAt` renseigné. Catégorie, bâtiment, dates, urgence et note sont conservés.

## 13. Phase 9 — migration AWS (cible)

1. Implémenter `adapters/aws/` pour chaque port (Cognito, DynamoDB/Amplify Data, S3, SES, Bedrock, EventBridge, AppSync) et ajouter `ADAPTERS_MODE=aws` dans `container.ts`.
2. Les services, les règles partagées et le front restent inchangés, à l'exception de `authClient` et `useRealtime` côté web.
3. Hébergement : Amplify Hosting (front) ; les services tournent dans des Lambdas (résolveurs AppSync ou API derrière API Gateway). L'option sera arbitrée avec le PO en début de phase 9.
4. Les tests des services tournent contre les deux jeux d'adapters.

## 14. Décisions validées par le PO

| # | Sujet | Choix |
|---|---|---|
| D1 | Sous-catégories | une catégorie = libellé + description d'exemples |
| D2 | Lieu | bâtiment dans une liste configurable + salle en texte libre |
| D3 | Numéro de suivi | `SC-` + 8 caractères de l'id |
| D4 | « Prendre en charge » | assigne **et** passe à `EN_COURS` |
| D5 | Réouverture | retour à `OUVERT`, même technicien assigné |
| D6 | Délai de résolution après réouverture | jusqu'à la dernière résolution |
| D7 | Assignation par l'admin | ne change pas le statut ; événement `ASSIGN` |
| D8 | Saut `OUVERT → RESOLU` | interdit |
| D9 | Champs dénormalisés | ajoutés (noms d'affichage) |
| D10 | « Étudiant actif » | ≥ 1 signalement ou conversation sur 30 jours |
| D11 | Visibilité des photos | propriétaire, technicien assigné, admin ; URL temporaires signées |
| D12 | File « à prendre » | route serveur dédiée ; temps réel par SSE en local |

## 15. Décisions techniques prises par défaut (nouvelles, à signaler)

| # | Sujet | Choix |
|---|---|---|
| T1 | Framework API | Express 5 + validation zod |
| T2 | Temps réel local | SSE plutôt que WebSocket (unidirectionnel suffit, natif navigateur, passe par le proxy Vite) |
| T3 | Transport du JWT | cookie httpOnly (compatible SSE, pas de jeton en JS) |
| T4 | Hachage des mots de passe | `crypto.scrypt` natif Node (aucune dépendance) |
| T5 | Paquet partagé | consommé en TypeScript source (pas de build) par Vite et tsx |
| T6 | Port supplémentaire | `RealtimePublisher` |
| T7 | Emails locaux | console + fichiers `.eml` (pas de serveur SMTP à installer) |
