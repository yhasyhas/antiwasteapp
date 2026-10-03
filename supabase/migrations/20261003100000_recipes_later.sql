/*
  « Mes recettes » 2.0 : signet « Pour plus tard » sur une recette, indépendant du favori.

  - `recipes.later_at` : date à laquelle l'utilisateur a mis la recette de côté (null : pas de signet).
  - Modifiable par l'utilisateur sur ses propres recettes (politique « Users can update own recipes » existante).
  - Index partiel pour l'onglet « Pour plus tard » (recettes de l'utilisateur avec un signet).
*/

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS later_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_recipes_later ON recipes(user_id, later_at DESC) WHERE later_at IS NOT NULL;
