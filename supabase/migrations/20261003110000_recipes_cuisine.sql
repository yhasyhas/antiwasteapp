/*
  « Mes recettes » 2.0 : cuisine choisie à la génération, enregistrée avec la recette (filtre par cuisine).

  - `recipes.cuisine` : 'any', 'african', 'maghreb', 'asian', 'latin', 'mediterranean', 'french' ; null pour les recettes
    enregistrées avant (cuisine inconnue).
*/

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cuisine text;
