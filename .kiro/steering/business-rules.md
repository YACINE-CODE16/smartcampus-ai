---
inclusion: always
---

# Règles métier (PO + BA, workshop)

Toute demande qui contredit une règle ci-dessous doit être signalée au PO **avant** implémentation.
Les valeurs (statuts, transitions, urgences, priorités, délais) vivent dans `packages/shared/src/config/` ; les catégories, bâtiments et FAQ en base (seed).

## Rôles
| Rôle | Peut |
|---|---|
| `STUDENT` | signaler, voir **ses** tickets et leur historique, confirmer/contester une résolution, utiliser l'assistant |
| `AGENT` | voir les tickets qui lui sont affectés + les non affectés, prendre en charge, changer le statut, commenter, rejeter avec motif |
| `ADMIN` | tout voir, affecter, dashboard, mêmes actions que l'agent |

Pas d'inscription : comptes seedés (SSO école simulé). Contrôle d'accès vérifié **côté API** ; ticket non autorisé → 404.

## Statuts
`NOUVEAU` → `EN_COURS` → `RESOLU` → `FERME`, plus `REJETE` (motif obligatoire).
- Étudiant : **confirme** (`RESOLU → FERME`) ou **conteste** (`RESOLU → EN_COURS`, `reopenCount + 1`).
- Pas de saut `NOUVEAU → RESOLU`.
- « Prendre en charge » = s'affecter le ticket + `EN_COURS`.
- Chaque changement (statut, affectation) crée un événement horodaté : auteur, rôle, ancien et nouveau statut, commentaire.

## Signalement
- Obligatoires : type (catégorie), bâtiment, salle, description. Titre généré.
- Photo optionnelle : JPG/PNG, 10 Mo max.
- Urgence ressentie : faible / normale (défaut) / haute.
- Confirmation : numéro `SC-0001`, statut « Nouveau ».

## Priorité et alertes
- Priorité = urgence ressentie, sauf catégorie **Sécurité → `CRITIQUE`** automatiquement + alerte immédiate dans l'espace admin.
- Ticket encore `NOUVEAU` après **24 h** → « en retard » dans le dashboard + notification à l'étudiant.

## Assistant IA
- Affiche clairement qu'il s'agit d'une IA.
- Répond uniquement à partir de la FAQ et des tickets **de l'utilisateur connecté** ; cite la question de FAQ utilisée.
- Refuse les sujets hors périmètre.
- Propose un ticket pré-rempli quand il ne sait pas répondre ou qu'une intervention est nécessaire ; l'étudiant valide.
- N'invente jamais.

## RGPD
- Données minimales : nom, email école, rôle.
- Mention sur le formulaire : pas de personnes sur les photos, pas de données personnelles dans la description.
- Suppression sur demande : procédure manuelle documentée (US-35).
- HTTPS en production, chiffrement au repos RDS et S3.
