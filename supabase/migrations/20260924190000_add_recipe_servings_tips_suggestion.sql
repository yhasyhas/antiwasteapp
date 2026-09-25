/*
  # Recettes : portions, astuces et suggestion

  Champs renvoyés par generate-recipes mais jusqu'ici perdus à la sauvegarde.

  - `servings` (integer) : nombre de portions. NULL pour les recettes déjà enregistrées (inconnu).
  - `tips` (jsonb) : astuces de la recette, tableau de chaînes. Tableau vide par défaut.
  - `suggestion` (text) : moment où la recette est idéale (ex. « Idéal aussi en petit-déjeuner »). Facultatif.

  Ajout de colonnes uniquement : aucune donnée existante n'est modifiée, et les politiques RLS
  de la table (par utilisateur) s'appliquent déjà à ces colonnes.
*/

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS servings integer,
  ADD COLUMN IF NOT EXISTS tips jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS suggestion text;
