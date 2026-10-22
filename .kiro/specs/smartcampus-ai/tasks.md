# Plan d'implémentation — SmartCampus AI

Chaque phase se termine par : résumé au PO, procédure de test, commit git, attente du « OK ».
Phases 0 à 8 : **100 % local**, sans AWS. Phase 9 : migration AWS.
Les références `_Exigences : x.y_` renvoient à `requirements.md`.

## Phase 0 — Spec et setup
- [x] 0.1 `requirements.md`, `design.md`, `tasks.md`
- [x] 0.2 `.kiro/steering/` (product, business-rules, tech)
- [x] 0.3 Prérequis : Node ≥ 20.12, npm, git
- [x] 0.4 Monorepo npm workspaces : `apps/web` (React + Vite), `apps/api` (Express + TS), `packages/shared`
- [x] 0.5 Prisma 7 + SQLite (adapter better-sqlite3), `GET /api/health` avec contrôle de la base
- [x] 0.6 Ports : `AuthProvider`, `Repositories` + `UnitOfWork`, `FileStorage`, `Mailer`, `AiAssistant` + `KnowledgeProvider`, `Scheduler`, `RealtimePublisher` ; racine de composition `container.ts`
- [x] 0.7 Configuration métier et types partagés (`packages/shared`)
- [x] 0.8 Test : `npm run dev` lance le front et l'API, la page d'accueil s'affiche avec « API connectée »

## Phase 1 — Authentification et rôles
- [ ] 1.1 Modèles `User` / `UserRole` + migration ; `npm run setup` — _Exigences : 1.3_
- [ ] 1.2 Adapter `OutboxMailer` (console + `.eml`) — _Exigences : 1.1_
- [ ] 1.3 Adapter `LocalJwtAuthProvider` (scrypt, JWT, code de vérification, rôles) — _Exigences : 1.1, 1.2_
- [ ] 1.4 Routes `/api/auth/*`, middlewares `requireAuth` / `requireRole`, cookie httpOnly — _Exigences : 22.2_
- [ ] 1.5 Écrans connexion / inscription / vérification en français — _Exigences : 1.6_
- [ ] 1.6 `authClient`, `useCurrentUser`, `RoleGuard`, redirection par rôle, layouts des 3 espaces — _Exigences : 1.4, 1.5_
- [ ] 1.7 Script `npm run set-role -- <email> <ROLE>` (passe par `AuthProvider`) + doc — _Exigences : 2.1–2.3_
- [ ] 1.8 Page publique `/mentions` (v1) — _Exigences : 24.1_
- [ ] 1.9 Vitest à la racine + tests de l'adapter d'auth
- [ ] 1.10 Test PO : un compte de chaque rôle arrive sur le bon espace ; commit

## Phase 2 — Signaler un incident
- [ ] 2.1 `packages/shared/src/domain/incident.ts` (`allowedTransitions`, `canTransition`, `buildTitle`, `trackingNumber`) + tests
- [ ] 2.2 Modèles `Incident`, `IncidentEvent`, `Category` + migration + catégories par défaut — _Exigences : 14.3_
- [ ] 2.3 Repositories Prisma + `UnitOfWork`
- [ ] 2.4 Adapter `LocalDiskFileStorage` (URL signées HMAC) + routes fichiers — _Exigences : 4.2_
- [ ] 2.5 `IncidentWorkflow.report` + `POST /api/incidents` — _Exigences : 3.3, 3.5_
- [ ] 2.6 Formulaire mobile-first (3 champs obligatoires, urgence, photo, mention RGPD, validation) — _Exigences : 3.1–3.7, 4.1, 4.3, 4.4_
- [ ] 2.7 Écran de confirmation avec numéro de suivi
- [ ] 2.8 Test PO : signalement avec photo en < 2 min ; commit

## Phase 3 — Suivre sa demande
- [ ] 3.1 Politique d'accès (règles pures + tests) et `IncidentQueries` — _Exigences : 22.1_
- [ ] 3.2 « Mes signalements » — _Exigences : 5.1, 5.2_
- [ ] 3.3 Page détail + photo + timeline — _Exigences : 6.1, 6.2_
- [ ] 3.4 `reopen` + UI — _Exigences : 7.1–7.3_
- [ ] 3.5 Modèle `Rating`, `rate` (→ `FERME`) + UI étoiles — _Exigences : 8.1–8.3_
- [ ] 3.6 Test PO : voir son incident, son historique, le noter ; commit

## Phase 4 — Traitement technicien + admin
- [ ] 4.1 `take` (écriture conditionnelle), `changeStatus`, `updateUrgency`, `assign` + tests — _Exigences : 9.3, 9.4, 10.1–10.4, 11.3_
- [ ] 4.2 Routes `technician/queue`, `technician/incidents`, `admin/incidents` (filtres), `admin/technicians` — _Exigences : 9.1, 9.5, 11.1, 11.2, 11.4_
- [ ] 4.3 Adapter `SseRealtimePublisher` + `GET /api/events` + hook `useRealtime` — _Exigences : 5.3, 6.3, 12.1_
- [ ] 4.4 Espace technicien : onglets, tri, détail, actions — _Exigences : 9.1, 9.2, 10.1_
- [ ] 4.5 Espace admin : liste, filtres combinables, assignation — _Exigences : 11.1–11.4_
- [ ] 4.6 Gestion des catégories — _Exigences : 14.1, 14.2_
- [ ] 4.7 Adapter `InProcessScheduler` + job `auto-close` (J+7) + `npm run job -- auto-close` — _Exigences : 13.1, 13.2_
- [ ] 4.8 Test PO : l'admin assigne, le technicien résout, l'étudiant voit le changement sans recharger ; commit

## Phase 5 — Tableau de bord admin
- [ ] 5.1 `packages/shared/src/domain/kpi.ts` + tests — _Exigences : 15.2_
- [ ] 5.2 `DashboardService` + `GET /api/admin/dashboard` — _Exigences : 15.1, 15.4_
- [ ] 5.3 Page dashboard : cartes KPI + 4 graphiques Recharts — _Exigences : 15.1, 15.3_
- [ ] 5.4 `npm run seed` : 60 incidents / 30 jours, historiques, notes, comptes de démo (via les repositories) — _Exigences : 16.1, 16.2_
- [ ] 5.5 `npm run anonymize` (mécanisme RGPD) — _Exigences : 23.1, 23.2_
- [ ] 5.6 Test PO : dashboard cohérent après seed ; commit

## Phase 6 — Assistant IA (mock)
- [ ] 6.1 `packages/shared/src/faq/faq.json` (20 Q/R) + `FaqJsonProvider`
- [ ] 6.2 Modèle `AssistantConversation` (propriétaire seul) — _Exigences : 19.4_
- [ ] 6.3 Adapter `MockAiAssistant` + `AssistantService` + prompt système Bedrock versionné — _Exigences : 17.1–17.4, 18.1_
- [ ] 6.4 Page chat + « Ça m'a aidé » / « Créer un signalement » + pré-remplissage — _Exigences : 18.2, 18.3, 19.1, 19.2_
- [ ] 6.5 KPI IA dans le dashboard — _Exigences : 19.3_
- [ ] 6.6 Test PO : wifi, « où en est mon signalement ? », question hors FAQ → signalement pré-rempli ; commit

## Phase 7 — Notifications
- [ ] 7.1 Modèle `Notification` + `NotificationService` (in-app + email via `Mailer`) — _Exigences : 20.2, 21.1, 21.2_
- [ ] 7.2 Cloche + compteur temps réel (SSE) + marquer lu — _Exigences : 20.1, 20.3_
- [ ] 7.3 Gabarits d'emails en français
- [ ] 7.4 Test PO : chaque changement de statut déclenche la bonne notification (in-app + `.eml`) ; commit

## Phase 8 — Démo locale
- [ ] 8.1 `npm run demo` : réinitialise la base, seed, lance l'app
- [ ] 8.2 `DEMO.md` : scénario 5 min (3 personas, 4 parcours), comptes de test
- [ ] 8.3 Push GitHub (dépôt à confirmer avec le PO)
- [ ] 8.4 Commit final

## Phase 9 — Migration AWS
- [ ] 9.1 Arbitrage PO : Amplify Data + Lambdas, ou API dans Lambda derrière API Gateway ; région (eu-west-3 par défaut)
- [ ] 9.2 Identifiants AWS du PO (profil `smartcampus`) — _action manuelle PO_
- [ ] 9.3 `adapters/aws/` : Cognito, DynamoDB, S3, SES, Bedrock, EventBridge, AppSync ; `ADAPTERS_MODE=aws`
- [ ] 9.4 `authClient` et `useRealtime` côté web pour AWS
- [ ] 9.5 Tests des services contre les adapters AWS
- [ ] 9.6 Amplify Hosting connecté à GitHub (`main`) — _Exigences : 26.1_
- [ ] 9.7 Vérification en production, `DEMO.md` mis à jour (URL), coûts attendus et procédure de suppression

## Après la phase 8 (sur demande du PO uniquement)
- [ ] C1 Suggestion IA d'urgence et de catégorie (`TriageSuggester`)
- [ ] C2 Statistiques avancées
