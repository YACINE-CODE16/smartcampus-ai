---
inclusion: always
---

# Vision produit — SmartCampus AI

> **SmartCampus AI permet aux étudiants de signaler et suivre un incident en moins de 2 minutes, et donne à l'administration une vision en temps réel de l'état du campus pour résoudre plus vite.**

## Problème
Les incidents du campus sont dispersés (mails, oral, papier). L'étudiant n'a aucun suivi, l'administration aucune visibilité.

## Contexte
Workshop Capgemini × ESIEA (1,5 jour). Réalisation le vendredi 23/10 de 10h40 à 14h30, démo juste après : **MVP testable, démontrable, déployé sur AWS**. Priorité absolue aux user stories Must (voir `requirements.md`).

## Cibles
- **Étudiants** : signalent, suivent, posent des questions à l'assistant.
- **Agents techniques** : traitent les tickets.
- **Administration** : assigne, pilote par la donnée, gère la configuration.

## Valeur
Gain de temps, transparence, pilotage par la donnée.

## KPIs du dashboard (US-27/29/30)
- Tickets par statut, par catégorie, par période et par bâtiment.
- Délai moyen de résolution, taux de résolution, taux de réouverture.
- Tickets critiques ouverts (Sécurité) et tickets en retard (> 24 h sans prise en charge).

## Principes produit
- Mobile-first : un signalement en < 2 min depuis un téléphone, 3 champs obligatoires maximum.
- Interface 100 % en français, ton simple et direct.
- Transparence : l'étudiant voit toujours où en est sa demande et qui a fait quoi.
- L'IA n'invente jamais : si elle ne sait pas, elle le dit et propose un signalement pré-rempli.
- Ordre de construction : signalement + suivi → pilotage → assistant IA.

## Périmètre
Défini par les user stories de la BA : Must = MVP de la démo, Should si le temps le permet, Could documentées, Won't (vrai SSO, emails, export PDF, RGAA complet).
