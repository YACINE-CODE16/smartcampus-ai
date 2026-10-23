# User stories officielles — SmartCampus AI

Fichier de référence du workshop (ordre et priorités officiels). Le détail (Gherkin, critères, preuves) est dans `.kiro/specs/smartcampus-ai/requirements.md`.

| ID | User story | Priorité |
|---|---|---|
| US-01 | En tant qu'étudiant, je veux me connecter avec mon compte école (SSO) afin d'accéder à la plateforme sans créer de nouveau compte. | Must |
| US-02 | En tant qu'administrateur, je veux attribuer des rôles (étudiant, agent, admin) afin de contrôler l'accès aux fonctionnalités. | Must |
| US-03 | En tant qu'étudiant, je veux signaler un incident (salle fermée, matériel défectueux, problème réseau) afin qu'il soit pris en charge. | Must |
| US-04 | En tant qu'étudiant, je veux ajouter une photo ou un fichier afin d'illustrer le problème. | Should |
| US-05 | En tant qu'étudiant, je veux préciser le niveau d'urgence ressenti afin d'aider à la qualification du ticket. | Should |
| US-06 | En tant qu'étudiant, je veux être averti si un incident similaire existe déjà afin d'éviter les signalements en double. | Could |
| US-07 | En tant qu'étudiant, je veux sauvegarder un signalement non terminé afin de le finir plus tard. | Could |
| US-08 | En tant qu'étudiant, je veux voir la liste de mes signalements avec leur statut afin de savoir où ils en sont. | Must |
| US-09 | En tant qu'étudiant, je veux voir l'historique de traitement d'un ticket afin de comprendre les actions réalisées. | Must |
| US-10 | En tant qu'étudiant, je veux être notifié à chaque changement de statut afin de ne pas consulter la plateforme en permanence. | Should |
| US-11 | En tant qu'étudiant, je veux confirmer ou contester la résolution afin de valider que le problème est réellement réglé. | Should |
| US-12 | En tant qu'étudiant, je veux noter la qualité du traitement afin de donner mon retour à l'école. | Should |
| US-13 | En tant qu'administrateur, je veux affecter un ticket à un agent ou à une équipe afin de répartir la charge. | Must |
| US-14 | En tant qu'agent, je veux changer le statut d'un ticket et ajouter un commentaire afin de tenir l'étudiant informé. | Must |
| US-15 | En tant qu'agent, je veux écrire des notes visibles uniquement en interne afin de partager l'information entre collègues. | Should |
| US-16 | En tant qu'agent, je veux modifier la catégorie ou l'urgence d'un ticket afin de corriger une mauvaise qualification. | Must |
| US-17 | En tant qu'agent, je veux rejeter un ticket (avec motif) ou le fusionner avec un doublon afin de garder un backlog propre. | Should |
| US-18 | En tant qu'administrateur, je veux définir des délais cibles par catégorie et être alerté en cas de dépassement afin de garantir la qualité de service. | Should |
| US-19 | En tant qu'étudiant, je veux poser une question à l'assistant en langage naturel afin d'obtenir une réponse immédiate. | Should |
| US-20 | En tant qu'étudiant, je veux voir la source de la réponse afin de pouvoir lui faire confiance. | Should |
| US-21 | En tant qu'étudiant, je veux que l'assistant me propose de créer un ticket pré-rempli quand il ne sait pas répondre ou que le problème nécessite une intervention. | Should |
| US-22 | En tant qu'étudiant, je veux demander à l'assistant « où en est mon ticket ? » afin d'avoir le statut sans naviguer dans l'application. | Could |
| US-23 | En tant qu'étudiant, je veux indiquer si la réponse était utile (pouce haut/bas) afin d'améliorer l'assistant. | Could |
| US-24 | En tant qu'administrateur, je veux ajouter, modifier et supprimer les questions fréquentes et documents utilisés par l'assistant afin de garder ses réponses à jour. | Should |
| US-25 | En tant qu'agent, je veux que l'IA propose une catégorie et une urgence pour chaque nouveau ticket afin de gagner du temps de tri. | Could |
| US-26 | En tant qu'administrateur, je veux que l'assistant affiche clairement qu'il s'agit d'une IA et qu'il refuse les sujets hors périmètre afin d'éviter les réponses erronées ou inappropriées. | Should |
| US-27 | En tant qu'administrateur, je veux voir le nombre de tickets par statut, catégorie et période afin de suivre l'activité du campus. | Must |
| US-28 | En tant qu'administrateur, je veux consulter le délai moyen de résolution, le taux de résolution et le taux de réouverture afin de mesurer la performance. | Should |
| US-29 | En tant qu'administrateur, je veux visualiser les incidents par bâtiment ou salle afin d'identifier les zones à problèmes récurrents. | Could |
| US-30 | En tant qu'administrateur, je veux voir l'évolution des incidents sur la semaine, le mois et l'année afin de détecter des pics. | Could |
| US-31 | En tant qu'administrateur, je veux suivre le nombre de questions, le taux de résolution sans ticket et la satisfaction afin d'évaluer la valeur de l'IA. | Could |
| US-32 | En tant qu'administrateur, je veux voir la charge par agent ou équipe afin de rééquilibrer l'affectation. | Should |
| US-33 | En tant qu'administrateur, je veux filtrer les tableaux de bord (période, catégorie, lieu) et exporter les données (CSV/PDF) afin de produire des rapports. | Could |
| US-34 | En tant qu'étudiant, je veux que mes données soient protégées et supprimables sur demande. | Must |
| US-35 | En tant qu'utilisateur, je veux utiliser la plateforme sur mobile et ordinateur, avec une interface accessible (RGAA/WCAG). | Must |
| US-36 | En tant qu'utilisateur, je veux des temps de réponse rapides, même en période de forte affluence. | Should |
| US-37 | En tant qu'administrateur, je veux un historique des actions sensibles afin d'assurer la traçabilité. | Should |
| US-38 | En tant qu'étudiant international, je veux utiliser la plateforme et l'assistant en français et en anglais. | Could |
