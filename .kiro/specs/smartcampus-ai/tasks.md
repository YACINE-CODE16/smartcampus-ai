# Plan d'implémentation — SmartCampus AI (workshop)

Commit à la fin de chaque étape. Les IDs renvoient à `requirements.md`.

## Étape 0 — Setup (fait)
- [x] Monorepo `apps/web`, `apps/api`, `packages/shared` ; specs Kiro et steering

## Ce soir (jeudi 22/10) — en local

### Étape 1 — PostgreSQL + auth (US-01)  ⏸ point de test PO après l'étape 3
- [x] 1.1 `docker-compose.yml` (PostgreSQL 16) ; Prisma → `@prisma/adapter-pg` ; suppression de SQLite
- [x] 1.2 Schéma complet (User, Category, Building, Incident, IncidentEvent, FaqEntry) + migration initiale
- [x] 1.3 Configuration partagée : rôles `STUDENT/AGENT/ADMIN`, statuts + transitions, urgences/priorités ; règles pures + tests Vitest
- [x] 1.4 Seed de base : 5 comptes, catégories, 5 bâtiments, FAQ (20)
- [x] 1.5 `LocalAuthProvider` (scrypt + JWT cookie), routes `/api/auth/*`, `requireAuth` / `requireRole`
- [x] 1.6 Front : React Router, page « Connexion école » (+ comptes de démo), garde de rôle, layouts des 3 espaces

### Étape 2 — Signalement (US-03/04/05)
- [x] 2.1 Port `FileStorage` + `LocalFileStorage` + `S3FileStorage`
- [x] 2.2 `POST /api/incidents` (multipart, validation zod, JPG/PNG ≤ 10 Mo, priorité, événement initial) + `GET /api/referentials`
- [x] 2.3 Formulaire mobile-first (type, bâtiment, salle, description, urgence, photo + aperçu, mention RGPD) + confirmation `SC-xxxx`

### Étape 3 — Suivi (US-08/09)
- [x] 3.1 `GET /api/incidents` filtré par R1, `GET /api/incidents/:id` (+ historique), `GET /api/incidents/:id/photo`
- [x] 3.2 « Mes signalements » + page détail avec timeline
- [x] 3.3 Tests d'accès (401/403/404 par rôle)
- [ ] **⏸ Arrêt : test PO** ← on en est là

### Étape 4 — Traitement agent/admin (US-13/14) + règles Sécurité et 24 h
- [ ] 4.1 `assign`, `take` (conditionnel), `transition` (table partagée) + tests
- [ ] 4.2 Espace agent : « Mes tickets » / « Non affectés », détail + actions
- [ ] 4.3 Espace admin : liste filtrable (statut, catégorie, bâtiment, agent) + affectation
- [ ] 4.4 SSE `/api/events` ; alerte critique admin (R3) ; calcul « en retard » (R4)

### Étape 5 — Dashboard (US-28/29/30)
- [ ] 5.1 KPI purs (délai moyen, taux de résolution, taux de réouverture) + tests
- [ ] 5.2 `GET /api/admin/dashboard` + page (compteurs par statut, catégories, tendance, bâtiments, retards, critiques)
- [ ] 5.3 Seed des 60 tickets sur 30 jours (2 Sécurité, 3 en retard)

### Étape 6 — Assistant (US-19/21/26)
- [ ] 6.1 Port `AiAssistant` : `MockAiAssistant` + `BedrockAiAssistant` (Converse, us-east-1) + prompt système
- [ ] 6.2 `POST /api/assistant/ask` (contexte = FAQ + tickets de l'utilisateur)
- [ ] 6.3 Page chat : mention IA, sources, ticket pré-rempli → formulaire

### Étape 7 — Livrables de déploiement
- [ ] 7.1 `apps/api/Dockerfile`, `apps/web/Dockerfile` (nginx), `docker-compose.prod.yml` (Traefik + api + web)
- [ ] 7.2 `DEPLOY.md` : console AWS pas à pas (EC2, RDS, S3, IAM, groupes de sécurité), variables, Bedrock, coûts, suppression
- [ ] 7.3 Test local de la stack de production (`docker compose -f docker-compose.prod.yml`) avec PostgreSQL local

## Demain (vendredi 23/10, 10h40–14h30)
- [ ] 8.1 Déploiement AWS selon `DEPLOY.md` (identifiants du lab)
- [ ] 8.2 Vérification en production + seed
- [ ] 8.3 Should, par ordre de valeur pour la démo : US-11, US-17, US-10, US-22, US-06, US-16, US-23, US-25, US-33
- [ ] 8.4 `DEMO.md` : scénario de 5 min (3 personas), comptes, URL

## Could (documentées, non développées)
US-02, US-07, US-12, US-15, fusion de doublons, US-18, US-24, US-31, US-32, US-34, US-37, US-38
