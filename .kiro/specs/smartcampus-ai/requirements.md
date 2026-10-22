# Exigences — SmartCampus AI

> Source : user stories officielles de la BA (workshop Capgemini × ESIEA). Réalisation le vendredi 23/10 (10h40–14h30), démo juste après.
> Objectif : un **MVP testable et démontrable, déployé sur AWS** (EC2 + RDS PostgreSQL + S3 + Bedrock, us-east-1).
> Ordre d'implémentation des Must : US-01 → US-03/04/05 → US-08/09 → US-13/14 → US-28/29/30 → US-19/21/26.

## Glossaire
- **Ticket** : un signalement d'incident. Numéro affiché `SC-0001`.
- **Statuts** : `NOUVEAU` → `EN_COURS` → `RESOLU` → `FERME`, plus `REJETE` (motif obligatoire).
- **Rôles** : `STUDENT` (étudiant), `AGENT` (agent technique), `ADMIN` (administrateur).
- **Urgence ressentie** (saisie par l'étudiant) : `FAIBLE` / `NORMALE` / `HAUTE`.
- **Priorité** (qualification) : `FAIBLE` / `NORMALE` / `HAUTE` / `CRITIQUE` ; égale à l'urgence ressentie, sauf la catégorie Sécurité qui passe automatiquement en `CRITIQUE`.
- **Prise en charge** : passage du ticket hors du statut `NOUVEAU`.
- **Ticket en retard** : ticket encore `NOUVEAU` plus de 24 h après sa création.

## Règles transverses
- **R1** Contrôle d'accès vérifié côté API : un étudiant ne voit que ses tickets ; un agent voit les tickets qui lui sont affectés et ceux qui ne sont affectés à personne ; l'admin voit tout.
- **R2** Chaque changement de statut ou d'affectation crée un événement d'historique horodaté (auteur, rôle, ancien statut, nouveau statut, commentaire).
- **R3** Catégorie Sécurité → priorité `CRITIQUE` automatique + alerte immédiate dans l'espace admin.
- **R4** Ticket non pris en charge sous 24 h → signalé « en retard » dans le dashboard et notification à l'étudiant (la notification in-app relève de US-10).
- **R5** RGPD : données minimales (nom, email école, rôle) ; mention « pas de personnes sur les photos, pas de données personnelles dans la description ».

---

## MUST — MVP de la démo

### US-01 — Connexion avec le compte école (SSO simulé)
*En tant qu'étudiant, je veux me connecter avec mon compte école afin d'accéder à la plateforme sans créer de compte.*

```gherkin
Scénario : connexion d'un étudiant avec son compte école
  Étant donné le compte de démo « alice.martin@esiea.fr » de rôle STUDENT
  Quand je saisis son email et son mot de passe sur la page « Connexion école »
  Alors j'arrive sur « Mes signalements »
  Et mon nom est affiché dans l'en-tête

Scénario : identifiants invalides
  Quand je saisis un mot de passe incorrect
  Alors le message « Email ou mot de passe incorrect » s'affiche
  Et je reste sur la page de connexion
```
**Critères d'acceptation**
1. Aucune page d'inscription : seuls les comptes seedés (2 étudiants, 2 agents, 1 admin) peuvent se connecter.
2. Après connexion, redirection selon le rôle : STUDENT → `/etudiant`, AGENT → `/agent`, ADMIN → `/admin`.
3. La session est un JWT en cookie httpOnly ; toute route API protégée renvoie 401 sans cookie valide.
4. Un utilisateur qui ouvre l'URL d'un autre espace est redirigé vers le sien ; l'API renvoie 403 pour un rôle non autorisé.
5. La déconnexion supprime le cookie.
6. L'authentification est isolée derrière `AuthProvider` (remplaçable par un vrai SSO).

### US-03 — Signaler un incident
*En tant qu'étudiant, je veux signaler un incident (salle fermée, matériel défectueux, problème réseau) afin qu'il soit pris en charge.*

```gherkin
Scénario : signalement complet
  Étant donné que je suis connecté en tant qu'étudiant
  Quand je choisis le type « Réseau », le bâtiment « Bâtiment A », la salle « A102 »
  Et je décris « Le wifi ne fonctionne plus depuis ce matin »
  Et je valide
  Alors une confirmation affiche un numéro de ticket « SC-xxxx » et le statut « Nouveau »
  Et le ticket apparaît dans « Mes signalements »

Scénario : champ obligatoire manquant
  Quand je valide sans description
  Alors le message « La description est obligatoire » s'affiche sous le champ
  Et ma saisie est conservée
```
**Critères d'acceptation**
1. Champs obligatoires : type (catégorie), bâtiment, salle, description (10 à 2 000 caractères).
2. Les types et bâtiments proviennent de la base (seed), pas du code du formulaire.
3. Le ticket est créé au statut `NOUVEAU` avec un numéro séquentiel `SC-0001`, et un premier événement d'historique « Ticket créé ».
4. La mention RGPD (R5) est visible sur le formulaire.
5. Le serveur rejette (400) une requête incomplète, même si le front est contourné.
6. Le formulaire est utilisable sur un écran de 360 px de large.
7. Catégorie Sécurité : priorité `CRITIQUE` (R3) et alerte affichée dans l'espace admin sans rechargement.

### US-04 — Ajouter une photo
*En tant qu'étudiant, je veux ajouter une photo afin d'illustrer le problème.*

```gherkin
Scénario : photo valide
  Étant donné que je remplis un signalement
  Quand j'ajoute une photo JPG de 3 Mo
  Alors un aperçu s'affiche
  Et après validation, la photo est visible dans le détail du ticket

Scénario : photo refusée
  Quand j'ajoute un fichier PDF ou une image de 12 Mo
  Alors le message « Photo JPG ou PNG de 10 Mo maximum » s'affiche
  Et le ticket peut être envoyé sans photo
```
**Critères d'acceptation**
1. Photo optionnelle, JPG ou PNG uniquement, 10 Mo maximum (vérifié côté front et côté API).
2. Stockage via `FileStorage` : dossier local ou S3 selon la variable d'environnement.
3. La photo n'est servie qu'aux personnes autorisées à voir le ticket (R1), via l'API.

### US-05 — Urgence ressentie
*En tant qu'étudiant, je veux préciser le niveau d'urgence ressenti afin d'aider à la qualification du ticket.*

```gherkin
Scénario : choix de l'urgence
  Quand je choisis l'urgence « Haute » et valide
  Alors le ticket affiche l'urgence « Haute »
  Et sa priorité est « Haute »

Scénario : urgence par défaut
  Quand je ne touche pas au champ urgence
  Alors l'urgence enregistrée est « Normale »
```
**Critères d'acceptation**
1. Trois niveaux : Faible / Normale (défaut) / Haute.
2. L'urgence ressentie est conservée telle quelle ; la priorité en découle (sauf Sécurité → `CRITIQUE`).

### US-08 — Mes signalements
*En tant qu'étudiant, je veux voir la liste de mes signalements avec leur statut afin de savoir où ils en sont.*

```gherkin
Scénario : liste personnelle
  Étant donné qu'Alice a 3 tickets et Bob 2 tickets
  Quand Alice ouvre « Mes signalements »
  Alors elle voit exactement ses 3 tickets, du plus récent au plus ancien
  Et chacun affiche son numéro, son titre, son type, son statut et sa date

Scénario : cloisonnement
  Quand Alice demande l'API d'un ticket de Bob
  Alors l'API répond 404
```
**Critères d'acceptation**
1. Uniquement les tickets de l'étudiant connecté (filtre appliqué par l'API selon le jeton).
2. Statut affiché sous forme de badge coloré et libellé en français.
3. État vide explicite avec un bouton « Signaler un incident ».
4. Réponse de l'API en moins de 2 s.

### US-09 — Historique de traitement
*En tant qu'étudiant, je veux voir l'historique de traitement d'un ticket afin de comprendre les actions réalisées.*

```gherkin
Scénario : timeline
  Étant donné un ticket créé, affecté puis passé « En cours » avec le commentaire « Intervention prévue à 14h »
  Quand j'ouvre le détail du ticket
  Alors je vois 3 événements dans l'ordre chronologique
  Et chaque événement affiche la date et l'heure, l'auteur, son rôle, l'ancien et le nouveau statut et le commentaire
```
**Critères d'acceptation**
1. La page détail affiche les champs du ticket, la photo, l'agent affecté et la timeline des événements.
2. Les événements sont horodatés au fuseau Europe/Paris, du plus ancien au plus récent.
3. Seules les personnes autorisées à voir le ticket voient son historique.

### US-13 — Affecter un ticket à un agent
*En tant qu'administrateur, je veux affecter un ticket à un agent afin de répartir la charge.*

```gherkin
Scénario : affectation
  Étant donné le ticket « SC-0007 » non affecté
  Quand l'admin l'affecte à l'agent « Karim Benali »
  Alors le ticket affiche « Affecté à Karim Benali »
  Et un événement « Affecté à Karim Benali » est ajouté à l'historique
  Et le ticket apparaît dans « Mes tickets » de Karim

Scénario : interdit aux non-admins
  Quand un agent appelle l'API d'affectation
  Alors l'API répond 403
```
**Critères d'acceptation**
1. Liste des agents assignables = utilisateurs de rôle AGENT.
2. Réaffectation possible ; l'ancien agent ne voit plus le ticket (sauf s'il redevient non affecté).
3. L'affectation ne change pas le statut.
4. L'admin dispose d'une liste de tous les tickets filtrable par statut, catégorie, bâtiment et agent.

### US-14 — Changer le statut et commenter
*En tant qu'agent, je veux changer le statut d'un ticket et ajouter un commentaire afin de tenir l'étudiant informé.*

```gherkin
Scénario : passage en cours puis résolu
  Étant donné le ticket « SC-0007 » affecté à Karim au statut « Nouveau »
  Quand Karim le passe « En cours » avec le commentaire « Technicien en route »
  Alors le statut devient « En cours »
  Et l'étudiant voit le commentaire dans l'historique
  Quand Karim le passe « Résolu »
  Alors le statut devient « Résolu »

Scénario : transition interdite
  Quand Karim tente de passer un ticket « Nouveau » directement à « Résolu »
  Alors l'API répond 409 avec le message « Transition non autorisée »

Scénario : prise en charge d'un ticket non affecté
  Étant donné un ticket « Nouveau » non affecté
  Quand Karim clique « Prendre en charge »
  Alors le ticket lui est affecté et passe « En cours »
```
**Critères d'acceptation**
1. Seules les transitions autorisées depuis le statut courant sont proposées et acceptées par l'API.
2. Un agent ne peut modifier qu'un ticket qui lui est affecté (ou le prendre s'il n'est pas affecté) ; sinon 403/404.
3. Le commentaire est facultatif pour `EN_COURS` et `RESOLU`.
4. Deux agents qui prennent le même ticket en même temps : un seul réussit, l'autre reçoit un message (409).
5. L'admin peut effectuer les mêmes actions que l'agent.

### US-28 — Volumes de tickets
*En tant qu'administrateur, je veux voir le nombre de tickets par statut, catégorie et période afin de suivre l'activité du campus.*

```gherkin
Scénario : dashboard après seed
  Étant donné les 60 tickets de démo répartis sur 30 jours
  Quand l'admin ouvre le tableau de bord sur la période « 30 jours »
  Alors il voit le total par statut, un graphique par catégorie et une courbe par jour
  Et la somme des tickets par statut vaut le total de la période
```
**Critères d'acceptation**
1. Sélecteur de période : 7 jours, 30 jours, tout.
2. Compteurs par statut, graphique par catégorie, tendance quotidienne.
3. Les tickets en retard (R4) et les tickets critiques ouverts sont mis en évidence.
4. Réservé au rôle ADMIN (403 sinon).

### US-29 — Indicateurs de performance
*En tant qu'administrateur, je veux consulter le délai moyen de résolution, le taux de résolution et le taux de réouverture afin de mesurer la performance.*

```gherkin
Scénario : calcul des indicateurs
  Étant donné 10 tickets dans la période, dont 6 résolus ou fermés en 12 h en moyenne, et 1 contesté
  Alors le délai moyen de résolution affiché est « 12 h »
  Et le taux de résolution est « 60 % »
  Et le taux de réouverture est « 17 % »
```
**Critères d'acceptation**
1. Délai moyen de résolution = moyenne de (dernière date `RESOLU` − création) sur les tickets résolus ou fermés de la période (choix D6).
2. Taux de résolution = tickets `RESOLU` ou `FERME` / tickets de la période (hors `REJETE`).
3. Taux de réouverture = tickets avec au moins une réouverture / tickets ayant été résolus.
4. Les formules sont des fonctions pures testées unitairement.

### US-30 — Incidents par bâtiment
*En tant qu'administrateur, je veux visualiser les incidents par bâtiment afin d'identifier les zones à problèmes récurrents.*

```gherkin
Scénario : répartition par bâtiment
  Quand l'admin ouvre le tableau de bord
  Alors un graphique affiche le nombre de tickets par bâtiment, trié par ordre décroissant
```
**Critères d'acceptation**
1. Les 5 bâtiments seedés apparaissent, y compris avec 0 ticket.
2. Le graphique respecte la période sélectionnée.

### US-19 — Question à l'assistant
*En tant qu'étudiant, je veux poser une question à l'assistant en langage naturel afin d'obtenir une réponse immédiate.*

```gherkin
Scénario : question couverte par la FAQ
  Étant donné que je suis connecté en tant qu'étudiant
  Quand je demande « le wifi ne marche pas, je fais quoi ? »
  Alors l'assistant répond à partir de la FAQ « Comment me connecter au wifi du campus ? »
  Et la source utilisée est affichée sous la réponse
```
**Critères d'acceptation**
1. L'assistant répond uniquement à partir de la FAQ (20 questions seedées) et des tickets de l'utilisateur connecté.
2. Il n'accède jamais aux tickets d'un autre utilisateur (le contexte est construit côté serveur à partir du jeton).
3. Deux implémentations activables par variable d'environnement : `mock` (mots-clés) et `bedrock` (API Converse, us-east-1).
4. Réponse en moins de 2 s en mode mock.

### US-21 — Ticket pré-rempli quand l'assistant ne sait pas
*En tant qu'étudiant, je veux que l'assistant me propose un ticket pré-rempli quand il ne sait pas répondre.*

```gherkin
Scénario : question hors FAQ nécessitant une intervention
  Quand je demande « la porte de la salle B204 est bloquée »
  Alors l'assistant indique qu'il ne peut pas résoudre ce problème
  Et il propose un ticket pré-rempli : type « Salle », bâtiment B, salle « B204 », description reprenant ma demande
  Quand je clique « Créer ce ticket »
  Alors le formulaire de signalement s'ouvre pré-rempli et modifiable
  Et rien n'est créé tant que je n'ai pas validé
```
**Critères d'acceptation**
1. Une proposition de ticket apparaît quand l'assistant ne trouve pas de réponse ou qu'une intervention est nécessaire.
2. La catégorie (et si possible le bâtiment et la salle) sont déduits de la demande.
3. L'étudiant valide toujours lui-même la création.

### US-26 — Transparence et périmètre de l'IA
*En tant qu'administrateur, je veux que l'assistant affiche qu'il s'agit d'une IA et refuse les sujets hors périmètre.*

```gherkin
Scénario : mention IA
  Quand j'ouvre l'assistant
  Alors le bandeau « Vous échangez avec une IA. Ses réponses peuvent être incomplètes. » est visible

Scénario : sujet hors périmètre
  Quand je demande « écris-moi ma dissertation de philo »
  Alors l'assistant refuse poliment et rappelle qu'il ne traite que les questions sur le campus et vos tickets
  Et aucun ticket n'est proposé
```
**Critères d'acceptation**
1. Mention IA permanente dans l'interface du chat et sur chaque réponse.
2. Refus des sujets hors périmètre (mock : liste de signaux hors campus ; Bedrock : instruction du prompt système).
3. L'assistant n'invente jamais une réponse absente de ses sources.

---

## SHOULD — si le temps le permet

| ID | User story | Critère principal |
|---|---|---|
| US-10 | Notification in-app à chaque changement de statut | cloche + compteur ; inclut la notification « en retard » (R4) |
| US-11 | L'étudiant confirme (→ `FERME`) ou conteste (→ `EN_COURS`, réouvertures +1) la résolution | actions visibles seulement si `RESOLU` |
| US-16 | L'agent modifie la catégorie ou l'urgence | événement d'historique ; Sécurité → `CRITIQUE` |
| US-17 | L'agent rejette un ticket avec motif | motif obligatoire (400 sinon) ; statut `REJETE` |
| US-06 | Avertir si un incident similaire est déjà ouvert | même catégorie + même bâtiment, statut non clos |
| US-20 | L'assistant affiche la source | question FAQ citée (fait dès US-19) |
| US-22 | « Où en est mon ticket ? » via l'assistant | répond avec le statut réel des tickets de l'utilisateur |
| US-23 | Pouce haut / bas sur les réponses | enregistré par message |
| US-25 | L'IA propose catégorie et urgence pour chaque nouveau ticket | suggestion modifiable dans le formulaire |
| US-33 | Charge par agent dans le dashboard | tickets ouverts par agent |

## COULD — documentées, non développées pour la démo
US-02 (attribution des rôles via une page admin ; rôles seedés en attendant) · US-07 (brouillon) · US-12 (notation) · US-15 (notes internes) · fusion de doublons (US-17) · US-18 (délais cibles par catégorie au-delà de 24 h) · US-24 (gestion de la FAQ par l'admin) · US-31 (évolution semaine / mois / année) · US-32 (statistiques de l'assistant) · US-34 (filtres avancés + export CSV) · US-37 (journal des actions sensibles) · US-38 (français / anglais).

## WON'T (pour l'instant)
Vrai SSO école · notifications email · export PDF · suppression automatisée des données sur demande (US-35 : procédure manuelle documentée) · audit RGAA complet.

## Exigences non fonctionnelles
| ID | Exigence | Vérification |
|---|---|---|
| NFR-1 | Responsive mobile et ordinateur ; labels, contrastes AA, navigation clavier | test manuel 360 px + clavier |
| NFR-2 | Réponse API < 2 s | log de durée par requête |
| NFR-3 | RBAC côté serveur | tests 401/403/404 par rôle |
| NFR-4 | HTTPS | Traefik + Let's Encrypt en production |
| NFR-5 | Chiffrement au repos RDS et S3 | options activées, décrites dans `DEPLOY.md` |
| NFR-6 | Aucun secret dans le dépôt | `.env` ignoré, variables d'environnement sur EC2 |
