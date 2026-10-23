# Conception — SmartCampus AI

> Périmètre : US-01 à US-38. Même code en local et en production ; seules les variables d'environnement changent.

## 1. Architecture

```
                LOCAL                                          PRODUCTION (us-east-1)
 Navigateur ─▶ Vite :5173 ──/api──▶ API :3000      Navigateur ─HTTPS─▶ EC2 · Traefik (Let's Encrypt)
                                     │                                  ├─ /      → web (nginx)
                PostgreSQL (docker)  │                                  └─ /api/* → api (Node)
                storage/uploads      │                    RDS PostgreSQL ◀──┤
                storage/outbox (.eml)│                    S3 (photos)    ◀──┤ rôle IAM d'instance
                assistant mock       │                    SES (emails)   ◀──┤
                                     │                    Bedrock Converse + Guardrails + Knowledge Base
```

Monorepo : `apps/web` (React + Vite), `apps/api` (Express + Prisma), `packages/shared` (règles pures, configuration, types).

## 2. Ports et adapters (sélection par variables d'environnement)

| Port | Variable | Local | Production | US |
|---|---|---|---|---|
| `AuthProvider` | `AUTH_PROVIDER=local` | comptes seedés (SSO simulé), JWT cookie httpOnly | idem (vrai SSO plus tard) | 01 |
| `FileStorage` | `STORAGE_DRIVER=local\|s3` | dossier `storage/uploads` | S3 privé, SSE-S3 | 04, 34 |
| `Mailer` | `MAIL_DRIVER=console\|ses` | console + `storage/outbox/*.eml` | Amazon SES (`MAIL_FROM`) | 10, 18 |
| `KnowledgeBase` | `KB_DRIVER=local\|bedrock` | FAQ + documents en PostgreSQL, recherche par mots-clés | Bedrock Knowledge Base (`BEDROCK_KB_ID`, API Retrieve) | 19, 20, 24 |
| `AiAssistant` | `AI_DRIVER=mock\|bedrock` | mock déterministe (intentions + mots-clés) | Converse (`BEDROCK_MODEL_ID` = Nova Lite) + Guardrails (`BEDROCK_GUARDRAIL_ID`) | 19–26 |

En production, si Bedrock échoue, l'assistant bascule sur le mock et le journalise. La FAQ gérée par l'admin (US-24) reste en PostgreSQL dans les deux modes ; en mode `bedrock`, les passages de la Knowledge Base complètent ceux de la FAQ.

Hors ports (instance unique sur EC2) : **hub SSE** (temps réel) et **contrôle périodique des délais cibles** (intervalle de 5 min dans l'API).

## 3. Règles métier (`packages/shared/src/domain`)

| Règle | Fonction pure | US |
|---|---|---|
| Transitions autorisées par acteur (agent affecté, propriétaire, admin) | `allowedTransitions`, `findTransition` | 11, 14, 17 |
| Prise en charge d'un ticket non affecté | `canTake` | 14 |
| Visibilité R1 | `canView` | tout |
| Priorité (Sécurité → CRITIQUE) | `computePriority` | 05, 16 |
| Retard selon le délai cible de la catégorie | `isLate(ticket, targetHours, now)` | 18 |
| Peut noter (propriétaire, RESOLU/FERME, pas déjà noté) | `canRate` | 12 |
| Peut fusionner (source ≠ cible, non closes) | `canMerge` | 17 |
| KPI (délai moyen, taux de résolution/réouverture, satisfaction, buckets temporels) | `kpi.ts` | 28–33 |
| Détection de langue FR/EN | `detectLanguage` | 38 |

### Transitions
| De | Vers | Acteurs | Détails |
|---|---|---|---|
| NOUVEAU | EN_COURS | agent affecté, admin | `takenAt` |
| NOUVEAU, EN_COURS | REJETE | agent affecté, admin | motif obligatoire ; audit |
| EN_COURS | RESOLU | agent affecté, admin | `resolvedAt` |
| RESOLU | FERME | propriétaire, admin | `closedAt` |
| RESOLU | EN_COURS | propriétaire | commentaire obligatoire, `reopenCount + 1` |

## 4. Modèle de données (PostgreSQL)

| Modèle | Champs principaux | US |
|---|---|---|
| User | email, name, role, passwordHash, locale (`fr`/`en`), anonymizedAt? | 01, 02, 34, 38 |
| Category | slug, label, labelEn, description, descriptionEn, autoPriority?, **targetHours (24)**, order, active | 03, 18, 38 |
| Building | code, name, order | 03 |
| Incident | number, title, categoryId, buildingId, room, description, photoKey?, urgency, priority, status, ownerId, assignedToId?, reopenCount, rejectionReason?, **mergedIntoId?**, createdAt, takenAt?, resolvedAt?, closedAt?, lateNotifiedAt?, assistantInteractionId? | 03–18, 21 |
| IncidentEvent | type (`CREATED`/`STATUS`/`ASSIGN`/`UPDATE`/`MERGE`), fromStatus?, toStatus?, comment?, authorId?, authorRole | 09 |
| InternalNote | incidentId, authorId, body, createdAt | 15 |
| Rating | incidentId (unique), ownerId, score 1–5, comment? | 12 |
| Notification | userId, incidentId?, type, params (JSON), read, createdAt | 10 |
| FaqEntry | question, answer, questionEn, answerEn, keywords[], topic | 19, 24 |
| KbDocument | title, content, language, createdAt, updatedAt | 24 |
| AssistantInteraction | userId, language, kind, sources (JSON), feedback (`UP`/`DOWN`)?, createdIncidentId?, createdAt — **sans le texte de la question** | 21, 23, 32 |
| AuditLog | actorId, actorRole, action (`ROLE_CHANGE`/`REJECT`/`MERGE`/`DATA_DELETION`/`EXPORT`), targetType, targetId, details (JSON), createdAt | 37 |

## 5. API

| Route | Rôles | US |
|---|---|---|
| `POST /auth/login` · `/logout` · `GET /auth/me` · `GET /auth/demo-accounts` · `PATCH /auth/me` (locale) | — | 01, 38 |
| `GET /referentials` | connecté | 03 |
| `POST /incidents` (multipart) · `GET /incidents` · `GET /incidents/:id` · `GET /incidents/:id/photo` | R1 | 03–09 |
| `GET /incidents/similar?categoryId&buildingId` | STUDENT | 06 |
| `POST /incidents/:id/take` · `/transition` `{to, comment?, reason?}` · `PATCH /incidents/:id` `{categoryId?, urgency?}` | selon transitions | 11, 14, 16, 17 |
| `POST /incidents/:id/assign` `{agentId}` | ADMIN | 13 |
| `POST /incidents/:id/merge` `{targetNumber}` | agent affecté, ADMIN | 17 |
| `GET/POST /incidents/:id/notes` | AGENT (ticket visible), ADMIN | 15 |
| `POST /incidents/:id/rating` | propriétaire | 12 |
| `GET /notifications` · `POST /notifications/:id/read` · `/read-all` | connecté | 10 |
| `GET /events` (SSE) | connecté | 10, 13, R3 |
| `GET /agents` | ADMIN | 13, 33 |
| `GET /admin/alerts` | ADMIN | R3, 18 |
| `GET/PATCH /admin/categories` (délais cibles) | ADMIN | 18 |
| `GET /admin/dashboard?period&granularity` | ADMIN | 28–33 |
| `GET /admin/incidents/export.csv?…` | ADMIN | 27 |
| `GET /admin/users` · `PATCH /admin/users/:id/role` · `POST /admin/users/:id/erase` | ADMIN | 02, 34 |
| `GET /admin/audit` | ADMIN | 37 |
| `GET/POST/PATCH/DELETE /admin/faq` · `/admin/documents` | ADMIN | 24 |
| `POST /assistant/ask` · `POST /assistant/interactions/:id/feedback` · `POST /assistant/triage` | STUDENT | 19–23, 25 |

Erreurs : `{ error, message, fields? }`. Les messages sont localisés selon l'en-tête `Accept-Language` (catalogue FR/EN côté API).

## 6. Temps réel et notifications
- **SSE** `GET /api/events` : hub en mémoire par utilisateur et par rôle. Événements sans contenu sensible : `incident.changed {id}`, `notification {unread}`, `alert {kind}`. Le front recharge via l'API (R1 appliquée).
- **NotificationService.notify(userId, type, incidentId, params)** : crée la notification, pousse `notification` par SSE, envoie l'email via `Mailer` dans la langue de l'utilisateur ; un échec d'email est journalisé.
- Déclencheurs : statut changé (propriétaire), affectation (agent), contestation (agent), rejet/fusion (propriétaire), délai dépassé (propriétaire + alerte admin), ticket critique créé ou requalifié (alerte admin).

## 7. Assistant
```
POST /assistant/ask { message, history[] }
 → langue = detectLanguage(message)
 → passages = KnowledgeBase.search(message, langue)             (FAQ + documents)
 → tickets  = 10 derniers tickets de req.user (jamais d'autres)
 → AiAssistant.reply(message, { passages, tickets, langue, referentials })
 → { interactionId, kind: faq|document|ticket_status|needs_ticket|out_of_scope, answer, sources[], suggestedTicket? }
```
- Le mock : (1) hors périmètre → refus ; (2) intention suivi (`SC-xxxx`, « où en est ») → statuts réels ; (3) passages au-dessus d'un seuil → réponse + source ; (4) sinon ou mot d'intervention (« cassé », « bloqué », « panne »…) → ticket pré-rempli.
- Bedrock : prompt système versionné (`services/assistant/system-prompt.ts`), sortie JSON identique, guardrail appliqué.
- Suggestion de qualification (US-25) : `AiAssistant.suggestTriage(description)` → `{ categorySlug, urgency }`.
- Seuls des agrégats sont visibles par l'admin (US-31) ; le texte des questions n'est pas stocké.

## 8. Front-end
- React Router ; espaces `/etudiant`, `/agent`, `/admin` ; `/connexion`, `/mentions`.
- **i18n** (US-38) : `I18nProvider` + `useI18n()` → `t(fr, en)` pour les textes, plus des helpers pour les libellés métier ; langue mémorisée dans `localStorage` et dans le profil (emails). L'attribut `lang` du document suit la langue.
- Brouillon (US-07) dans `localStorage`, clé par utilisateur.
- Cloche de notifications et alertes admin alimentées par SSE (`useLiveEvents`).
- Recharts pour le dashboard.

## 9. Sécurité (US-36)
En-têtes de sécurité (CSP stricte côté API, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`), limite de 10 tentatives de connexion / 15 min / IP, cookie `Secure` en production, HTTPS via Traefik, chiffrement au repos RDS et S3, photos servies après contrôle d'accès, journalisation des requêtes > 2 s.

## 10. Déploiement
EC2 (Docker Compose : Traefik + api + web), RDS PostgreSQL (chiffré), S3 (privé, chiffré), SES, Bedrock (Nova Lite, Guardrail, Knowledge Base facultative), rôle IAM d'instance. Détails, coûts et suppression dans `DEPLOY.md`.

## 11. Décisions
| # | Sujet | Choix |
|---|---|---|
| D1 | Sous-catégories | aucune |
| D2 | Lieu | bâtiment (liste) + salle libre |
| D3 | Numéro | `SC-0001` séquentiel |
| D4 | Prendre en charge | affecte à soi + `EN_COURS` |
| D5 | Contestation | `EN_COURS`, même agent, `reopenCount + 1`, commentaire obligatoire |
| D6 | Délai de résolution | jusqu'à la dernière résolution |
| D7 | Affectation | sans changement de statut |
| D8 | `NOUVEAU → RESOLU` | interdit |
| D11 | Photos | servies par l'API |
| D12 | File non affectée | requête serveur dédiée |
| D13 | Délai cible | délai de **prise en charge** (sortie de `NOUVEAU`), 24 h par défaut |
| D14 | Titre | généré, régénéré si requalification |
| D16 | Fusion (US-17) | le doublon passe `REJETE` (« Doublon de SC-xxxx ») avec `mergedIntoId` |
| D17 | Brouillon (US-07) | sur l'appareil (localStorage), sans la photo |
| D18 | Notation (US-12) | possible en `RESOLU` ou `FERME`, une fois |
| D19 | Suppression (US-34) | anonymisation du compte et des contenus ; tickets conservés pour les statistiques |
| D20 | Assistant | texte des questions non stocké (seulement type de réponse, sources, feedback) |
| D21 | i18n | textes `t(fr, en)` co-localisés ; catégories et FAQ traduites en base ; noms de bâtiments non traduits |
