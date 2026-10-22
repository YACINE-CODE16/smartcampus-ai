/**
 * Catégories par défaut, insérées à l'initialisation de la base puis gérées par l'admin.
 * Choix D1 : pas de sous-catégorie, les exemples sont dans `description`.
 */
export interface DefaultCategory {
  slug: string;
  label: string;
  description: string;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { slug: 'salle', label: 'Salle', description: 'Fermée, réservée, inaccessible' },
  { slug: 'materiel', label: 'Matériel', description: 'Vidéoprojecteur, PC, mobilier' },
  { slug: 'reseau', label: 'Réseau', description: 'Wifi, câblé, accès comptes' },
  { slug: 'proprete', label: 'Propreté / sanitaires', description: 'Salissures, sanitaires, déchets' },
  { slug: 'securite', label: 'Sécurité', description: 'Porte, éclairage, danger' },
  { slug: 'autre', label: 'Autre', description: 'Tout autre problème' },
];
