# Plan d'implémentation — SmartCampus AI

Chaque phase se termine par : résumé au PO, procédure de test, commit git, attente du « OK ».
Les références `_Exigences : x.y_` renvoient à `requirements.md`.

## Phase 0 — Spec et setup
- [x] 0.1 Générer `requirements.md`, `design.md`, `tasks.md`
- [x] 0.2 Créer `.kiro/steering/` (product, business-rules, tech)
- [x] 0.3 Vérifier les prérequis (Node ≥ 20, AWS CLI, identifiants)
- [x] 0.4 Initialiser React + Vite + TypeScript et Amplify Gen 2, dépôt git, README
- [ ] 0.5 Test PO : `npm run sandbox` démarre sans erreur, l'app locale s'affiche (`npm run dev`)

## Phase 1 — Authentification et rôles
- [ ] 1.1 `defineAuth` : login email, attribut nom, groupes `STUDENT`, `TECHNICIAN`, `ADMIN` — _Exigences : 1.1, 1.3_
- [ ] 1.2 Lambda post-confirmation `add-to-student` — _Exigences : 1.2_
- [ ] 1.3 Authenticator Amplify UI traduit en français — _Exigences : 1.6_
- [ ] 1.4 `useCurrentUser` (groupes depuis le jeton), `RoleGuard`, redirection par rôle, layout par espace — _Exigences : 1.4, 1.5_
- [ ] 1.5 Script `npm run set-role -- <email> <ROLE>` + doc README — _Exigences : 2.1–2.3_
- [ ] 1.6 Page publique `/mentions` (première version) — _Exigences : 24.1_
- [ ] 1.7 Test PO : un compte de chaque rôle arrive sur le bon espace ; commit

## Phase 2 — Signaler un incident
- [ ] 2.1 `shared/config` (statuts, transitions, urgences, bâtiments, catégories par défaut, réglages) + `shared/domain/incident.ts` + tests Vitest
- [ ] 2.2 Modèles `Incident`, `IncidentEvent`, `Category` avec autorisations — _Exigences : 22.1_
- [ ] 2.3 Storage S3 `incident-photos/{entity_id}/*` — _Exigences : 4.2_
- [ ] 2.4 Lambda `incident-workflow` : `reportIncident` (titre auto, numéro de suivi, événement initial) — _Exigences : 3.3, 3.5_
- [ ] 2.5 Initialisation des catégories par défaut — _Exigences : 14.3_
- [ ] 2.6 Formulaire mobile-first (3 champs obligatoires, urgence, photo, mention RGPD, validation) — _Exigences : 3.1–3.7, 4.1, 4.3, 4.4_
- [ ] 2.7 Écran de confirmation avec numéro de suivi
- [ ] 2.8 Test PO : signalement avec photo en < 2 min ; commit

## Phase 3 — Suivre sa demande
- [ ] 3.1 « Mes signalements » temps réel — _Exigences : 5.1–5.3_
- [ ] 3.2 Page détail + photo + timeline temps réel — _Exigences : 6.1–6.3_
- [ ] 3.3 Mutation `reopenIncident` + UI — _Exigences : 7.1–7.3_
- [ ] 3.4 Modèle `Rating`, mutation `rateIncident` (→ `FERME`) + UI étoiles — _Exigences : 8.1–8.3_
- [ ] 3.5 Test PO : voir son incident, son historique, le noter ; commit

## Phase 4 — Traitement technicien + admin
- [ ] 4.1 Mutations `takeIncident` (écriture conditionnelle), `changeIncidentStatus`, `updateIncidentUrgency`, `assignIncident` — _Exigences : 9.3, 9.4, 10.1–10.4, 11.3_
- [ ] 4.2 Lambda `campus-queries` : `listUnassignedIncidents`, `listTechnicians`, `getIncidentPhotoUrl` — _Exigences : 9.1, 9.5, 11.4, 4.2_
- [ ] 4.3 Espace technicien : onglets, tri, détail, actions — _Exigences : 9.1–9.2, 10.1_
- [ ] 4.4 Espace admin : liste, filtres combinables, assignation — _Exigences : 11.1–11.4_
- [ ] 4.5 Temps réel inter-personas (subscriptions + `onQueueChanged`) — _Exigences : 12.1_
- [ ] 4.6 Gestion des catégories (admin) — _Exigences : 14.1, 14.2_
- [ ] 4.7 Lambda planifiée `auto-close` (J+7) — _Exigences : 13.1, 13.2_
- [ ] 4.8 Test PO : l'admin assigne, le technicien résout, l'étudiant voit le changement sans recharger ; commit

## Phase 5 — Tableau de bord admin
- [ ] 5.1 `shared/domain/kpi.ts` + tests — _Exigences : 15.2_
- [ ] 5.2 `getDashboardStats` (KPIs + séries) — _Exigences : 15.1, 15.4_
- [ ] 5.3 Page dashboard : cartes KPI + 4 graphiques Recharts — _Exigences : 15.1, 15.3_
- [ ] 5.4 Script `npm run seed` : 60 incidents / 30 jours, historiques, notes — _Exigences : 16.1, 16.2_
- [ ] 5.5 Script `anonymize-closed` (mécanisme RGPD) — _Exigences : 23.1, 23.2_
- [ ] 5.6 Test PO : dashboard cohérent après seed ; commit

## Phase 6 — Assistant IA
- [ ] 6.1 `shared/faq/faq.json` (20 Q/R) + `KnowledgeProvider` / `FaqJsonProvider`
- [ ] 6.2 Modèle `AssistantConversation` (owner seul) — _Exigences : 19.4_
- [ ] 6.3 Lambda `assistant` (Bedrock Converse, `BEDROCK_MODEL_ID`, sortie JSON, incidents de l'utilisateur seul) — _Exigences : 17.1–17.5, 18.1_
- [ ] 6.4 Page chat + boutons « Ça m'a aidé » / « Créer un signalement » + pré-remplissage — _Exigences : 18.2, 18.3, 19.1, 19.2_
- [ ] 6.5 KPI IA dans le dashboard — _Exigences : 19.3_
- [ ] 6.6 Test PO : wifi, « où en est mon signalement ? », question hors FAQ → signalement pré-rempli ; commit

## Phase 7 — Notifications
- [ ] 7.1 Modèle `Notification` + module `notify()` — _Exigences : 20.2_
- [ ] 7.2 Cloche + compteur temps réel + marquer lu — _Exigences : 20.1, 20.3_
- [ ] 7.3 Emails SES (identité expéditrice vérifiée, gestion d'échec) — _Exigences : 21.1, 21.2_
- [ ] 7.4 Test PO : chaque changement de statut déclenche la bonne notification ; commit

## Phase 8 — Déploiement et démo
- [ ] 8.1 Push GitHub, connexion Amplify Hosting (pas à pas ou CLI) — _Exigences : 26.1_
- [ ] 8.2 Vérification en production, comptes de test
- [ ] 8.3 `DEMO.md` (scénario 5 min, 3 personas, 4 parcours, comptes, URL)
- [ ] 8.4 Coûts AWS attendus + procédure de suppression
- [ ] 8.5 Commit final

## Après la phase 8 (sur demande du PO uniquement)
- [ ] C1 Suggestion IA d'urgence et de catégorie (`TriageSuggester`)
- [ ] C2 Statistiques avancées
