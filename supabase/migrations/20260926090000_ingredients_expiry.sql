/*
  # Garde-manger anti-gaspi (phase 5)

  Nouvelles colonnes de `ingredients` :
  - `expires_at` : date de péremption (proposée à l'ajout, modifiable) ; NULL si inconnue.
  - `category` : catégorie de l'aliment (mêmes codes que analyze-image) ; NULL pour les anciens ingrédients.
  - `kind` : 'ingredient' (aliment brut ou produit acheté) ou 'dish' (plat cuisiné, reste de repas).
  - `storage_tip` : conseil de conservation court.
  - `barcode` : code-barres du produit (EAN), quand il a été scanné.
  Index sur (household_id, expires_at) : garde-manger trié par urgence, rappels du jour.

  Ajouts uniquement : les ingrédients existants reçoivent kind = 'ingredient', les autres colonnes restent vides.
  Les politiques RLS du garde-manger (par foyer) s'appliquent sans changement aux nouvelles colonnes.
*/

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ingredient',
  ADD COLUMN IF NOT EXISTS storage_tip text,
  ADD COLUMN IF NOT EXISTS barcode text;

ALTER TABLE ingredients
  ADD CONSTRAINT ingredients_kind_check CHECK (kind IN ('ingredient', 'dish')),
  ADD CONSTRAINT ingredients_category_check CHECK (category IS NULL OR category IN (
    'fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume',
    'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other'
  )),
  ADD CONSTRAINT ingredients_storage_tip_length CHECK (storage_tip IS NULL OR char_length(storage_tip) <= 200),
  ADD CONSTRAINT ingredients_barcode_format CHECK (barcode IS NULL OR barcode ~ '^[0-9]{6,14}$');

CREATE INDEX IF NOT EXISTS idx_ingredients_household_expires ON ingredients (household_id, expires_at);
