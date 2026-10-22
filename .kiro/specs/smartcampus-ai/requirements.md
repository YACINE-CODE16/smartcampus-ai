# Exigences — SmartCampus AI

> Version provisoire déduite du brief PO, en attendant les user stories officielles du Business Analyst.
> Quand elles arriveront : comparer à ce document, lister les écarts, proposer les modifications **avant** de toucher au code.

## Introduction
SmartCampus AI permet aux étudiants de signaler et suivre un incident en moins de 2 minutes, et donne à l'administration une vision en temps réel de l'état du campus. Trois personas : Étudiant (`STUDENT`), Technicien (`TECHNICIAN`), Administrateur (`ADMIN`).

Les critères d'acceptation suivent le format EARS : *QUAND / SI / PENDANT que <condition>, ALORS le système DOIT <comportement>*.

Priorité MoSCoW indiquée par exigence : **[M]** Must, **[S]** Should, **[C]** Could.

> **Version locale (phases 0 à 8).** Les services AWS cités ci-dessous (Cognito, S3, SES, Bedrock, AppSync, Amplify Hosting) désignent la cible de la phase 9. D'ici là, chaque exigence est satisfaite par l'adapter local équivalent (voir `design.md` §2) : comptes et JWT locaux, stockage disque, boîte d'envoi locale, assistant mock, SSE. Les exigences 26.x (déploiement) relèvent de la phase 9.

---

## Épopée 0 — Accès et rôles

### Exigence 1 — Inscription et connexion [M]
**User story :** En tant qu'utilisateur du campus, je veux créer un compte avec mon email école et me connecter, afin d'accéder à l'espace correspondant à mon rôle.

**Critères d'acceptation**
1. QUAND un visiteur s'inscrit avec un email et un mot de passe, ALORS le système DOIT envoyer un code de vérification par email et activer le compte après saisie du code.
2. QUAND un compte est confirmé, ALORS le système DOIT l'ajouter automatiquement au groupe `STUDENT`.
3. Le système DOIT demander uniquement : nom, email, mot de passe (aucune autre donnée personnelle).
4. QUAND un utilisateur se connecte, ALORS le système DOIT le rediriger vers son espace selon la priorité `ADMIN > TECHNICIAN > STUDENT`.
5. SI un utilisateur tente d'ouvrir une page d'un autre espace, ALORS le système DOIT le rediriger vers son propre espace.
6. Les écrans d'authentification DOIVENT être en français.

### Exigence 2 — Attribution des rôles [M]
**User story :** En tant qu'administrateur, je veux attribuer le rôle Technicien ou Admin à un utilisateur, afin que l'équipe accède aux bons outils.

**Critères d'acceptation**
1. Le système DOIT fournir une commande documentée (`npm run set-role -- <email> <ROLE>`) qui ajoute un utilisateur à un groupe.
2. QUAND un rôle est attribué, ALORS l'utilisateur DOIT accéder au nouvel espace à sa prochaine connexion.
3. Seul un administrateur (ou un opérateur disposant des droits AWS) DOIT pouvoir attribuer un rôle.

---

## Épopée 1 — Signaler et suivre (Étudiant)

### Exigence 3 — Signaler un incident [M]
**User story :** En tant qu'étudiant, je veux signaler un incident depuis mon téléphone en moins de 2 minutes, afin qu'il soit pris en charge rapidement.

**Critères d'acceptation**
1. Le formulaire DOIT comporter au plus 3 champs obligatoires : catégorie, lieu (bâtiment + salle), description.
2. Le formulaire DOIT proposer en option : urgence (défaut `NORMALE`), photo, titre.
3. SI le titre est vide, ALORS le système DOIT le générer : « <Catégorie> – <Bâtiment> <Salle> ».
4. La liste des catégories DOIT provenir de la configuration (catégories actives uniquement).
5. QUAND l'étudiant valide un formulaire complet, ALORS le système DOIT créer l'incident au statut `OUVERT`, enregistrer un événement d'historique initial et afficher une confirmation avec un **numéro de suivi**.
6. SI un champ obligatoire manque, ALORS le système DOIT afficher un message d'erreur clair à côté du champ, sans perdre la saisie.
7. Le formulaire DOIT être utilisable sur un écran de 360 px de large sans défilement horizontal.

### Exigence 4 — Photo et mention RGPD [M]
**User story :** En tant qu'étudiant, je veux joindre une photo, afin de montrer le problème au technicien.

**Critères d'acceptation**
1. Le système DOIT accepter une photo (JPEG, PNG, HEIC/WebP) depuis l'appareil photo ou la galerie, taille max 10 Mo.
2. La photo DOIT être stockée dans S3 sous un chemin propre à l'utilisateur ; seuls le propriétaire, le technicien concerné et l'admin DOIVENT pouvoir la consulter.
3. Le formulaire DOIT afficher la mention : « Ne photographiez pas de personnes et n'indiquez pas d'informations personnelles dans la description. »
4. SI l'envoi de la photo échoue, ALORS le système DOIT le signaler et permettre de réessayer ou de continuer sans photo.

### Exigence 5 — Mes signalements [M]
**User story :** En tant qu'étudiant, je veux voir la liste de mes signalements et leur statut, afin de savoir où en sont mes demandes.

**Critères d'acceptation**
1. Le système DOIT lister uniquement les incidents dont l'étudiant est propriétaire, du plus récent au plus ancien.
2. Chaque ligne DOIT afficher : numéro de suivi, titre, catégorie, statut (badge coloré), date de création.
3. QUAND le statut d'un incident change, ALORS la liste DOIT se mettre à jour sans rechargement.

### Exigence 6 — Détail et historique [M]
**User story :** En tant qu'étudiant, je veux voir le détail d'un incident et son historique, afin de comprendre ce qui a été fait.

**Critères d'acceptation**
1. La page détail DOIT afficher tous les champs de l'incident, la photo éventuelle, le technicien assigné (nom) et son commentaire.
2. La page DOIT afficher une timeline chronologique des `IncidentEvent` (date/heure, ancien → nouveau statut, auteur et rôle, commentaire).
3. QUAND un événement est ajouté, ALORS la timeline DOIT se mettre à jour sans rechargement.

### Exigence 7 — Réouverture [M]
**User story :** En tant qu'étudiant, je veux rouvrir un incident marqué résolu s'il ne l'est pas vraiment, afin qu'il soit retraité.

**Critères d'acceptation**
1. PENDANT qu'un incident est `RESOLU`, le système DOIT proposer « Le problème persiste » à son propriétaire.
2. QUAND l'étudiant rouvre (commentaire optionnel), ALORS le statut DOIT passer à `OUVERT`, `resolvedAt` être effacé, le technicien assigné être conservé et un événement être créé.
3. SI l'incident n'est pas `RESOLU`, ALORS la réouverture DOIT être refusée par le serveur.

### Exigence 8 — Note de satisfaction [M]
**User story :** En tant qu'étudiant, je veux noter la résolution de mon incident, afin de donner mon avis sur le service.

**Critères d'acceptation**
1. PENDANT qu'un incident est `RESOLU`, le système DOIT proposer à son propriétaire une note de 1 à 5 et un commentaire optionnel.
2. QUAND l'étudiant envoie sa note, ALORS le système DOIT enregistrer un `Rating`, passer l'incident à `FERME` (`closedAt = now`) et créer un événement.
3. Le système DOIT refuser une seconde note pour le même incident.

---

## Épopée 2 — Traiter et piloter (Technicien, Admin)

### Exigence 9 — File du technicien [M]
**User story :** En tant que technicien, je veux voir la file des incidents non assignés et mes incidents, afin d'organiser mon travail.

**Critères d'acceptation**
1. L'espace technicien DOIT présenter deux onglets : « À prendre » (non assignés, non fermés) et « Mes incidents » (assignés à moi, non fermés).
2. Les incidents DOIVENT être triés par urgence (haute d'abord) puis ancienneté.
3. QUAND le technicien clique « Prendre en charge », ALORS l'incident DOIT lui être assigné, passer à `EN_COURS` et un événement être créé.
4. SI deux techniciens prennent le même incident simultanément, ALORS un seul DOIT réussir ; l'autre DOIT voir un message.
5. Le technicien NE DOIT PAS accéder aux incidents assignés à un autre technicien, au tableau de bord global ni aux conversations IA.

### Exigence 10 — Changement de statut et commentaire [M]
**User story :** En tant que technicien, je veux changer le statut d'un incident et ajouter un commentaire, afin de tenir l'étudiant informé.

**Critères d'acceptation**
1. Le système DOIT proposer uniquement les transitions autorisées depuis le statut courant pour le rôle de l'utilisateur.
2. QUAND le technicien passe un incident à `RESOLU`, ALORS le système DOIT renseigner `resolvedAt` et déclencher la demande de note à l'étudiant.
3. Le technicien et l'admin DOIVENT pouvoir modifier l'urgence d'un incident.
4. Toute transition invalide DOIT être refusée par le serveur avec un message explicite.

### Exigence 11 — Gestion admin des incidents [M]
**User story :** En tant qu'administrateur, je veux voir tous les incidents, les filtrer et les assigner, afin de répartir la charge.

**Critères d'acceptation**
1. L'admin DOIT voir tous les incidents.
2. L'admin DOIT pouvoir filtrer par statut, catégorie, bâtiment, urgence et technicien (combinables).
3. QUAND l'admin assigne un incident à un technicien, ALORS `assignedTo` DOIT être mis à jour et un événement « Assigné à <nom> » être créé.
4. La liste des techniciens assignables DOIT provenir du groupe Cognito `TECHNICIAN`.

### Exigence 12 — Temps réel [M]
**User story :** En tant qu'utilisateur, je veux voir les changements sans recharger la page, afin d'avoir une information à jour.

**Critères d'acceptation**
1. QUAND l'admin assigne, que le technicien change un statut ou que l'étudiant rouvre, ALORS les écrans ouverts des autres personas concernées DOIVENT refléter le changement en moins de 5 secondes sans rechargement.

### Exigence 13 — Fermeture automatique [M]
**User story :** En tant qu'administrateur, je veux que les incidents résolus non notés se ferment seuls, afin que la file reste propre.

**Critères d'acceptation**
1. Une tâche planifiée quotidienne DOIT passer à `FERME` tout incident `RESOLU` depuis plus de 7 jours (délai configurable).
2. Chaque fermeture automatique DOIT créer un événement avec l'auteur « Système ».

### Exigence 14 — Gestion des catégories [M]
**User story :** En tant qu'administrateur, je veux ajouter, renommer et désactiver des catégories, afin d'adapter le formulaire au campus.

**Critères d'acceptation**
1. L'admin DOIT pouvoir créer, renommer et activer/désactiver une catégorie.
2. Une catégorie désactivée NE DOIT PLUS apparaître dans le formulaire mais DOIT rester affichée sur les incidents existants.
3. Les catégories par défaut du brief DOIVENT être créées à l'initialisation.

### Exigence 15 — Tableau de bord KPIs [M]
**User story :** En tant qu'administrateur, je veux un tableau de bord des KPIs, afin de piloter le service.

**Critères d'acceptation**
1. Le tableau de bord DOIT afficher : délai moyen de résolution, taux d'adoption (actifs / inscrits), signalements par semaine, satisfaction moyenne, et (après l'épopée 3) % de questions résolues par l'IA.
2. Le délai moyen de résolution DOIT être calculé sur `resolvedAt - createdAt` des incidents résolus ou fermés de la période.
3. Le tableau de bord DOIT afficher les graphiques : incidents par catégorie, par bâtiment, tendance sur 30 jours, incidents ouverts par urgence.
4. Le tableau de bord DOIT être réservé au groupe `ADMIN`.

### Exigence 16 — Données de démo [M]
**User story :** En tant qu'équipe projet, je veux un jeu de données réaliste, afin de faire une démonstration crédible.

**Critères d'acceptation**
1. Un script DOIT créer 60 incidents fictifs répartis sur 30 jours, avec historiques cohérents et notes.
2. Après exécution, le tableau de bord DOIT afficher des valeurs cohérentes avec les données créées.

---

## Épopée 3 — Assistant IA (Étudiant)

### Exigence 17 — Questions à l'assistant [S]
**User story :** En tant qu'étudiant, je veux poser une question en langage naturel, afin d'obtenir une réponse immédiate sans créer de ticket.

**Critères d'acceptation**
1. L'assistant DOIT répondre en français à partir de la FAQ et des incidents **de l'utilisateur connecté uniquement**.
2. QUAND la question porte sur un signalement de l'utilisateur (« où en est mon signalement ? »), ALORS l'assistant DOIT répondre avec son statut réel.
3. L'assistant NE DOIT JAMAIS inventer d'information ni divulguer les données d'un autre utilisateur.
4. L'interface DOIT indiquer que les réponses peuvent être incomplètes.
5. Le modèle Bedrock DOIT être configurable par variable d'environnement.

### Exigence 18 — Signalement pré-rempli [S]
**User story :** En tant qu'étudiant, quand l'assistant ne sait pas répondre, je veux qu'il me propose un signalement déjà rempli, afin de ne pas tout ressaisir.

**Critères d'acceptation**
1. SI l'assistant ne peut pas répondre à partir de ses sources, ALORS il DOIT le dire clairement et proposer un signalement pré-rempli (catégorie et description déduites).
2. QUAND l'étudiant accepte, ALORS le formulaire de signalement DOIT s'ouvrir pré-rempli et modifiable ; rien n'est créé sans validation de l'étudiant.
3. QUAND le signalement est créé, ALORS la conversation DOIT être marquée `ticketCreated = true` avec l'`incidentId`.

### Exigence 19 — Feedback et KPI IA [S]
**User story :** En tant qu'administrateur, je veux savoir quelle part des questions l'assistant résout seul, afin de mesurer sa valeur.

**Critères d'acceptation**
1. Après chaque réponse, le système DOIT afficher « Ça m'a aidé » et « Créer un signalement ».
2. QUAND l'étudiant clique « Ça m'a aidé », ALORS la conversation DOIT être marquée `helpful = true`.
3. Le tableau de bord DOIT afficher le % de conversations résolues par l'IA (`helpful = true` et `ticketCreated = false`).
4. L'admin NE DOIT voir que des statistiques agrégées, jamais le contenu des conversations.

---

## Notifications

### Exigence 20 — Notifications dans l'application [S]
**User story :** En tant qu'utilisateur, je veux être notifié dans l'application des événements qui me concernent, afin de réagir rapidement.

**Critères d'acceptation**
1. Une cloche DOIT afficher le nombre de notifications non lues, mis à jour en temps réel.
2. Le système DOIT notifier : le technicien quand un incident lui est assigné ; l'étudiant à chaque changement de statut de son incident ; l'étudiant quand une note lui est demandée.
3. QUAND l'utilisateur ouvre une notification, ALORS elle DOIT être marquée lue et mener à l'incident.

### Exigence 21 — Notifications email [S]
**User story :** En tant qu'utilisateur, je veux recevoir un email pour les événements importants, afin d'être informé même hors de l'application.

**Critères d'acceptation**
1. Les mêmes événements que l'exigence 20 DOIVENT déclencher un email via Amazon SES.
2. SI l'envoi échoue (ex. destinataire non vérifié en mode sandbox SES), ALORS l'action métier NE DOIT PAS échouer ; l'erreur DOIT être journalisée.

---

## Transverse

### Exigence 22 — Confidentialité et autorisations [M]
1. Les règles d'accès des personas DOIVENT être appliquées côté API (AppSync / Lambda / S3), pas seulement dans l'interface.
2. L'identité de l'utilisateur DOIT être lue depuis le jeton Cognito côté serveur, jamais depuis un paramètre client.

### Exigence 23 — Conservation et anonymisation [M, mécanisme seulement]
1. Le système DOIT fournir un mécanisme (script ou Lambda invocable manuellement) qui anonymise les incidents `FERME` depuis plus de 12 mois : suppression de la description, de la photo, du commentaire et du lien avec le propriétaire.
2. Les données agrégées (catégorie, bâtiment, dates, note) DOIVENT être conservées pour les statistiques.

### Exigence 24 — Mentions et données personnelles [M]
1. Une page « Mentions et données personnelles » DOIT être accessible depuis toutes les pages (y compris avant connexion) et présenter : données collectées, finalités, durée de conservation, droits, limites de l'IA, contact.

### Exigence 25 — Qualité d'usage [M]
1. L'interface DOIT être en français, responsive et mobile-first (360 px → desktop).
2. Les éléments interactifs DOIVENT être utilisables au clavier et avoir des libellés accessibles.

### Exigence 26 — Déploiement [M]
1. Chaque push sur `main` DOIT déclencher un déploiement Amplify Hosting.
2. Aucun secret NE DOIT être présent dans le dépôt.

---

## Hors périmètre MVP
- **[C] préparé** : suggestion IA d'urgence et de catégorie à partir de la description / photo ; statistiques avancées. Interfaces prévues, non développées sans accord du PO.
- **Won't** : application mobile native ; intégrations GLPI, ServiceNow, Teams.
