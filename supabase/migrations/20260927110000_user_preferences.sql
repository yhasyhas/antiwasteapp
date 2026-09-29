/*
  # Préférences de génération (phase 6b)

  Nouvelles colonnes de `user_preferences` (une ligne par utilisateur, déjà protégée par la RLS) :
  - `default_cuisine` : cuisine préférée (mêmes codes que generate-recipes), 'any' par défaut.
  - `servings` : nombre de personnes (1 à 12), NULL si pas de préférence.
  Contraintes sur les colonnes existantes utilisées par l'écran de préférences : 20 aliments exclus au
  plus, temps maximum entre 10 et 240 minutes.

  Ajouts uniquement : les lignes existantes gardent leurs valeurs (default_cuisine = 'any').
*/

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_cuisine text NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS servings integer;

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_cuisine_check
    CHECK (default_cuisine IN ('any', 'african', 'maghreb', 'asian', 'latin', 'mediterranean', 'french')),
  ADD CONSTRAINT user_preferences_servings_check
    CHECK (servings IS NULL OR servings BETWEEN 1 AND 12),
  ADD CONSTRAINT user_preferences_excluded_check
    CHECK (excluded_ingredients IS NULL OR cardinality(excluded_ingredients) <= 20),
  ADD CONSTRAINT user_preferences_max_cook_time_check
    CHECK (max_cook_time IS NULL OR max_cook_time BETWEEN 10 AND 240);
