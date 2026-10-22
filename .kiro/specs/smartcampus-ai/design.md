# Conception — SmartCampus AI

> Contexte : workshop Capgemini × ESIEA. MVP démontrable déployé sur AWS le vendredi 23/10.
> Même code en local et en production ; seules les variables d'environnement changent.

## 1. Vue d'ensemble

```
                       LOCAL                                      PRODUCTION (us-east-1)
 Navigateur ─▶ Vite :5173 ──/api──▶ API :3000          Navigateur ─HTTPS─▶ EC2 : Traefik (Let's Encrypt)
                                      │                                     ├─ /      → web (nginx, build Vite)
                         PostgreSQL (docker-compose)                        └─ /api/* → api (Node)
                         dossier ./storage/uploads                                       │
                         assistant mock                          RDS PostgreSQL ◀────────┤
                                                                 S3 (photos)    ◀────────┤  rôle IAM de l'instance
                                                                 Bedrock Converse ◀──────┘
```

- **Monorepo npm** : `apps/web` (React + Vite), `apps/api` (Node + Express + TypeScript + Prisma), `packages/shared` (configuration, règles pures, types).
- **Base** : PostgreSQL partout (docker-compose en local, RDS en production) → aucune migration de code entre les deux.
- **Adapters activables par variable d'environnement** :

| Port | Variable | Local | Production |
|---|---|---|---|
| `AuthProvider` | `AUTH_PROVIDER=local` | comptes seedés + JWT (cookie httpOnly) | identique (SSO simulé) ; vrai SSO plus tard |
| `FileStorage` | `STORAGE_DRIVER=local\|s3` | dossier `apps/api/storage/uploads` | bucket S3 (`S3_BUCKET`) |
| `AiAssistant` | `AI_DRIVER=mock\|bedrock` | mock mots-clés sur la FAQ | Bedrock Converse (`BEDROCK_MODEL_ID`, us-east-1) |

- Les services métier n'importent que ces ports et Prisma. Seul `container.ts` instancie les adapters.
- **Simplification assumée** : comme PostgreSQL est identique en local et sur RDS, l'abstraction `Repositories` / `UnitOfWork` est supprimée (Prisma est utilisé directement par les services, avec des transactions Prisma). Les ports `Mailer` (emails : Won't) et `Scheduler` sont aussi supprimés. Le contrôle des retards de 24 h est un simple intervalle dans l'API, avec une instance unique sur EC2.

## 2. Règles métier (`packages/shared`)

### Rôles
`STUDENT`, `AGENT`, `ADMIN`. Pas d'inscription : les comptes sont seedés (US-02 = Could).

### Statuts et transitions
```
            ┌──────────── REJETE (motif obligatoire) ◀─────────┐
            │                                                   │
 NOUVEAU ───┴─▶ EN_COURS ──▶ RESOLU ──(confirmation)──▶ FERME   │
                   ▲            │                               │
                   └(contest.)──┘   NOUVEAU / EN_COURS ─────────┘
```
| De | Vers | Qui | Conditions / effets |
|---|---|---|---|
| NOUVEAU | EN_COURS | AGENT affecté (ou qui prend le ticket non affecté), ADMIN | `takenAt` renseigné ; prise en charge = affectation à soi si non affecté (D4) |
| NOUVEAU, EN_COURS | REJETE | AGENT affecté, ADMIN | motif obligatoire (US-17, Should) |
| EN_COURS | RESOLU | AGENT affecté, ADMIN | `resolvedAt = now` |
| RESOLU | FERME | STUDENT propriétaire (confirme), ADMIN | `closedAt = now` (US-11, Should) |
| RESOLU | EN_COURS | STUDENT propriétaire (conteste) | `reopenCount + 1`, `resolvedAt` effacé (US-11, Should) |

Une table unique `TRANSITIONS` dans `packages/shared/src/config/statuses.ts`, et une fonction pure `canTransition(ticket, to, actor)` utilisée par le front (pour afficher les boutons) et par l'API (pour imposer la règle).

### Priorité
`priority = category.autoPriority ?? urgency`. La catégorie Sécurité a `autoPriority = CRITIQUE` (dans la base, pas en dur). Un ticket critique créé déclenche une alerte temps réel dans l'espace admin.

### Retard
`isLate = status === 'NOUVEAU' && now - createdAt > 24 h` (calculé, pas stocké). Une tâche toutes les 15 min marque `lateNotifiedAt` et crée la notification étudiant (avec US-10).

### Accès (R1), appliqué dans chaque requête Prisma
| Ressource | STUDENT | AGENT | ADMIN |
|---|---|---|---|
| Ticket, historique, photo | `ownerId = moi` | `assignedToId = moi` OU `assignedToId IS NULL` | tout |
| Modifier un ticket | confirmer / contester les siens | les siens (affectés) ; prendre les non affectés | tout |
| Dashboard, affectation | ✗ | ✗ | ✓ |
| Assistant | ses tickets uniquement dans le contexte | ✗ | ✗ |

Un ticket non autorisé renvoie **404** (on ne révèle pas son existence).

## 3. Modèle de données (Prisma, PostgreSQL)

| Modèle | Champs |
|---|---|
| **User** | id, email (unique), name, role, passwordHash, createdAt |
| **Category** | id, slug (unique), label, description, autoPriority?, order, active |
| **Building** | id, code (unique), name, order |
| **Incident** | id (uuid), number (autoincrement → `SC-0001`), title, categoryId, buildingId, room, description, photoKey?, urgency, priority, status, ownerId, assignedToId?, reopenCount, rejectionReason?, createdAt, updatedAt, takenAt?, resolvedAt?, closedAt?, lateNotifiedAt? |
| **IncidentEvent** | id, incidentId, type (`CREATED`/`STATUS`/`ASSIGN`/`UPDATE`), fromStatus?, toStatus?, comment?, authorId?, authorRole (`STUDENT`/`AGENT`/`ADMIN`/`SYSTEM`), createdAt |
| **FaqEntry** | id, question, answer, keywords[], category? |
| **Notification** (Should) | id, userId, incidentId, type, message, read, createdAt |
| **AssistantFeedback** (Should) | id, userId, messageId, helpful, createdAt |

Index : `Incident(ownerId)`, `Incident(assignedToId, status)`, `Incident(createdAt)`, `IncidentEvent(incidentId, createdAt)`.
Titre automatique : `« <Catégorie> – <Bâtiment> <salle> »` (pas de champ titre dans le formulaire).

## 4. API HTTP

| Méthode et route | Rôles | US |
|---|---|---|
| `GET /api/health` | public | — |
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/auth/demo-accounts` (si `DEMO_MODE`) | public / connecté | US-01 |
| `GET /api/referentials` (catégories, bâtiments, urgences) | connecté | US-03 |
| `POST /api/incidents` (multipart : champs + `photo`) | STUDENT | US-03/04/05 |
| `GET /api/incidents` (filtres : `status`, `categoryId`, `buildingId`, `assignedToId`, `scope=mine\|unassigned`) | tous, filtrés par R1 | US-08, US-13 |
| `GET /api/incidents/:id` (avec historique) | R1 | US-09 |
| `GET /api/incidents/:id/photo` | R1 | US-04 |
| `POST /api/incidents/:id/assign` `{ agentId }` | ADMIN | US-13 |
| `POST /api/incidents/:id/take` | AGENT, ADMIN | US-14 |
| `POST /api/incidents/:id/transition` `{ to, comment?, reason? }` | selon la table | US-14, US-11, US-17 |
| `GET /api/agents` | ADMIN | US-13 |
| `GET /api/admin/dashboard?period=7d\|30d\|all` | ADMIN | US-28/29/30 |
| `GET /api/admin/alerts` (critiques ouverts + retards) | ADMIN | R3, R4 |
| `POST /api/assistant/ask` `{ message, history[] }` | STUDENT | US-19/21/26 |
| `GET /api/events` (SSE) | connecté | temps réel |

Erreurs : `{ error, message }` → 400 (validation), 401, 403, 404, 409 (transition interdite ou conflit de prise en charge).

## 5. Authentification (SSO simulé)
- `LocalAuthProvider.authenticate(email, password)` : vérifie le hash scrypt du compte seedé.
- Jeton JWT HS256 (8 h) en cookie `sc_session` httpOnly, `SameSite=Lax`, `Secure` en production.
- Middleware `requireAuth` → `req.user = { id, email, name, role }` ; `requireRole(...)`.
- La page « Connexion école » propose, en mode démo, des boutons de connexion rapide pour les 5 comptes.
- Brancher un vrai SSO (OIDC de l'école) = nouvel `AuthProvider` + route de callback ; le reste du code ne change pas.

## 6. Temps réel (SSE)
Hub en mémoire (instance unique). Événements ne contenant que des identifiants : `incident.created`, `incident.updated`, `alert.critical`. Destinataires : propriétaire, agent affecté, tous les agents (file non affectée), tous les admins. Le front recharge via l'API, qui applique R1.

## 7. Assistant IA
```
POST /api/assistant/ask
  → FAQ (base) + 10 derniers tickets DE L'UTILISATEUR CONNECTÉ (chargés côté serveur par req.user.id)
  → AiAssistant.reply(message, contexte)
  → { answer, kind: 'faq'|'ticket_status'|'needs_ticket'|'out_of_scope', sources: [{ faqId, question }], suggestedTicket? }
```
- **Mock** : (1) hors périmètre → refus ; (2) intention « suivi » → statut réel des tickets ; (3) recherche mots-clés FAQ (normalisation des accents, score de recouvrement) → réponse + source ; (4) sinon ou si une intervention est nécessaire (« cassé », « bloqué », « en panne »…) → `needs_ticket` + ticket pré-rempli (catégorie, bâtiment et salle détectés par mots-clés).
- **Bedrock** : API Converse, `BEDROCK_MODEL_ID` (Claude Haiku via un profil d'inférence `us.` ou Amazon Nova Lite), prompt système versionné (`services/assistant/system-prompt.ts`) qui impose le français, les sources uniquement, la citation de la FAQ, le refus hors périmètre et une sortie JSON au même format que le mock. En cas d'erreur Bedrock, l'API bascule sur le mock et le journalise.
- Mention IA permanente dans le chat (US-26).

## 8. Front-end (`apps/web`)
```
/connexion                       Connexion école (SSO simulé)
/etudiant                        Mes signalements          (US-08)
/etudiant/signaler               Formulaire                (US-03/04/05, pré-remplissable US-21)
/etudiant/tickets/:id            Détail + historique       (US-09, US-11)
/etudiant/assistant              Assistant IA              (US-19/21/26)
/agent                           Onglets « Mes tickets » / « Non affectés »
/agent/tickets/:id               Détail + actions          (US-14)
/admin                           Tableau de bord           (US-28/29/30) + alertes
/admin/tickets(/:id)             Liste filtrable + affectation (US-13)
/mentions                        Mentions et données personnelles
```
React Router 7, Recharts, CSS natif à variables, mobile-first. Client `api.ts` (fetch + cookie), hook `useLiveEvents` (SSE).

## 9. Déploiement (cible du 23/10)
- **Images** : `apps/api/Dockerfile` (Node 22 alpine, `prisma migrate deploy` au démarrage) ; `apps/web/Dockerfile` (build Vite → nginx).
- **`docker-compose.prod.yml`** : `traefik` (ports 80/443, Let's Encrypt, domaine `<ip>.sslip.io`), `api`, `web`. La base est RDS (pas de conteneur Postgres en production).
- **AWS** : EC2 t3.small (Amazon Linux 2023 + Docker), RDS PostgreSQL db.t4g.micro (chiffrement au repos), bucket S3 privé (SSE-S3, accès public bloqué), rôle IAM d'instance (S3 du bucket + `bedrock:InvokeModel`). Avec des identifiants de lab temporaires, on utilise le rôle d'instance fourni si la création de rôle est interdite.
- **Groupes de sécurité** : EC2 ← 80/443 depuis Internet, 22 depuis votre IP ; RDS ← 5432 depuis le groupe de sécurité de l'EC2 uniquement.
- Détails, coûts et suppression : `DEPLOY.md`.

## 10. Données de démo (`npm run seed`)
5 comptes (2 étudiants, 2 agents, 1 admin), 6 catégories, 5 bâtiments, 20 FAQ, 60 tickets sur 30 jours (tous statuts, avec historiques cohérents ; dont 2 Sécurité et 3 `NOUVEAU` créés il y a plus de 24 h). Idempotent : vide puis recrée les données.

## 11. Décisions
| # | Sujet | Choix |
|---|---|---|
| D1 | Sous-catégories | aucune ; libellé + description d'exemples |
| D2 | Lieu | bâtiment (liste en base) + salle en texte libre |
| D3 | Numéro de ticket | **séquentiel `SC-0001`** (autoincrement PostgreSQL ; remplace le préfixe d'id) |
| D4 | Prendre en charge | affecte à soi **et** passe `EN_COURS` |
| D5 | Contestation | retour à `EN_COURS` (règle BA), même agent, `reopenCount + 1` |
| D6 | Délai de résolution | jusqu'à la dernière résolution |
| D7 | Affectation | ne change pas le statut ; événement `ASSIGN` |
| D8 | Saut `NOUVEAU → RESOLU` | interdit |
| D9 | Noms affichés | via les relations Prisma (plus de champs dénormalisés) |
| D11 | Photos | servies par l'API après contrôle d'accès |
| D12 | File non affectée | requête serveur dédiée (`scope=unassigned`) ; temps réel SSE |
| D13 | Prise en charge (règle 24 h) | = sortie du statut `NOUVEAU` |
| D14 | Titre | généré automatiquement, pas de champ dans le formulaire |
| D15 | Envoi des photos | multipart vers l'API, qui écrit via `FileStorage` (pas d'URL présignée) |
