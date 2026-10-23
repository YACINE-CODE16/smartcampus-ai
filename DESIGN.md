# DESIGN.md — SmartCampus AI

Outil de traitement des incidents d'un campus. On s'en sert debout dans un couloir (étudiant, téléphone) ou en file de travail (agent, admin, ordinateur). La direction : **un outil professionnel sobre**, qui emprunte à la signalétique des bâtiments plutôt qu'aux interfaces de chatbot.

> Direction choisie sans exemples réels (UXKIN non connecté) ; à confronter à de vrais outils de ticketing si besoin.

## Principes
1. **Le lieu est l'information n°1.** Un ticket se reconnaît par l'endroit où il faut aller : le lieu s'affiche comme une **plaque de porte** (code bâtiment + salle). C'est le seul élément graphique fort de l'interface.
2. **La couleur signale, elle ne décore pas.** Un seul accent (pétrole) pour les actions ; le jaune sécurité est réservé à la priorité critique, comme sur un panneau ; les statuts sont un point de couleur à côté d'un texte neutre.
3. **Des lignes, pas des cartes.** Les listes sont des tableaux (lignes séparées par des filets) ; les panneaux ont une bordure fine et aucune ombre. Une seule ombre existe, pour ce qui flotte (menus, notifications).
4. **Pas d'emoji, un seul jeu d'icônes** (Lucide, trait 1,75 px, 16–20 px), toujours accompagné d'un texte ou d'un libellé accessible.

## Couleur
Valeurs dans `apps/web/src/index.css` (`:root`, puis `prefers-color-scheme: dark`). Contraste texte ≥ 4,5:1 vérifié dans les deux thèmes.

| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| `--canvas` | `#f3f5f7` | `#12181e` | fond de l'application |
| `--surface` | `#ffffff` | `#1b232c` | panneaux, tableaux, champs |
| `--surface-2` | `#f7f9fa` | `#212b35` | en-têtes de tableau, survol de ligne |
| `--line` | `#dde2e7` | `#2e3a46` | filets, bordures |
| `--line-strong` | `#c3cbd3` | `#41505e` | bordures de champs |
| `--ink` | `#17212b` | `#e5eaef` | texte principal |
| `--ink-2` | `#56616d` | `#9ba8b5` | texte secondaire, métadonnées |
| `--accent` | `#125e7c` | `#5cb3d4` | boutons principaux, liens, focus, onglet actif |
| `--accent-ink` | `#ffffff` | `#0c1a22` | texte sur l'accent |
| `--accent-soft` | `#e3f0f5` | `#17323f` | sélection, élément actif discret |
| `--safety` | `#f5c400` | `#f5c400` | priorité critique, alerte sécurité (texte `#1a1a1a`) |
| `--danger` | `#b42318` | `#f07a6e` | erreurs, rejet, action destructrice |
| `--warning` | `#9a5b00` | `#e3a649` | retard, avertissements |
| `--success` | `#25704a` | `#62c08a` | résolu, confirmations |

Statuts (point 8 px + libellé en `--ink`) : Nouveau = anneau `--accent` · En cours = `--warning` · Résolu = `--success` · Fermé = `--ink-2` · Rejeté = `--danger`.

Graphiques (palette validée par `validate_palette.js`) : série 1 `#1d7fa3` / sombre `#2b8db2`, série 2 `#c56f1f` / sombre `#c97a30`. Barres à une série : série 1. Textes des graphiques en `--ink` / `--ink-2`.

## Typographie
**Atkinson Hyperlegible Next** (variable, 300–800), une seule famille : dessinée pour la lisibilité (malvoyance), elle sert l'accessibilité et donne une voix institutionnelle sans être banale. Chiffres en `tabular-nums` pour les numéros et compteurs.

| Token | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `--fs-xs` | 12 / 16 | 500 | horodatages, aides |
| `--fs-sm` | 14 / 20 | 400–600 | métadonnées, cellules secondaires, badges |
| `--fs-md` | 16 / 24 | 400 | texte courant, champs (jamais moins sur mobile) |
| `--fs-lg` | 18 / 26 | 600 | titres de panneaux |
| `--fs-xl` | 22 / 28 | 700 | titres de page |
| `--fs-2xl` | 28 / 34 | 700 | chiffres clés du tableau de bord |

Pas de capitales pour les étiquettes, pas de mot isolé en couleur dans un titre. Le seul texte en capitales : le code de salle sur la plaque (c'est un code, pas une étiquette).

## Espacement et mise en page
- Échelle 4 px : `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 · `--s7` 48.
- Ordinateur (≥ 960 px) : **barre latérale** de 232 px (logo, navigation du rôle, langue, compte) + zone de contenu, largeur max 1180 px, alignée à gauche.
- Mobile : barre supérieure (logo, cloche, langue) + onglets défilants sous la barre ; gouttières 16 px ; cibles tactiles ≥ 44 px.
- Formulaires : une colonne, 640 px max ; lecture : 72 caractères max.

## Forme et profondeur
- Rayons : `--r-sm` 4 px (champs, boutons, badges) · `--r-md` 8 px (panneaux) · `--r-pill` (puces de filtre, compteurs).
- Ombres : aucune sur les panneaux. `--shadow-pop` uniquement pour les éléments flottants (menu de notifications).

## Composants
- **Plaque de lieu** : bloc `--ink` (sombre) avec code bâtiment en clair + salle ; variante compacte dans les tableaux. Lieux sans code (Bibliothèque) : nom court.
- **Boutons** : principal (fond `--accent`), secondaire (bordure `--line-strong`, fond `--surface`), discret (texte seul), destructif (texte et bordure `--danger`, fond plein seulement pour la confirmation finale). Hauteur 40 px (36 px compact), focus : anneau 2 px `--accent` décalé de 2 px, désactivé : opacité 0,5.
- **Champs** : fond `--surface`, bordure `--line-strong`, focus `--accent`, erreur `--danger` + message sous le champ avec icône.
- **Tableaux** : en-tête `--surface-2` 14 px `--ink-2` ; lignes 52 px, filet `--line`, survol `--surface-2`, toute la ligne cliquable ; sur mobile, chaque ligne s'empile (objet en haut, lieu + statut + âge en dessous).
- **Statut** : point + libellé. **Priorité** : texte seul sauf critique (bande jaune sécurité + icône triangle). **Retard** : icône horloge + « En retard » en `--warning`.
- **Navigation** : élément actif = barre 3 px `--accent` à gauche (latérale) ou dessous (onglets) + texte `--ink` en 600.
- **Assistant** : messages sans bulles colorées : question alignée à droite sur fond `--surface-2`, réponse pleine largeur avec marqueur « IA » et filet d'accent à gauche ; sources en `--fs-sm`.

## Icônes et images
- Lucide (`lucide-react`) uniquement ; 16 px dans le texte, 20 px dans la navigation ; `aria-hidden` quand un libellé est présent.
- Photos d'incident : coins `--r-sm`, bordure `--line`, jamais recadrées dans le détail (ratio conservé).
- Aucune illustration décorative, aucun dégradé.
