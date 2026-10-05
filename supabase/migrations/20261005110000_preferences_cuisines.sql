/*
  # Cuisine préférée : découpage en familles et régions (phase 9b, docs/cuisines-proposition.md)

  - `user_preferences.default_cuisine` accepte les nouveaux choix : famille (`africa`, `asia`, `americas`,
    `mediterranean`), région (`afrique-ouest`…), `france` et `other` (« Autre cuisine… »). Les anciennes
    valeurs (`african`, `maghreb`, `asian`, `latin`, `mediterranean`, `french`) restent valides : l'app les
    ramène au découpage actuel à la lecture, sans migration de données.
  - `user_preferences.default_cuisine_other` : texte de « Autre cuisine… » (40 caractères au plus), vide sinon.

  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_cuisine_check;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_cuisine_check CHECK (default_cuisine IN (
  'any',
  -- Anciennes valeurs
  'african', 'maghreb', 'asian', 'latin', 'mediterranean', 'french',
  -- Familles, France, « Autre cuisine… »
  'africa', 'asia', 'americas', 'france', 'other',
  -- Régions
  'afrique-ouest', 'afrique-centrale', 'afrique-est', 'afrique-australe', 'ocean-indien',
  'asie-est', 'asie-sud-est', 'asie-sud',
  'mexique-amerique-centrale', 'caraibes', 'amerique-sud',
  'europe-sud', 'levant-turquie'
));

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_cuisine_other text
  CONSTRAINT user_preferences_cuisine_other_check CHECK (default_cuisine_other IS NULL OR char_length(default_cuisine_other) BETWEEN 1 AND 40);
