# Exigences — SmartCampus AI (38 user stories officielles)

> Source : `user-stories-smartcampus.md` (fichier officiel du workshop Capgemini × ESIEA). Intitulés, ordre et priorités repris à l'identique.
> Chaque story a un scénario Gherkin et des critères d'acceptation testables ; la colonne « Preuve » renvoie aux tests automatisés.

## Règles métier transverses (validées par le PO)
- **Statuts** : `NOUVEAU` → `EN_COURS` → `RESOLU` → `FERME`, plus `REJETE` (motif obligatoire). Pas de saut `NOUVEAU → RESOLU`.
- **R1 Accès** : l'étudiant voit ses tickets ; l'agent ceux qui lui sont affectés et les non affectés ; l'admin tout. Contrôle côté API ; ticket non autorisé → 404.
- **R2 Historique** : chaque changement (statut, affectation, requalification, fusion) crée un événement horodaté (auteur, rôle, ancien/nouveau statut, commentaire).
- **R3 Sécurité** : catégorie Sécurité → priorité `CRITIQUE` + alerte immédiate à l'admin ; délai cible 4 h.
- **R4 Délai cible** : par catégorie, 24 h par défaut ; dépassement → alerte admin + notification étudiant (une fois).
- **R5 Fusion** : le doublon passe `REJETE` avec le motif « Doublon de SC-xxxx ».
- **R6 RGPD** : données minimales (nom, email école, rôle) ; pas de personnes sur les photos ni de données personnelles dans les descriptions.

| ID | User story (intitulé officiel) | Priorité | Preuve |
|---|---|---|---|
| US-01 | Connexion avec le compte école (SSO) | Must | access, helpers |
| US-02 | Attribuer des rôles | Must | students-roles |
| US-03 | Signaler un incident | Must | access, workflow |
| US-04 | Ajouter une photo ou un fichier | Should | alignment, access |
| US-05 | Préciser l'urgence ressentie | Should | access (CRITIQUE), incident.test |
| US-06 | Être averti d'un incident similaire | Could | students-roles |
| US-07 | Sauvegarder un signalement non terminé | Could | e2e navigateur |
| US-08 | Liste de mes signalements | Must | access |
| US-09 | Historique de traitement | Must | workflow |
| US-10 | Notification à chaque changement de statut | Should | workflow, students-roles |
| US-11 | Confirmer ou contester la résolution | Should | workflow, students-roles |
| US-12 | Noter la qualité du traitement | Should | workflow |
| US-13 | Affecter un ticket à un agent ou à une équipe | Must | workflow |
| US-14 | Changer le statut et commenter | Must | workflow |
| US-15 | Notes internes | Should | workflow |
| US-16 | Modifier la catégorie ou l'urgence | Must | workflow |
| US-17 | Rejeter (avec motif) ou fusionner un doublon | Should | workflow |
| US-18 | Délais cibles par catégorie et alertes | Should | workflow, incident.test |
| US-19 | Poser une question à l'assistant | Should | assistant |
| US-20 | Voir la source de la réponse | Should | assistant |
| US-21 | Ticket pré-rempli proposé par l'assistant | Should | assistant |
| US-22 | « Où en est mon ticket ? » | Could | assistant |
| US-23 | Pouce haut / bas | Could | assistant |
| US-24 | Gérer FAQ et documents de l'assistant | Should | assistant |
| US-25 | L'IA propose catégorie et urgence à l'agent | Could | alignment, assistant |
| US-26 | Assistant identifié comme IA, refus hors périmètre | Should | assistant |
| US-27 | Tickets par statut, catégorie et période | Must | dashboard |
| US-28 | Délai moyen, taux de résolution, taux de réouverture | Should | kpi.test, dashboard |
| US-29 | Incidents par bâtiment ou salle | Could | dashboard, alignment |
| US-30 | Évolution semaine / mois / année | Could | kpi.test, dashboard |
| US-31 | Statistiques de l'assistant | Could | kpi.test, dashboard |
| US-32 | Charge par agent ou équipe | Should | dashboard |
| US-33 | Filtrer les tableaux de bord et exporter (CSV/PDF) | Could | alignment, dashboard |
| US-34 | Données protégées et supprimables sur demande | Must | transverse |
| US-35 | Mobile, ordinateur, interface accessible (RGAA/WCAG) | Must | audit axe-core |
| US-36 | Temps de réponse rapides en forte affluence | Should | test de charge |
| US-37 | Historique des actions sensibles | Should | transverse |
| US-38 | Plateforme et assistant en français et en anglais | Could | i18n.test, workflow |

---

## Accès et rôles

### US-01 — Connexion avec le compte école (Must)
*En tant qu'étudiant, je veux me connecter avec mon compte école (SSO) afin d'accéder à la plateforme sans créer de nouveau compte.*
```gherkin
Scénario : connexion par le compte école
  Étant donné le compte « alice.martin@esiea.fr » (STUDENT)
  Quand je me connecte avec ce compte
  Alors j'arrive sur « Mes signalements », sans aucune étape d'inscription
  Quand je saisis un mauvais mot de passe
  Alors « Email ou mot de passe incorrect » s'affiche
```
1. Aucune page d'inscription ; seuls les comptes de l'école se connectent (SSO simulé par les comptes de démo ; Cognito en production). 2. Redirection selon le rôle (`/etudiant`, `/agent`, `/admin`). 3. Toute route protégée renvoie 401 sans session valide. 4. Authentification isolée derrière `AuthProvider`.

### US-02 — Attribuer des rôles (Must)
*En tant qu'administrateur, je veux attribuer des rôles (étudiant, agent, admin) afin de contrôler l'accès aux fonctionnalités.*
```gherkin
Scénario : promotion
  Quand l'admin passe Bob de « Étudiant » à « Agent »
  Alors Bob accède à l'espace agent dès sa requête suivante
  Et le changement figure au journal d'audit
```
1. Réservé ADMIN (403 sinon). 2. Impossible sur soi-même ou sur un agent ayant des tickets ouverts (409). 3. Rôle relu à chaque requête ; groupe Cognito synchronisé en production. 4. Audit `ROLE_CHANGE`.

## Signaler

### US-03 — Signaler un incident (Must)
*En tant qu'étudiant, je veux signaler un incident (salle fermée, matériel défectueux, problème réseau) afin qu'il soit pris en charge.*
```gherkin
Scénario : signalement complet
  Quand je choisis « Réseau », « Bâtiment A », « A102 », je décris le problème et je valide
  Alors je vois le numéro « SC-xxxx » et le statut « Nouveau »
Scénario : champ manquant
  Quand je valide sans description
  Alors « La description est obligatoire » s'affiche et ma saisie est conservée
```
1. Obligatoires : type, bâtiment, salle, description (10–2 000). 2. Création `NOUVEAU`, numéro séquentiel, événement « Ticket créé ». 3. 400 côté serveur si incomplet. 4. Utilisable à 360 px.

### US-04 — Ajouter une photo ou un fichier (Should)
*En tant qu'étudiant, je veux ajouter une photo ou un fichier afin d'illustrer le problème.*
```gherkin
Scénario : photo ou PDF
  Quand je joins un JPG de 3 Mo ou un PDF
  Alors la pièce jointe est visible dans le détail (image ou lien « Ouvrir le document »)
  Quand je joins un fichier de 12 Mo ou d'un autre type
  Alors « Photo JPG/PNG ou document PDF de 10 Mo maximum » s'affiche
```
1. JPG, PNG ou PDF, 10 Mo max ; signature binaire vérifiée côté serveur. 2. Stockage `FileStorage` (local / S3 privé, envoi direct par URL présignée en production). 3. Lecture uniquement par les personnes autorisées (R1).

### US-05 — Préciser l'urgence ressentie (Should)
*En tant qu'étudiant, je veux préciser le niveau d'urgence ressenti afin d'aider à la qualification du ticket.*
```gherkin
Scénario : urgence haute
  Quand je choisis « Haute » et valide
  Alors le ticket affiche l'urgence « Haute » et la priorité « Haute »
```
1. Faible / Normale (défaut) / Haute. 2. Priorité = urgence, sauf Sécurité → Critique (R3).

### US-06 — Incident similaire (Could)
*En tant qu'étudiant, je veux être averti si un incident similaire existe déjà afin d'éviter les signalements en double.*
```gherkin
Scénario : doublon potentiel
  Étant donné un ticket « Réseau » ouvert dans le « Bâtiment A »
  Quand je choisis « Réseau » et « Bâtiment A »
  Alors un avertissement cite ce ticket (numéro, statut, date) et je peux quand même envoyer
```
1. Similaire = même catégorie + même bâtiment, statut Nouveau ou En cours. 2. Ni description ni auteur exposés.

### US-07 — Sauvegarder un signalement non terminé (Could)
*En tant qu'étudiant, je veux sauvegarder un signalement non terminé afin de le finir plus tard.*
```gherkin
Scénario : brouillon
  Étant donné un signalement commencé puis abandonné
  Quand je reviens sur « Signaler »
  Alors « Brouillon restauré » s'affiche avec mes champs ; il disparaît après l'envoi
```
1. Enregistrement automatique sur l'appareil, par utilisateur, sans la pièce jointe. 2. Bouton « Effacer le brouillon ».

## Suivre

### US-08 — Liste de mes signalements (Must)
*En tant qu'étudiant, je veux voir la liste de mes signalements avec leur statut afin de savoir où ils en sont.*
```gherkin
Scénario : liste personnelle
  Quand Alice ouvre « Mes signalements »
  Alors elle voit uniquement ses tickets, du plus récent au plus ancien, avec lieu, statut et date
```
1. Filtre appliqué par l'API selon l'identité. 2. État vide avec action « Signaler ». 3. Mise à jour automatique.

### US-09 — Historique de traitement (Must)
*En tant qu'étudiant, je veux voir l'historique de traitement d'un ticket afin de comprendre les actions réalisées.*
```gherkin
Scénario : timeline
  Étant donné un ticket créé, affecté puis passé « En cours » avec un commentaire
  Alors le détail montre les 3 événements dans l'ordre, avec auteur, rôle, date et commentaire
```
1. Heure de Paris. 2. Les notes internes (US-15) n'apparaissent jamais.

### US-10 — Notifications (Should)
*En tant qu'étudiant, je veux être notifié à chaque changement de statut afin de ne pas consulter la plateforme en permanence.*
```gherkin
Scénario : changement de statut
  Quand un agent passe mon ticket « En cours »
  Alors la cloche affiche une notification non lue et un email m'est envoyé
```
1. Statut changé, rejet, fusion, retard (étudiant) ; affectation et contestation (agent). 2. In-app + email (`Mailer` : console en local, SES via la Lambda Notifications en production). 3. Un échec d'email ne bloque pas l'action.

### US-11 — Confirmer ou contester la résolution (Should)
*En tant qu'étudiant, je veux confirmer ou contester la résolution afin de valider que le problème est réellement réglé.*
```gherkin
Scénario : contestation
  Étant donné mon ticket « Résolu »
  Quand je conteste avec « Toujours en panne »
  Alors il repasse « En cours », les réouvertures valent 1 et l'agent est notifié
```
1. Propriétaire d'un ticket `RESOLU` uniquement. 2. Commentaire obligatoire pour contester. 3. Confirmer → `FERME`.

### US-12 — Noter la qualité du traitement (Should)
*En tant qu'étudiant, je veux noter la qualité du traitement afin de donner mon retour à l'école.*
```gherkin
Scénario : notation
  Étant donné mon ticket « Fermé » non noté
  Quand je donne 4 étoiles avec « Rapide »
  Alors la note est enregistrée, comptée dans la satisfaction, et je ne peux plus noter
```
1. 1 à 5 + commentaire facultatif. 2. `RESOLU` ou `FERME`, une seule fois, propriétaire uniquement.

## Traiter

### US-13 — Affecter un ticket (Must)
*En tant qu'administrateur, je veux affecter un ticket à un agent ou à une équipe afin de répartir la charge.*
```gherkin
Scénario : affectation
  Quand l'admin affecte « SC-0007 » à Karim Benali
  Alors le ticket affiche Karim, un événement est ajouté, Karim est notifié ; le statut ne change pas
```
1. Agents assignables avec leur charge ouverte. 2. 403 pour un non-admin. 3. Impossible sur un ticket clos. 4. *Équipe : non modélisée (voir écarts).*

### US-14 — Changer le statut et commenter (Must)
*En tant qu'agent, je veux changer le statut d'un ticket et ajouter un commentaire afin de tenir l'étudiant informé.*
```gherkin
Scénario : traitement
  Quand Karim passe « SC-0007 » « En cours » avec « Technicien en route » puis « Résolu »
  Alors l'étudiant voit les deux changements et le commentaire
Scénario : interdit
  Quand Karim tente « Nouveau » → « Résolu », l'API répond 409
```
1. Seules les transitions autorisées sont proposées et acceptées. 2. Prise en charge d'un ticket non affecté : une seule réussit en cas de concurrence (409).

### US-15 — Notes internes (Should)
*En tant qu'agent, je veux écrire des notes visibles uniquement en interne afin de partager l'information entre collègues.*
```gherkin
Scénario : note interne
  Quand Karim ajoute « Pièce commandée »
  Alors agents et admins la voient ; l'étudiant ne la voit ni dans l'interface ni dans l'API
```

### US-16 — Modifier la catégorie ou l'urgence (Must)
*En tant qu'agent, je veux modifier la catégorie ou l'urgence d'un ticket afin de corriger une mauvaise qualification.*
```gherkin
Scénario : requalification en Sécurité
  Quand l'agent requalifie un ticket « Autre » en « Sécurité »
  Alors sa priorité devient « Critique », l'admin est alerté, et l'historique le trace
```
1. Agent affecté ou admin, ticket non clos. 2. Priorité et titre recalculés.

### US-17 — Rejeter ou fusionner (Should)
*En tant qu'agent, je veux rejeter un ticket (avec motif) ou le fusionner avec un doublon afin de garder un backlog propre.*
```gherkin
Scénario : rejet sans motif refusé, puis fusion
  Quand Karim rejette sans motif, l'API répond 400
  Quand il fusionne « SC-0011 » dans « SC-0009 »
  Alors « SC-0011 » passe « Rejeté » avec « Doublon de SC-0009 » et son auteur est notifié
```
1. Motif 5–500 caractères. 2. Fusion entre deux tickets distincts non clos. 3. Audit `REJECT` / `MERGE`.

### US-18 — Délais cibles et alertes (Should)
*En tant qu'administrateur, je veux définir des délais cibles par catégorie et être alerté en cas de dépassement afin de garantir la qualité de service.*
```gherkin
Scénario : dépassement
  Étant donné « Réseau » à 24 h et un ticket « Nouveau » de 25 h
  Alors il est « En retard », l'admin est alerté et l'étudiant notifié une seule fois
```
1. 1 à 720 h par catégorie (24 h par défaut, Sécurité 4 h). 2. Contrôle périodique (EventBridge toutes les 15 min en production).

## Assistant IA

### US-19 — Poser une question (Should)
*En tant qu'étudiant, je veux poser une question à l'assistant en langage naturel afin d'obtenir une réponse immédiate.*
```gherkin
Scénario : question couverte
  Quand je demande « le wifi ne marche pas, je fais quoi ? »
  Alors l'assistant répond à partir de la FAQ « Comment me connecter au wifi du campus ? »
```
1. Sources : FAQ, documents et tickets de l'utilisateur uniquement. 2. Bedrock (Nova Lite) en production, assistant simulé en local et en repli.

### US-20 — Source de la réponse (Should)
*En tant qu'étudiant, je veux voir la source de la réponse afin de pouvoir lui faire confiance.*
```gherkin
Scénario : source citée
  Alors la réponse affiche « Source : FAQ « Comment me connecter au wifi du campus ? » »
```

### US-21 — Ticket pré-rempli (Should)
*En tant qu'étudiant, je veux que l'assistant me propose de créer un ticket pré-rempli quand il ne sait pas répondre ou que le problème nécessite une intervention.*
```gherkin
Scénario : intervention nécessaire
  Quand je dis « la porte de la salle B204 est bloquée »
  Alors un ticket « Salle », Bâtiment B, « B204 » est proposé ; rien n'est créé sans ma validation
```

### US-22 — « Où en est mon ticket ? » (Could)
*En tant qu'étudiant, je veux demander à l'assistant « où en est mon ticket ? » afin d'avoir le statut sans naviguer dans l'application.*
```gherkin
Scénario : suivi
  Quand je demande « où en est mon ticket SC-0044 ? »
  Alors l'assistant donne son statut réel et l'agent ; le ticket d'un autre est « introuvable parmi les vôtres »
```

### US-23 — Pouce haut / bas (Could)
*En tant qu'étudiant, je veux indiquer si la réponse était utile (pouce haut/bas) afin d'améliorer l'assistant.*
```gherkin
Scénario : avis
  Quand je clique « utile » sous une réponse, l'avis est enregistré et modifiable
```

### US-24 — Gérer FAQ et documents (Should)
*En tant qu'administrateur, je veux ajouter, modifier et supprimer les questions fréquentes et documents utilisés par l'assistant afin de garder ses réponses à jour.*
```gherkin
Scénario : nouvelle FAQ
  Quand l'admin ajoute « Où garer mon vélo ? »
  Alors l'assistant l'utilise immédiatement pour « où mettre mon vélo »
```

### US-25 — Suggestion de catégorie et d'urgence (Could)
*En tant qu'agent, je veux que l'IA propose une catégorie et une urgence pour chaque nouveau ticket afin de gagner du temps de tri.*
```gherkin
Scénario : tri assisté
  Étant donné un nouveau ticket « Fumée qui sort du tableau électrique » classé « Autre »
  Quand l'agent l'ouvre
  Alors « Suggestion de l'assistant : Sécurité, urgence haute » s'affiche avec « Appliquer »
```
1. Affichée sur chaque ticket `NOUVEAU` si elle diffère du classement actuel. 2. Appliquer = requalification (US-16). 3. Également proposée à l'étudiant pendant la saisie.

### US-26 — Transparence et périmètre (Should)
*En tant qu'administrateur, je veux que l'assistant affiche clairement qu'il s'agit d'une IA et qu'il refuse les sujets hors périmètre afin d'éviter les réponses erronées ou inappropriées.*
```gherkin
Scénario : hors périmètre
  Quand je demande « écris ma dissertation de philo »
  Alors l'assistant refuse poliment, sans proposer de ticket ; la mention « IA » est toujours visible
```
1. Guardrails Bedrock en production.

## Pilotage

### US-27 — Volumes (Must)
*En tant qu'administrateur, je veux voir le nombre de tickets par statut, catégorie et période afin de suivre l'activité du campus.*
```gherkin
Scénario : volumes
  Quand l'admin ouvre le tableau de bord sur 30 jours
  Alors la somme des tickets par statut vaut le total de la période, avec la répartition par catégorie
```

### US-28 — Indicateurs de performance (Should)
*En tant qu'administrateur, je veux consulter le délai moyen de résolution, le taux de résolution et le taux de réouverture afin de mesurer la performance.*
```gherkin
Scénario : calcul
  Étant donné 10 tickets dont 6 résolus en 12 h en moyenne et 1 contesté
  Alors délai moyen 12 h, résolution 60 %, réouverture 17 %
```

### US-29 — Par bâtiment ou salle (Could)
*En tant qu'administrateur, je veux visualiser les incidents par bâtiment ou salle afin d'identifier les zones à problèmes récurrents.*
```gherkin
Scénario : zones
  Alors le tableau de bord montre les tickets par bâtiment (y compris à 0) et les salles les plus signalées
```

### US-30 — Évolution (Could)
*En tant qu'administrateur, je veux voir l'évolution des incidents sur la semaine, le mois et l'année afin de détecter des pics.*
```gherkin
Scénario : granularité
  Quand je choisis « par semaine », la courbe montre créés et résolus par semaine
```

### US-31 — Statistiques de l'assistant (Could)
*En tant qu'administrateur, je veux suivre le nombre de questions, le taux de résolution sans ticket et la satisfaction afin d'évaluer la valeur de l'IA.*
```gherkin
Scénario : valeur de l'IA
  Alors le tableau de bord montre le nombre de questions, la part résolue sans ticket et les avis utiles / pas utiles, jamais le contenu des questions
```

### US-32 — Charge par agent (Should)
*En tant qu'administrateur, je veux voir la charge par agent ou équipe afin de rééquilibrer l'affectation.*
```gherkin
Scénario : charge
  Alors un tableau donne par agent les tickets ouverts, critiques, en retard, résolus et le délai moyen
```

### US-33 — Filtrer et exporter (Could)
*En tant qu'administrateur, je veux filtrer les tableaux de bord (période, catégorie, lieu) et exporter les données (CSV/PDF) afin de produire des rapports.*
```gherkin
Scénario : rapport filtré
  Quand je filtre « Réseau » sur 30 jours et clique « Exporter en CSV »
  Alors je télécharge uniquement les tickets correspondants, et l'export est tracé
  Quand je clique « Exporter en PDF », le tableau de bord s'imprime sans la navigation
```
1. Filtres période, catégorie, bâtiment appliqués à tous les indicateurs. 2. CSV UTF-8 (`;`), audit `EXPORT`. 3. Liste des tickets filtrable et exportable également.

## Transverses

### US-34 — Données protégées et supprimables (Must)
*En tant qu'étudiant, je veux que mes données soient protégées et supprimables sur demande.*
```gherkin
Scénario : suppression sur demande
  Quand l'admin supprime les données d'un étudiant (confirmation par son email)
  Alors le compte est anonymisé ; descriptions, pièces jointes, commentaires, notifications et échanges IA sont supprimés ; les tickets restent anonymes dans les statistiques
```
1. Protection : HTTPS, chiffrement au repos (RDS, S3), en-têtes de sécurité, limitation des connexions (10 échecs / 15 min), accès par rôle. 2. Audit `DATA_DELETION` sans donnée personnelle.

### US-35 — Mobile, ordinateur et accessibilité (Must)
*En tant qu'utilisateur, je veux utiliser la plateforme sur mobile et ordinateur, avec une interface accessible (RGAA/WCAG).*
```gherkin
Scénario : clavier et mobile
  Quand je parcours l'application au clavier sur un écran de 360 px
  Alors tous les champs ont un libellé, le focus est visible et il n'y a pas de défilement horizontal
```
1. Audit axe-core WCAG 2.1 AA sans violation (clair et sombre). 2. Cibles ≥ 44 px, lien d'évitement, contrastes AA.

### US-36 — Temps de réponse (Should)
*En tant qu'utilisateur, je veux des temps de réponse rapides, même en période de forte affluence.*
```gherkin
Scénario : affluence
  Étant donné 50 utilisateurs simultanés
  Alors 99 % des réponses API arrivent en moins de 2 s, sans erreur
```
1. Mesure locale : liste des tickets p99 137 ms, tableau de bord p99 544 ms, 0 erreur. 2. Requêtes > 2 s journalisées. 3. En production : Lambda et API Gateway passent à l'échelle automatiquement.

### US-37 — Historique des actions sensibles (Should)
*En tant qu'administrateur, je veux un historique des actions sensibles afin d'assurer la traçabilité.*
```gherkin
Scénario : audit
  Quand un rôle change, un ticket est rejeté ou fusionné, des données sont supprimées ou exportées
  Alors une entrée apparaît dans le journal d'audit (lecture seule, filtrable)
```

### US-38 — Français et anglais (Could)
*En tant qu'étudiant international, je veux utiliser la plateforme et l'assistant en français et en anglais.*
```gherkin
Scénario : bascule
  Quand je choisis « EN », toute l'interface passe en anglais ; une question en anglais reçoit une réponse en anglais
```
1. Choix mémorisé (appareil + profil, utilisé pour les emails).
