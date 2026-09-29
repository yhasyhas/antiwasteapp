/*
  # Nom générique des produits scannés (phase 7b)

  `ingredients.generic_name` : nom générique d'Open Food Facts (« Biscuits feuilletés » pour « Palmito
  L'original »), affiché sous le nom du produit et envoyé au modèle pour les recettes. Vide pour les autres
  aliments. `add_pantry_items` l'enregistre.

  Ajout uniquement : nouvelle colonne vide.
*/

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS generic_name text;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_generic_name_length CHECK (generic_name IS NULL OR char_length(generic_name) <= 120);

CREATE OR REPLACE FUNCTION public.add_pantry_items(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    IF nullif(v_item->>'merge_into', '') IS NOT NULL THEN
      PERFORM set_config('app.pantry_reason', 'add', true);
      PERFORM set_config('app.pantry_added', coalesce(v_item->>'quantity', ''), true);
      UPDATE public.ingredients i
      SET quantity = left(btrim(v_item->>'merged_quantity'), 40),
          expires_at = CASE
            WHEN i.expires_at IS NULL THEN (v_item->>'expires_at')::date
            WHEN v_item->>'expires_at' IS NULL THEN i.expires_at
            ELSE least(i.expires_at, (v_item->>'expires_at')::date) END
      WHERE i.id = (v_item->>'merge_into')::uuid
        AND i.quantity IS NOT DISTINCT FROM (v_item->>'expected_quantity');
      IF NOT FOUND THEN RAISE EXCEPTION 'pantry_conflict' USING ERRCODE = 'P0001'; END IF;
    ELSE
      PERFORM set_config('app.pantry_reason', '', true);
      INSERT INTO public.ingredients (user_id, name, quantity, category, kind, storage_tip, food_key, barcode, expires_at, added_via,
                                      product_name, generic_name, brand, nova_group, nutriscore_grade, off_categories)
      VALUES (auth.uid(), left(btrim(v_item->>'name'), 120), left(btrim(coalesce(v_item->>'quantity', '')), 40),
              nullif(v_item->>'category', ''), coalesce(nullif(v_item->>'kind', ''), 'ingredient'),
              nullif(v_item->>'storage_tip', ''), nullif(v_item->>'food_key', ''), nullif(v_item->>'barcode', ''),
              (v_item->>'expires_at')::date, coalesce(nullif(v_item->>'added_via', ''), 'manual'),
              left(nullif(btrim(v_item->>'product_name'), ''), 120), left(nullif(btrim(v_item->>'generic_name'), ''), 120),
              left(nullif(btrim(v_item->>'brand'), ''), 80),
              (v_item->>'nova_group')::smallint, nullif(v_item->>'nutriscore_grade', ''),
              CASE WHEN jsonb_typeof(v_item->'off_categories') = 'array'
                   THEN (SELECT array_agg(value) FROM (SELECT value FROM jsonb_array_elements_text(v_item->'off_categories') LIMIT 60) AS c)
                   END);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.pantry_reason', '', true);
  PERFORM set_config('app.pantry_added', '', true);
  RETURN v_count;
END;
$$;
