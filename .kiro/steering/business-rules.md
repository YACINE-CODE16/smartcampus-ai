---
inclusion: always
---

# Règles métier (décisions du PO)

Toute demande qui contredit une règle ci-dessous doit être signalée au PO **avant** implémentation.
Les valeurs (catégories, statuts, transitions, urgences, bâtiments, délais) vivent dans `packages/shared/src/config/` et non en dur dans les composants ou les routes.

## Rôles (deviendront des groupes Cognito en phase 9)
| Groupe | Peut |
|---|---|
| `STUDENT` (défaut à l'inscription) | signaler, suivre **ses** incidents, rouvrir, noter, utiliser l'assistant |
| `TECHNICIAN` | voir ses incidents assignés + la file non assignée, prendre en charge, changer le statut, commenter |
| `ADMIN` | tout voir, assigner, piloter (dashboard), gérer les catégories et les rôles — **sauf le contenu des conversations IA** |

Si un utilisateur a plusieurs groupes, l'espace affiché suit la priorité `ADMIN > TECHNICIAN > STUDENT`.

## Catégories (configurables par l'admin)
Salle (fermée, réservée, inaccessible) · Matériel (vidéoprojecteur, PC, mobilier) · Réseau (wifi, câblé, accès comptes) · Propreté / sanitaires · Sécurité · Autre.

## Urgence
`FAIBLE` / `NORMALE` (défaut) / `HAUTE`. Choisie par l'étudiant, modifiable par technicien et admin.

## Cycle de vie d'un incident
```
OUVERT ──(prise en charge)──▶ EN_COURS ──(traité)──▶ RESOLU ──(note étudiant ou J+7)──▶ FERME
   ▲                                                    │
   └────────────────(réouverture par l'étudiant)────────┘
```
| Transition | Qui | Effets |
|---|---|---|
| OUVERT → EN_COURS | technicien (assigné ou qui prend en charge), admin | `assignedTo` renseigné si vide |
| EN_COURS → RESOLU | technicien assigné, admin | `resolvedAt = now`, demande de note à l'étudiant |
| RESOLU → OUVERT | étudiant propriétaire | réouverture, `resolvedAt` effacé, technicien conservé |
| RESOLU → FERME | étudiant (en notant), système (J+7), admin | `closedAt = now` |

- **Chaque** changement de statut (et chaque assignation) crée un `IncidentEvent` horodaté : `fromStatus`, `toStatus`, `comment`, `authorId`, `authorRole`.
- Les transitions sont validées **côté serveur** (service `IncidentWorkflow` de l'API), jamais uniquement dans l'UI.
- Une seule note par incident, uniquement quand il est `RESOLU`, uniquement par son propriétaire.

## Assistant IA
- Répond uniquement à partir de la FAQ (`packages/shared/src/faq/faq.json`) et des incidents **de l'utilisateur connecté**.
- En local : assistant mock déterministe ; Bedrock en phase 9. Même contrat de réponse.
- N'invente jamais ; s'il ne sait pas, il le dit clairement et propose un signalement **pré-rempli** (catégorie + description déduites) que l'étudiant valide.
- Rappelle que ses réponses peuvent être incomplètes.
- Après chaque réponse : « Ça m'a aidé » / « Créer un signalement ».
- Conversation « résolue par l'IA » = `helpful = true` et `ticketCreated = false`.

## Accès aux données
- Étudiant : uniquement ses incidents, ses photos, ses conversations, ses notifications.
- Technicien : incidents assignés + file non assignée (route serveur dédiée) ; **pas** de dashboard global, **pas** de conversations IA.
- Admin : tout sauf le contenu des conversations IA (statistiques agrégées uniquement).
- L'identité de l'utilisateur est toujours prise du jeton vérifié côté serveur (JWT local, Cognito en phase 9), jamais d'un paramètre client.
- Les événements temps réel ne transportent que des identifiants ; le contenu est relu via l'API, qui applique ces droits.

## RGPD
- Données minimales : nom, email école, rôle. Aucune donnée sensible demandée.
- Mention visible sur le formulaire : ne pas photographier de personnes, ne pas saisir d'informations personnelles.
- Incidents fermés anonymisés après 12 mois (mécanisme prévu, déclenchement manuel au MVP).
- Page « Mentions et données personnelles ».
