# Exigences — SmartCampus AI (38 user stories)

> Périmètre : **exactement US-01 à US-38**. Workshop Capgemini × ESIEA, démo le 23/10 sur AWS (us-east-1).
> ⚠ Le fichier officiel des 38 stories n'a pas été reçu : les intitulés ci-dessous sont reconstitués à partir des messages du PO.
> US-27, US-35 et US-36 sont **déduites** (marquées 🔶) et doivent être confirmées.

## Glossaire et règles client
- **Statuts** : `NOUVEAU` → `EN_COURS` → `RESOLU` → `FERME`, plus `REJETE` (motif obligatoire, y compris fusion de doublon).
- **Rôles** : `STUDENT`, `AGENT`, `ADMIN`. Contrôle d'accès côté API ; ticket non autorisé → 404.
- **R1 Accès** : l'étudiant voit ses tickets ; l'agent ceux qui lui sont affectés et les non affectés ; l'admin tout.
- **R2 Historique** : chaque changement (statut, affectation, catégorie/urgence, fusion) crée un événement horodaté (auteur, rôle, ancien/nouveau statut, commentaire).
- **R3 Sécurité** : catégorie Sécurité → priorité `CRITIQUE` + alerte immédiate à l'admin.
- **R4 Délai cible** (US-18) : délai de prise en charge (sortie de `NOUVEAU`) par catégorie, **24 h par défaut**, modifiable par l'admin. Dépassement → alerte admin + notification étudiant.
- **R5 RGPD** : données minimales (nom, email école, rôle) ; mention « pas de personnes sur les photos, pas de données personnelles dans la description ».
- **Priorité** = urgence ressentie, sauf priorité imposée par la catégorie (Sécurité → `CRITIQUE`).

Blocs de réalisation : ✅ fait · **a** traitement · **b** dashboard · **c** assistant · **d** compléments étudiant/rôles · **e** transverses.

---

## Épopée 1 — Accès et signalement (étudiant)

### US-01 — Connexion avec le compte école ✅
*En tant qu'étudiant, je veux me connecter avec mon compte école afin d'accéder à la plateforme sans créer de compte (SSO simulé).*
```gherkin
Scénario : connexion
  Étant donné le compte de démo « alice.martin@esiea.fr » (STUDENT)
  Quand je me connecte avec son email et son mot de passe
  Alors j'arrive sur « Mes signalements » et mon nom est affiché
  Quand je saisis un mauvais mot de passe
  Alors « Email ou mot de passe incorrect » s'affiche
```
1. Pas d'inscription ; seuls les comptes seedés se connectent. 2. Redirection par rôle (`/etudiant`, `/agent`, `/admin`). 3. JWT en cookie httpOnly ; 401 sans session ; 403 hors rôle. 4. Authentification derrière `AuthProvider`.

### US-02 — Attribuer les rôles (admin) — bloc d
*En tant qu'administrateur, je veux attribuer un rôle à un utilisateur afin de donner les bons droits à chacun.*
```gherkin
Scénario : promotion d'un utilisateur
  Étant donné que je suis admin sur la page « Utilisateurs »
  Quand je passe Bob Durand de « Étudiant » à « Agent »
  Alors Bob apparaît comme Agent
  Et à sa prochaine requête Bob accède à l'espace agent
  Et une entrée « Changement de rôle » est ajoutée au journal d'audit
```
1. Liste des utilisateurs (nom, email, rôle), recherche par nom/email. 2. Changement de rôle réservé à l'ADMIN (403 sinon). 3. Un admin ne peut pas retirer son propre rôle admin (409). 4. Le rôle est relu en base à chaque requête (effet immédiat). 5. Audit `ROLE_CHANGE` (US-37).

### US-03 — Signaler un incident ✅
*En tant qu'étudiant, je veux signaler un incident afin qu'il soit pris en charge.*
```gherkin
Scénario : signalement complet
  Quand je choisis « Réseau », « Bâtiment A », salle « A102 », je décris le problème et je valide
  Alors je vois le numéro « SC-xxxx » et le statut « Nouveau »
Scénario : champ manquant
  Quand je valide sans description
  Alors « La description est obligatoire » s'affiche et ma saisie est conservée
```
1. Obligatoires : type, bâtiment, salle, description (10–2 000 car.). 2. Types et bâtiments en base. 3. Création `NOUVEAU`, numéro séquentiel, événement « Ticket créé ». 4. Mention RGPD visible. 5. 400 côté serveur si incomplet. 6. Utilisable à 360 px.

### US-04 — Ajouter une photo ✅
*En tant qu'étudiant, je veux ajouter une photo afin d'illustrer le problème.*
```gherkin
Scénario : photo valide puis refusée
  Quand j'ajoute un JPG de 3 Mo, un aperçu s'affiche et la photo est visible dans le détail
  Quand j'ajoute un PDF ou une image de 12 Mo
  Alors « Photo JPG ou PNG de 10 Mo maximum » s'affiche
```
1. JPG/PNG ≤ 10 Mo, vérifié côté front et API (signature binaire). 2. `FileStorage` local ou S3. 3. Photo servie par l'API selon R1.

### US-05 — Urgence ressentie ✅
*En tant qu'étudiant, je veux préciser le niveau d'urgence ressenti afin d'aider à la qualification.*
```gherkin
Scénario : urgence haute
  Quand je choisis « Haute » et valide
  Alors le ticket affiche l'urgence « Haute » et la priorité « Haute »
```
1. Faible / Normale (défaut) / Haute. 2. Priorité dérivée (Sécurité → Critique).

### US-06 — Avertir d'un incident similaire — bloc d
*En tant qu'étudiant, je veux être averti si un incident similaire est déjà ouvert afin d'éviter les doublons.*
```gherkin
Scénario : doublon potentiel
  Étant donné un ticket « Réseau » non clos dans le « Bâtiment A »
  Quand je choisis « Réseau » et « Bâtiment A » dans le formulaire
  Alors un avertissement indique qu'un incident similaire est déjà en cours, avec son numéro, son statut et sa date
  Et je peux quand même envoyer mon signalement
```
1. Similaire = même catégorie + même bâtiment + statut `NOUVEAU` ou `EN_COURS`. 2. L'avertissement n'expose ni la description ni l'auteur. 3. N'empêche pas l'envoi.

### US-07 — Brouillon de signalement — bloc d
*En tant qu'étudiant, je veux enregistrer un brouillon afin de terminer mon signalement plus tard.*
```gherkin
Scénario : reprise d'un brouillon
  Étant donné que j'ai commencé un signalement puis quitté la page
  Quand je reviens sur « Signaler »
  Alors le message « Brouillon restauré » s'affiche et mes champs sont pré-remplis
  Quand j'envoie le signalement ou que je clique « Effacer le brouillon »
  Alors le brouillon est supprimé
```
1. Enregistrement automatique (type, bâtiment, salle, description, urgence) sur l'appareil, par utilisateur. 2. La photo n'est pas conservée dans le brouillon (indiqué à l'écran). 3. Brouillon supprimé après envoi réussi.

### US-08 — Mes signalements ✅
*En tant qu'étudiant, je veux voir la liste de mes signalements avec leur statut.*
```gherkin
Scénario : liste personnelle
  Quand Alice ouvre « Mes signalements »
  Alors elle voit uniquement ses tickets, du plus récent au plus ancien, avec numéro, titre, type, statut et date
```
1. Filtre par l'API selon le jeton. 2. Badge de statut. 3. État vide avec bouton « Signaler ». 4. < 2 s.

### US-09 — Historique de traitement ✅
*En tant qu'étudiant, je veux voir l'historique d'un ticket afin de comprendre les actions réalisées.*
```gherkin
Scénario : timeline
  Étant donné un ticket créé, affecté puis passé « En cours » avec un commentaire
  Quand j'ouvre son détail
  Alors je vois les 3 événements dans l'ordre avec date, auteur, rôle, statuts et commentaire
```
1. Détail + photo + agent + timeline. 2. Heure de Paris. 3. Les notes internes (US-15) n'apparaissent jamais.

### US-10 — Notifications — bloc a (moteur) / d (interface)
*En tant qu'étudiant, je veux être notifié à chaque changement de statut afin de suivre mon ticket sans le consulter.*
```gherkin
Scénario : changement de statut
  Étant donné que mon ticket « SC-0042 » est « Nouveau »
  Quand un agent le passe « En cours »
  Alors la cloche affiche 1 notification non lue sans recharger la page
  Et un email « Votre ticket SC-0042 est en cours » m'est envoyé
  Quand j'ouvre la notification, elle est marquée lue et m'amène au ticket
```
1. Événements notifiés : changement de statut, affectation (à l'agent), dépassement du délai cible (étudiant), fusion. 2. In-app (cloche + compteur temps réel) et email via `Mailer` (console + fichiers `.eml` en local, SES en production). 3. Un échec d'email ne bloque jamais l'action (journalisé). 4. Textes dans la langue de l'utilisateur (US-38).

### US-11 — Confirmer ou contester la résolution — bloc d
*En tant qu'étudiant, je veux confirmer ou contester la résolution afin de clore ou relancer le traitement.*
```gherkin
Scénario : confirmation
  Étant donné mon ticket « Résolu »
  Quand je clique « Confirmer la résolution »
  Alors il passe « Fermé »
Scénario : contestation
  Quand je clique « Contester » avec le commentaire « Toujours en panne »
  Alors il repasse « En cours », le compteur de réouvertures vaut 1 et l'agent est notifié
```
1. Actions visibles uniquement pour le propriétaire d'un ticket `RESOLU`. 2. Commentaire obligatoire pour contester. 3. 409 si le ticket n'est pas `RESOLU`.

### US-12 — Noter la qualité du traitement — bloc d
*En tant qu'étudiant, je veux noter la qualité du traitement afin de donner mon avis.*
```gherkin
Scénario : notation
  Étant donné mon ticket « Fermé » non noté
  Quand je donne 4 étoiles avec le commentaire « Rapide »
  Alors la note est enregistrée et la satisfaction moyenne du dashboard en tient compte
  Et je ne peux plus noter ce ticket
```
1. Note 1–5 + commentaire facultatif (≤ 500 car.). 2. Possible si `RESOLU` ou `FERME`, une seule fois, propriétaire uniquement (409/404 sinon). 3. Proposée juste après la confirmation (US-11).

---

## Épopée 2 — Traitement (agent, admin)

### US-13 — Affecter un ticket à un agent — bloc a
*En tant qu'administrateur, je veux affecter un ticket à un agent afin de répartir la charge.*
```gherkin
Scénario : affectation
  Étant donné le ticket « SC-0007 » non affecté
  Quand l'admin l'affecte à Karim Benali
  Alors le ticket affiche « Affecté à Karim Benali », un événement est ajouté et Karim est notifié
  Quand un agent appelle l'API d'affectation, il reçoit 403
```
1. Agents assignables = rôle AGENT (avec leur charge ouverte). 2. Réaffectation possible. 3. Ne change pas le statut. 4. Impossible sur un ticket `FERME`/`REJETE` (409).

### US-14 — Changer le statut et commenter — bloc a
*En tant qu'agent, je veux changer le statut d'un ticket et ajouter un commentaire afin de tenir l'étudiant informé.*
```gherkin
Scénario : traitement
  Étant donné « SC-0007 » affecté à Karim, « Nouveau »
  Quand Karim le passe « En cours » avec « Technicien en route » puis « Résolu »
  Alors l'étudiant voit les deux changements et le commentaire dans l'historique
Scénario : transition interdite
  Quand Karim tente « Nouveau » → « Résolu », l'API répond 409
Scénario : prise en charge
  Étant donné un ticket « Nouveau » non affecté
  Quand Karim clique « Prendre en charge », il lui est affecté et passe « En cours »
```
1. Seules les transitions autorisées sont proposées et acceptées. 2. Agent : tickets affectés uniquement (prendre les non affectés). 3. Deux prises simultanées : une seule réussit (409). 4. L'admin a les mêmes actions.

### US-15 — Notes internes — bloc a
*En tant qu'agent, je veux ajouter des notes internes afin de partager des informations techniques sans les montrer à l'étudiant.*
```gherkin
Scénario : note interne
  Quand Karim ajoute la note interne « Pièce commandée, livraison jeudi »
  Alors la note est visible par les agents et admins sur le ticket
  Et l'étudiant ne la voit ni dans l'interface ni dans l'API
```
1. Réservé AGENT (ticket visible) et ADMIN. 2. 1 à 1 000 caractères, auteur et date. 3. Jamais incluses dans les réponses destinées à l'étudiant ni dans le contexte de l'assistant.

### US-16 — Modifier la catégorie ou l'urgence — bloc a
*En tant qu'agent, je veux modifier la catégorie ou l'urgence d'un ticket afin de corriger la qualification.*
```gherkin
Scénario : requalification en Sécurité
  Étant donné un ticket « Autre », urgence « Normale »
  Quand l'agent le requalifie en « Sécurité »
  Alors sa priorité devient « Critique », l'admin reçoit une alerte et un événement « Catégorie : Autre → Sécurité » est ajouté
```
1. Agent affecté ou admin ; ticket non clos. 2. Priorité recalculée. 3. Le titre est régénéré. 4. Événement d'historique `UPDATE`.

### US-17 — Rejeter un ticket / fusionner un doublon — bloc a
*En tant qu'agent, je veux rejeter un ticket avec un motif ou le fusionner avec un doublon afin de garder une file propre.*
```gherkin
Scénario : rejet
  Quand Karim rejette « SC-0010 » sans motif, l'API répond 400
  Quand il le rejette avec « Hors périmètre : à adresser à la scolarité »
  Alors le statut devient « Rejeté », le motif est visible par l'étudiant et l'étudiant est notifié
Scénario : fusion
  Quand Karim fusionne « SC-0011 » dans « SC-0009 »
  Alors « SC-0011 » passe « Rejeté » avec le motif « Doublon de SC-0009 »
  Et les deux historiques mentionnent la fusion, et l'auteur de SC-0011 est notifié
```
1. Motif 5–500 caractères. 2. Fusion : ticket cible visible par l'acteur, non clos, différent. 3. `mergedInto` renseigné. 4. Audit `REJECT` / `MERGE` (US-37).

### US-18 — Délais cibles par catégorie — bloc a
*En tant qu'administrateur, je veux définir un délai cible de prise en charge par catégorie afin de détecter les retards.*
```gherkin
Scénario : dépassement
  Étant donné le délai cible « Réseau » à 24 h (défaut)
  Et un ticket « Réseau » encore « Nouveau » créé il y a 25 h
  Alors il est marqué « En retard » dans les listes et le dashboard
  Et l'admin voit une alerte, et l'étudiant reçoit une notification (une seule fois)
Scénario : modification
  Quand l'admin règle « Sécurité » à 2 h
  Alors un ticket Sécurité « Nouveau » de 3 h est en retard
```
1. Défaut 24 h, de 1 à 720 h, réglé par l'admin. 2. Retard = statut `NOUVEAU` au-delà du délai de sa catégorie. 3. Contrôle périodique (toutes les 5 min) : notification étudiant + alerte admin, une seule fois par ticket.

---

## Épopée 3 — Assistant IA

### US-19 — Poser une question — bloc c
*En tant qu'étudiant, je veux poser une question en langage naturel afin d'obtenir une réponse immédiate.*
```gherkin
Scénario : question couverte
  Quand je demande « le wifi ne marche pas, je fais quoi ? »
  Alors l'assistant répond à partir de la FAQ « Comment me connecter au wifi du campus ? »
```
1. Sources : base documentaire (FAQ + documents) et tickets **de l'utilisateur connecté** uniquement. 2. Adapters `mock` (mots-clés) / `bedrock` (Converse, Nova Lite). 3. < 2 s en mock.

### US-20 — Afficher la source — bloc c
*En tant qu'étudiant, je veux voir la source de la réponse afin de lui faire confiance.*
```gherkin
Scénario : source citée
  Quand l'assistant répond à partir de la FAQ
  Alors la réponse affiche « Source : FAQ — Comment me connecter au wifi du campus ? »
```
1. Chaque réponse fondée cite au moins une source (FAQ ou document, titre). 2. Une réponse sans source est présentée comme « je ne sais pas ».

### US-21 — Ticket pré-rempli — bloc c
*En tant qu'étudiant, je veux que l'assistant me propose un ticket pré-rempli quand il ne sait pas répondre.*
```gherkin
Scénario : intervention nécessaire
  Quand je dis « la porte de la salle B204 est bloquée »
  Alors l'assistant propose un ticket « Salle », Bâtiment B, salle « B204 », description reprise
  Quand je clique « Créer ce ticket », le formulaire s'ouvre pré-rempli ; rien n'est créé sans ma validation
```
1. Proposé si pas de réponse ou intervention nécessaire. 2. Catégorie, bâtiment, salle déduits. 3. Le ticket créé est rattaché à l'échange (statistiques US-32).

### US-22 — « Où en est mon ticket ? » — bloc c
*En tant qu'étudiant, je veux demander à l'assistant où en est mon ticket.*
```gherkin
Scénario : suivi
  Étant donné mon ticket « SC-0044 » « En cours », suivi par Julie Robert
  Quand je demande « où en est mon ticket SC-0044 ? »
  Alors l'assistant répond qu'il est « En cours », suivi par Julie Robert, avec un lien vers le ticket
Scénario : ticket d'un autre
  Quand je demande le ticket d'un autre étudiant, l'assistant répond qu'il ne le trouve pas parmi les miens
```
1. Sans numéro : résumé des tickets non clos. 2. Jamais de données d'autres utilisateurs.

### US-23 — Pouce haut / bas — bloc c
*En tant qu'étudiant, je veux évaluer une réponse afin d'améliorer l'assistant.*
```gherkin
Scénario : feedback
  Quand je clique 👍 sous une réponse
  Alors le bouton est marqué et le feedback est enregistré ; je peux changer d'avis
```
1. Un feedback par réponse (modifiable). 2. Agrégé dans US-32.

### US-24 — Gérer la base documentaire — bloc c
*En tant qu'administrateur, je veux gérer la FAQ et les documents de l'assistant afin de tenir ses réponses à jour.*
```gherkin
Scénario : nouvelle entrée
  Quand l'admin ajoute la FAQ « Où garer mon vélo ? » avec sa réponse
  Alors l'assistant l'utilise immédiatement pour « où mettre mon vélo »
```
1. CRUD FAQ (question, réponse, mots-clés, FR/EN) et documents (titre, contenu texte). 2. Réservé ADMIN. 3. Port `KnowledgeBase` : PostgreSQL + mots-clés en local, Bedrock Knowledge Base en production.

### US-25 — Suggestion de catégorie et d'urgence — bloc c
*En tant qu'étudiant, je veux que l'IA me propose une catégorie et une urgence afin de qualifier mon ticket plus vite.*
```gherkin
Scénario : suggestion
  Quand je décris « fumée qui sort du tableau électrique »
  Alors « Suggestion IA : Sécurité · Haute » s'affiche avec un bouton « Appliquer »
  Et rien n'est modifié tant que je n'ai pas cliqué
```
1. Suggestion après saisie d'au moins 15 caractères (anti-rebond). 2. Toujours modifiable ; indiquée comme suggestion d'IA.

### US-26 — Transparence et périmètre de l'IA — bloc c
*En tant qu'administrateur, je veux que l'assistant affiche qu'il s'agit d'une IA et refuse les sujets hors périmètre.*
```gherkin
Scénario : hors périmètre
  Quand je demande « écris ma dissertation de philo »
  Alors l'assistant refuse poliment, rappelle son périmètre et ne propose pas de ticket
```
1. Bandeau « Vous échangez avec une IA… » permanent. 2. Mock : détection hors campus ; production : Bedrock Guardrails (`BEDROCK_GUARDRAIL_ID`). 3. N'invente jamais.

---

## Épopée 4 — Pilotage (admin)

### US-27 🔶 — Filtrer et exporter les tickets — bloc b
*En tant qu'administrateur, je veux filtrer finement les tickets et les exporter en CSV afin de les analyser.*
```gherkin
Scénario : export filtré
  Quand je filtre « Réseau », « En retard » sur 30 jours et clique « Exporter CSV »
  Alors je télécharge un CSV des tickets affichés (numéro, dates, statut, catégorie, bâtiment, agent, priorité, délai)
  Et l'export est tracé dans le journal d'audit
```
1. Filtres : statut, catégorie, bâtiment, agent, priorité, période, recherche texte, « en retard ». 2. CSV UTF-8 (séparateur `;`, compatible Excel), sans description ni données de l'auteur au-delà du nom. 3. Audit `EXPORT`.

### US-28 — Volumes par statut, catégorie, période — bloc b
```gherkin
Scénario : dashboard après seed
  Quand l'admin ouvre le tableau de bord sur « 30 jours »
  Alors il voit les compteurs par statut (dont la somme vaut le total), un graphique par catégorie et la tendance quotidienne
```
1. Périodes 7 j / 30 j / 90 j / tout. 2. Critiques ouverts et retards mis en évidence. 3. ADMIN uniquement.

### US-29 — Indicateurs de performance — bloc b
```gherkin
Scénario : calcul
  Étant donné 10 tickets, dont 6 résolus/fermés en 12 h en moyenne et 1 contesté
  Alors délai moyen « 12 h », taux de résolution « 60 % », taux de réouverture « 17 % »
```
1. Délai moyen = moyenne (dernière résolution − création) des tickets résolus/fermés (D6). 2. Taux de résolution = (résolus + fermés) / tickets hors rejetés. 3. Taux de réouverture = tickets contestés / tickets ayant été résolus. 4. Satisfaction moyenne (US-12). 5. Fonctions pures testées.

### US-30 — Incidents par bâtiment — bloc b
```gherkin
Scénario : répartition
  Alors un graphique affiche les tickets par bâtiment, triés par ordre décroissant, y compris les bâtiments à 0
```

### US-31 — Évolution semaine / mois / année — bloc b
```gherkin
Scénario : granularité
  Quand je choisis « par semaine »
  Alors la courbe affiche le nombre de tickets créés et résolus par semaine
```
1. Granularités jour / semaine / mois / année. 2. Créés et résolus sur la même courbe.

### US-32 — Statistiques de l'assistant — bloc b (+ données bloc c)
```gherkin
Scénario : stats IA
  Alors l'admin voit le nombre de questions, la répartition des réponses (FAQ, suivi, ticket proposé, hors périmètre), le taux de 👍 et le nombre de tickets créés depuis l'assistant
  Et jamais le contenu des questions
```
1. % résolu par l'IA = réponses fondées avec 👍 et sans ticket / réponses évaluées.

### US-33 — Charge par agent — bloc b
```gherkin
Scénario : charge
  Alors un tableau liste par agent : tickets ouverts, critiques, en retard, résolus sur la période et délai moyen
```

---

## Épopée 5 — Transverses

### US-34 — Suppression des données sur demande — bloc e
*En tant qu'administrateur, je veux supprimer les données personnelles d'un étudiant sur demande afin de respecter le RGPD.*
```gherkin
Scénario : anonymisation
  Étant donné l'étudiant Lucas Bernard avec 3 tickets
  Quand l'admin confirme « Supprimer ses données »
  Alors son compte est anonymisé et ne peut plus se connecter
  Et ses tickets restent dans les statistiques mais sans description, photo, commentaires ni nom
  Et l'action est tracée dans le journal d'audit
```
1. Impossible sur un agent/admin ou sur soi (409). 2. Supprime aussi ses notifications, échanges avec l'assistant et commentaires de note. 3. Confirmation explicite (saisie de l'email). 4. Audit `DATA_DELETION`.

### US-35 🔶 — Responsive et accessibilité — bloc e
```gherkin
Scénario : clavier et mobile
  Quand je parcours le signalement au clavier sur un écran de 360 px
  Alors tous les champs ont un label, le focus est visible et aucune barre de défilement horizontale n'apparaît
```
1. Lien d'évitement, labels, contrastes AA, cibles ≥ 44 px, `aria-live` pour les messages.

### US-36 🔶 — Performance et sécurité — bloc e
```gherkin
Scénario : sécurité de base
  Alors chaque réponse API porte les en-têtes de sécurité, la connexion est limitée à 10 essais / 15 min par IP
  Et toute requête > 2 s est journalisée
```
1. RBAC serveur (tests 401/403/404). 2. HTTPS (Traefik + Let's Encrypt), cookie `Secure`. 3. Chiffrement au repos RDS et S3. 4. API < 2 s.

### US-37 — Journal des actions sensibles — bloc e
```gherkin
Scénario : audit
  Quand un admin change un rôle, rejette ou fusionne un ticket, supprime des données ou exporte
  Alors une entrée (date, auteur, action, cible, détails) apparaît dans « Journal d'audit », filtrable par action
```
1. Table append-only (aucune route de modification). 2. ADMIN uniquement.

### US-38 — Français / anglais — bloc e
```gherkin
Scénario : bascule de langue
  Quand je choisis « EN » dans le sélecteur
  Alors toute l'interface passe en anglais et ce choix est mémorisé
  Quand je pose une question en anglais à l'assistant
  Alors il répond en anglais
```
1. Sélecteur FR/EN sur toutes les pages (y compris connexion). 2. Langue mémorisée (appareil + profil, utilisée pour les emails). 3. Libellés métier (statuts, catégories, FAQ) traduits.
