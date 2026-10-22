# Plan d'implémentation — SmartCampus AI (US-01 à US-38)

Un commit par bloc. Les tests existants doivent passer ; chaque nouvelle règle métier a ses tests.

## Fait
- [x] Setup monorepo, specs, steering
- [x] US-01 connexion (SSO simulé) · US-03/04/05 signalement · US-08/09 suivi
- [x] Seed : 5 comptes, catégories, 5 bâtiments, 20 FAQ, 60 tickets sur 30 jours

## Bloc a — Traitement agent/admin (US-13 à US-18) + moteur de notifications (US-10)
- [x] a1 Schéma : InternalNote, Notification, AuditLog, Rating, KbDocument, AssistantInteraction ; Category.targetHours/labelEn ; Incident.mergedIntoId ; User.locale
- [x] a2 Règles pures : `isLate` avec délai cible, `canMerge` + tests
- [x] a3 Ports `Mailer` (console/SES) ; `NotificationService` ; hub SSE ; `AuditService`
- [x] a4 Workflow : take (conditionnel), transition, assign, update (catégorie/urgence), merge, notes internes + tests d'intégration
- [x] a5 Contrôle périodique des délais cibles + `GET /admin/alerts` ; `GET/PATCH /admin/categories`
- [x] a6 i18n (infrastructure `t(fr, en)`) pour tout nouvel écran
- [x] a7 Front agent : files « Mes tickets » / « Non affectés », détail + actions + notes internes
- [x] a8 Front admin : liste filtrable, affectation, alertes temps réel, délais cibles

## Bloc b — Dashboard (US-27 à US-33)
- [x] b1 `kpi.ts` (délai moyen, taux, satisfaction, buckets jour/semaine/mois/année) + tests
- [x] b2 `GET /admin/dashboard` (volumes, KPI, bâtiments, évolution, charge agents, stats assistant)
- [x] b3 Filtres avancés + export CSV audité (US-27)
- [x] b4 Page dashboard (Recharts)

## Bloc c — Assistant (US-19 à US-26)
- [x] c1 Ports `KnowledgeBase` (local / Bedrock KB) et `AiAssistant` (mock / Bedrock + Guardrails)
- [x] c2 `POST /assistant/ask`, feedback, triage ; FAQ bilingue
- [x] c3 Admin : gestion FAQ + documents (US-24)
- [x] c4 Page chat (mention IA, sources, ticket pré-rempli, 👍/👎) ; suggestion IA dans le formulaire (US-25)

## Bloc d — Compléments étudiant et rôles (US-02, 06, 07, 10, 11, 12)
- [x] d1 Page Utilisateurs + changement de rôle audité (US-02)
- [x] d2 Avertissement doublon (US-06) ; brouillon (US-07)
- [x] d3 Cloche de notifications (US-10)
- [x] d4 Confirmer / contester (US-11) ; notation (US-12)

## Bloc e — Transverses (US-34 à US-38)
- [ ] e1 Suppression des données d'un étudiant (US-34)
- [ ] e2 Accessibilité / responsive (US-35)
- [ ] e3 En-têtes de sécurité, limite de connexion (US-36)
- [ ] e4 Journal d'audit (US-37)
- [ ] e5 FR/EN complet + assistant dans la langue de la question (US-38)

## Bloc f — Déploiement
- [ ] f1 Dockerfiles api et web, `docker-compose.prod.yml` (Traefik)
- [ ] f2 `DEPLOY.md` : schéma d'architecture, console AWS pas à pas, IAM, groupes de sécurité, variables, coûts, suppression
- [ ] f3 Test local de la stack de production
