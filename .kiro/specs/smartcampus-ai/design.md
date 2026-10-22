# Conception — SmartCampus AI

## 1. Vue d'ensemble

```
                ┌──────────────────────── Amplify Hosting (CloudFront) ────────────────────────┐
 Navigateur ──▶ │  React + Vite (SPA)  · Amplify UI Authenticator · React Router · Recharts    │
                └──────┬───────────────────────────┬──────────────────────────┬────────────────┘
                       │ JWT Cognito               │ GraphQL + subscriptions  │ S3 (URL signées)
                       ▼                           ▼                          ▼
                 ┌──────────┐          ┌───────────────────────┐        ┌───────────┐
                 │ Cognito  │          │ AppSync (Amplify Data)│        │ S3 photos │
                 │ STUDENT  │          │  modèles DynamoDB     │        └───────────┘
                 │ TECHNIC. │          │  requêtes/mutations   │
                 │ ADMIN    │          │  custom → Lambdas     │
                 └────┬─────┘          └──────────┬────────────┘
      post-confirmation│                          │
                       ▼                          ▼
              ┌────────────────┐   ┌──────────────────────────────────────────────────┐
              │ add-to-student │   │ incident-workflow · campus-queries · assistant   │
              └────────────────┘   │ auto-close (planifiée, quotidienne)              │
                                   └───────┬──────────────────┬──────────────┬────────┘
                                           ▼                  ▼              ▼
                                       Amazon SES      Amazon Bedrock     DynamoDB
                                       (emails)        (Converse API)     (via AppSync IAM)
```

**Principe clé :** les clients **lisent** directement les modèles (avec les règles d'autorisation Amplify) mais **toutes les écritures métier** sur `Incident`, `IncidentEvent`, `Rating` et `Notification` passent par des mutations custom traitées par la Lambda `incident-workflow`. Elle valide les transitions avec `shared/domain`, écrit via l'API AppSync (signature IAM) — ce qui déclenche les subscriptions temps réel — puis émet les notifications.

## 2. Configuration et règles partagées (`shared/`)

Aucune règle métier en dur dans l'UI ni dans les Lambdas : tout passe par `shared/`, importé des deux côtés.

```ts
// shared/config/statuses.ts
export const INCIDENT_STATUSES = ['OUVERT', 'EN_COURS', 'RESOLU', 'FERME'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export const STATUS_LABELS: Record<IncidentStatus, string> = { OUVERT: 'Ouvert', EN_COURS: 'En cours', RESOLU: 'Résolu', FERME: 'Fermé' };

// shared/config/transitions.ts — table unique des transitions autorisées
export const TRANSITIONS: Transition[] = [
  { from: 'OUVERT',   to: 'EN_COURS', roles: ['TECHNICIAN', 'ADMIN'] },
  { from: 'EN_COURS', to: 'RESOLU',   roles: ['TECHNICIAN', 'ADMIN'] },
  { from: 'RESOLU',   to: 'OUVERT',   roles: ['STUDENT'] },            // réouverture
  { from: 'RESOLU',   to: 'FERME',    roles: ['STUDENT', 'ADMIN', 'SYSTEM'] },
];

// shared/config/settings.ts
export const AUTO_CLOSE_DAYS = 7;
export const ANONYMIZE_AFTER_MONTHS = 12;
export const MAX_PHOTO_MB = 10;
```

- `shared/config/categories.ts` : catégories **par défaut** (seed initial du modèle `Category`, ensuite gérées en base par l'admin).
- `shared/config/urgencies.ts`, `shared/config/buildings.ts` : listes + libellés.
- `shared/domain/incident.ts` : fonctions pures `canTransition(from, to, role, ctx)`, `allowedTransitions(...)`, `buildTitle(...)`, `trackingNumber(id)`.
- `shared/domain/kpi.ts` : calculs purs des KPIs (testés unitairement, réutilisés par la Lambda dashboard et le seed).
- `shared/faq/faq.json` : 20 Q/R.

## 3. Modèle de données (Amplify Data)

Les identifiants utilisateurs stockés sont le `sub` Cognito (règles d'owner configurées avec `identityClaim('sub')`).

| Modèle | Champs | Lecture | Écriture |
|---|---|---|---|
| **Incident** | id, trackingNumber, title, categoryId, categoryLabel*, building, room, description, photoKey?, urgency, status, owner, ownerName*, assignedTo?, assignedToName*, technicianComment?, createdAt, updatedAt, resolvedAt?, closedAt?, anonymizedAt? | `owner` ; `assignedTo` ; groupe `ADMIN` | Lambda uniquement |
| **IncidentEvent** | incidentId, fromStatus?, toStatus, type (`STATUS`/`ASSIGN`/`URGENCY`/`COMMENT`), comment?, authorId, authorName*, authorRole, readers[]*, createdAt | `readers` (propriétaire + technicien assigné) ; `ADMIN` | Lambda uniquement |
| **Rating** | incidentId, score 1–5, comment?, owner, createdAt | `owner` ; `ADMIN` | Lambda (`rateIncident`) |
| **AssistantConversation** | id, owner, messages (JSON), helpful?, ticketCreated, incidentId?, createdAt | `owner` uniquement | `owner` + Lambda assistant |
| **Notification** | userId, type, incidentId, title, read, createdAt | `userId` | Lambda (création) ; `userId` (marquer lu) |
| **Category** | id, label, description?, active, order | tout utilisateur connecté | `ADMIN` |

`*` champs dénormalisés (non listés dans le brief) : ils évitent des jointures côté client et permettent d'afficher un nom sans exposer l'annuaire Cognito. `readers` permet de restreindre l'historique aux mêmes personnes que l'incident ; il est mis à jour par la Lambda lors d'une (ré)assignation.

**Numéro de suivi :** `SC-` + 8 premiers caractères de l'id en majuscules (ex. `SC-3F9A1B2C`). Pas de compteur séquentiel (évite une table de compteur atomique).

## 4. Autorisations

| Ressource | STUDENT | TECHNICIAN | ADMIN |
|---|---|---|---|
| Incident (lecture) | les siens | assignés à lui (+ file via requête custom) | tous |
| IncidentEvent | ceux de ses incidents | ceux de ses incidents assignés | tous |
| Photos S3 | lecture/écriture sous `incident-photos/{sub}/` | URL signée via `getIncidentPhotoUrl` si assigné | URL signée via `getIncidentPhotoUrl` |
| AssistantConversation | les siennes | ✗ | ✗ (stats agrégées via `getDashboardStats`) |
| Category | lecture | lecture | CRUD |
| Dashboard | ✗ | ✗ | ✓ |

**File non assignée des techniciens :** elle est exposée par la requête custom `listUnassignedIncidents` (groupes `TECHNICIAN`, `ADMIN`) plutôt que par une lecture de groupe sur `Incident`, pour qu'un technicien ne puisse pas lire via l'API les incidents assignés à un collègue. Le rafraîchissement temps réel de la file se fait via une subscription custom légère (`onQueueChanged`, ne contenant que l'id) qui déclenche un rechargement. *Point à confirmer en phase 4 ; repli possible : rechargement toutes les 15 s.*

## 5. Opérations custom (AppSync → Lambda)

| Opération | Type | Groupes | Lambda | Effet |
|---|---|---|---|---|
| `reportIncident` | mutation | STUDENT | incident-workflow | crée l'incident `OUVERT` + événement initial ; titre auto |
| `takeIncident` | mutation | TECHNICIAN | incident-workflow | assigne à soi + `EN_COURS` (écriture conditionnelle anti-doublon) |
| `assignIncident` | mutation | ADMIN | incident-workflow | assigne à un technicien, notifie |
| `changeIncidentStatus` | mutation | TECHNICIAN, ADMIN | incident-workflow | transition validée + commentaire |
| `updateIncidentUrgency` | mutation | TECHNICIAN, ADMIN | incident-workflow | change l'urgence, événement |
| `reopenIncident` | mutation | STUDENT (propriétaire) | incident-workflow | `RESOLU → OUVERT` |
| `rateIncident` | mutation | STUDENT (propriétaire) | incident-workflow | `Rating` + `RESOLU → FERME` |
| `listUnassignedIncidents` | requête | TECHNICIAN, ADMIN | campus-queries | file « À prendre » |
| `listTechnicians` | requête | ADMIN | campus-queries | `ListUsersInGroup TECHNICIAN` |
| `getIncidentPhotoUrl` | requête | tous | campus-queries | URL signée 5 min si l'appelant a accès |
| `getDashboardStats` | requête | ADMIN | campus-queries | KPIs + séries des graphiques |
| `askAssistant` | mutation | STUDENT | assistant | réponse Bedrock structurée |

Chaque handler lit l'identité (`sub`, groupes) depuis `event.identity`, jamais depuis les arguments.

## 6. Lambdas

- **add-to-student** (trigger post-confirmation Cognito) : `AdminAddUserToGroup(STUDENT)`.
- **incident-workflow** : opérations ci-dessus ; écrit via le client Amplify Data (IAM) ; appelle `notify()`.
- **campus-queries** : lectures transverses. Le dashboard agrège en mémoire (volume MVP faible : scan acceptable, à revoir au-delà de ~10 000 incidents).
- **auto-close** : planifiée `every day` ; ferme les `RESOLU` depuis > `AUTO_CLOSE_DAYS`, auteur `SYSTEM`.
- **assistant** : voir §8.
- **notify()** (module partagé `amplify/functions/_shared/notify.ts`) : crée la `Notification` puis tente l'email SES ; un échec SES est journalisé et n'interrompt pas l'action.

## 7. Front-end

```
/connexion                    Authenticator Amplify UI (FR)
/                             redirection selon le rôle
/etudiant                     Mes signalements
/etudiant/signaler            Formulaire (pré-remplissable via state de navigation)
/etudiant/incidents/:id       Détail, timeline, réouverture, note
/etudiant/assistant           Chat
/technicien                   Onglets « À prendre » / « Mes incidents »
/technicien/incidents/:id     Détail + actions de statut
/admin                        Tableau de bord
/admin/incidents(/:id)        Liste filtrable, assignation
/admin/categories             Gestion des catégories
/mentions                     Mentions et données personnelles (publique)
```

- `RoleGuard` lit les groupes depuis `fetchAuthSession()` (`cognito:groups`).
- Hooks de données (`useMyIncidents`, `useIncident`, …) basés sur `observeQuery` / `onUpdate` pour le temps réel.
- Styles : CSS natif avec variables (thème Amplify UI aligné), mobile-first.

## 8. Assistant IA

```
askAssistant(conversationId?, message)
  → charge la conversation (vérifie owner = sub)
  → contexte = KnowledgeProvider.retrieve(message)      // FAQ JSON au MVP
             + incidents de l'utilisateur (requête filtrée par owner = sub, 20 derniers)
  → Bedrock Converse (modelId = env BEDROCK_MODEL_ID, temperature basse)
  → sortie JSON imposée : { answer, answeredFromSources: boolean, suggestedIncident?: { categoryId, description, building?, room? } }
  → persiste les messages, renvoie la réponse
```

- `KnowledgeProvider` est une interface (`retrieve(query): Promise<Passage[]>`) ; implémentation MVP `FaqJsonProvider`, future `BedrockKnowledgeBaseProvider` sans changer le handler.
- Le prompt système impose : français, uniquement les sources fournies, jamais d'invention, mention « réponses possiblement incomplètes », pré-remplissage si `answeredFromSources = false`.
- Les incidents des autres utilisateurs ne sont jamais chargés : la requête est construite côté serveur avec le `sub` du jeton.
- Modèle par défaut proposé : profil d'inférence EU d'un modèle Claude Haiku ou Amazon Nova Lite disponible en `eu-west-3` (vérifié en phase 6).

## 9. Préparation des « Could »

- `shared/domain/triage.ts` : interface `TriageSuggester { suggest(description, photoKey?) → { categoryId?, urgency?, confidence } }`, sans implémentation.
- Le formulaire de signalement accepte déjà des valeurs initiales (pré-remplissage), réutilisable pour une suggestion automatique.
- `getDashboardStats` renvoie un objet extensible (sections nommées) pour ajouter des statistiques avancées.

## 10. RGPD — anonymisation

Script `scripts/anonymize-closed.ts` (et logique partagée réutilisable par une future Lambda planifiée) : pour chaque incident `FERME` avec `closedAt` > 12 mois → `description = '[anonymisé]'`, suppression S3 de la photo, `technicianComment` et commentaires d'événements effacés, `owner`/`ownerName` remplacés, `anonymizedAt` renseigné. Catégorie, bâtiment, dates, urgence et note conservés.

## 11. Environnements et coûts

- **Sandbox** par développeur (`npm run sandbox`) dans `eu-west-3`, profil AWS `smartcampus`.
- **Production** : branche `main` sur Amplify Hosting.
- Coûts attendus en démo : quasi nuls (offre gratuite Cognito / AppSync / DynamoDB / Lambda / S3) ; Bedrock à l'usage (quelques centimes pour la démo) ; détaillé en phase 8.

## 12. Décisions prises par défaut (à valider par le PO)

| # | Sujet non couvert par le brief | Choix (le plus simple) |
|---|---|---|
| D1 | Sous-catégories (« Salle : fermée, réservée… ») | une catégorie = libellé + description d'exemples, pas de sous-catégorie |
| D2 | Saisie du lieu | bâtiment choisi dans une liste configurable + salle en texte libre |
| D3 | Numéro de suivi | `SC-` + 8 caractères de l'id, pas de compteur séquentiel |
| D4 | « Prendre en charge » | assigne le technicien **et** passe à `EN_COURS` en une action |
| D5 | Réouverture | retour à `OUVERT` en gardant le même technicien assigné |
| D6 | Délai de résolution après réouverture | calculé jusqu'à la **dernière** résolution |
| D7 | Assignation par l'admin | ne change pas le statut ; crée un événement de type `ASSIGN` |
| D8 | Saut de statut (`OUVERT → RESOLU`) | interdit, on passe toujours par `EN_COURS` |
| D9 | Champs dénormalisés (noms, `readers`) | ajoutés au modèle pour l'affichage et les autorisations |
| D10 | « Étudiant actif » | ≥ 1 signalement ou conversation IA sur les 30 derniers jours |
| D11 | Visibilité des photos | propriétaire en direct ; technicien assigné et admin via URL signée temporaire |
