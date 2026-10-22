---
inclusion: always
---

# Vision produit — SmartCampus AI

> **SmartCampus AI permet aux étudiants de signaler et suivre un incident en moins de 2 minutes, et donne à l'administration une vision en temps réel de l'état du campus pour résoudre plus vite.**

## Problème
Les incidents du campus sont dispersés (mails, oral, papier). L'étudiant n'a aucun suivi, l'administration aucune visibilité.

## Cibles
- **Étudiants** : signalent, suivent, notent, posent des questions à l'assistant.
- **Techniciens / agents de maintenance** : traitent les incidents.
- **Administration** : assigne, pilote par la donnée, gère la configuration.

## Valeur
Gain de temps, transparence, pilotage par la donnée.

## KPIs mesurés dans l'application
| KPI | Définition | Objectif |
|---|---|---|
| Délai moyen de résolution | moyenne de `resolvedAt - createdAt` sur les incidents résolus/fermés | -30 % |
| Taux d'adoption | étudiants actifs (≥ 1 signalement ou conversation sur 30 j) / étudiants inscrits ; signalements par semaine | en hausse |
| % résolu par l'IA | conversations `helpful = true` ET `ticketCreated = false` / conversations ayant reçu un feedback | en hausse |
| Satisfaction | moyenne des notes 1–5 (+ commentaires) | ≥ 4/5 |

## Principes produit
- Mobile-first : un signalement en < 2 min depuis un téléphone, 3 champs obligatoires maximum.
- Interface 100 % en français, ton simple et direct.
- Transparence : l'étudiant voit toujours où en est sa demande et qui a fait quoi.
- L'IA n'invente jamais : si elle ne sait pas, elle le dit et propose un signalement pré-rempli.
- Ordre de construction : signalement + suivi → pilotage → assistant IA.

## Périmètre
- **Must** : auth + rôles, signalement (catégorie, lieu, description, photo), suivi statut + historique, traitement technicien, tableau de bord admin.
- **Should** : assistant IA sur la FAQ, notifications in-app + email.
- **Could** (préparé, non développé sans accord du PO) : suggestion IA d'urgence/catégorie, statistiques avancées.
- **Won't** : app mobile native, intégrations GLPI / ServiceNow / Teams.
