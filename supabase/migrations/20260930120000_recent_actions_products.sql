/*
  # « Récemment retirés » et produits scannés par code-barres (phase 7b)

  1. Produits scannés par code-barres : nouvelles colonnes de `ingredients`, remplies depuis Open Food Facts
     (vides pour les autres aliments) : `product_name` (nom du produit), `brand` (marque), `nova_group`
     (1 à 4, degré de transformation), `nutriscore_grade` (a à e), `off_categories` (catégories Open Food
     Facts). La source de chaque aliment reste dans `added_via` (camera, manual, barcode, shopping).
     `add_pantry_items` les enregistre.
  2. Annulation : « J'ai cuisiné ça » et retraits (lots, aliments, articles de courses) annulables pendant
     24 heures (liste « Récemment retirés »), avec les mêmes règles : tout ou rien, par leur auteur, une seule
     fois, conflit si un autre membre a changé un aliment entre-temps. La fusion de lots reste annulable
     2 minutes. Rétablissement d'un article de courses : conflit si le même article (non coché) a été
     rajouté entre-temps. Auteur ou recette supprimés entre-temps : rétablis sans eux.
  3. `recent_pantry_actions()` : mes actions annulables des dernières 24 heures dans mon foyer actif, avec
     les noms concernés.

  Ajouts uniquement : nouvelles colonnes vides, aucune donnée existante modifiée ici (les produits existants
  sont complétés par un script, après sauvegarde).
*/

-- 1. Produits

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS nova_group smallint,
  ADD COLUMN IF NOT EXISTS nutriscore_grade text,
  ADD COLUMN IF NOT EXISTS off_categories text[];

ALTER TABLE ingredients
  ADD CONSTRAINT ingredients_product_name_length CHECK (product_name IS NULL OR char_length(product_name) <= 120),
  ADD CONSTRAINT ingredients_brand_length CHECK (brand IS NULL OR char_length(brand) <= 80),
  ADD CONSTRAINT ingredients_nova_group_check CHECK (nova_group IS NULL OR nova_group BETWEEN 1 AND 4),
  ADD CONSTRAINT ingredients_nutriscore_check CHECK (nutriscore_grade IS NULL OR nutriscore_grade IN ('a', 'b', 'c', 'd', 'e')),
  ADD CONSTRAINT ingredients_off_categories_size CHECK (off_categories IS NULL OR cardinality(off_categories) <= 60);

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
                                      product_name, brand, nova_group, nutriscore_grade, off_categories)
      VALUES (auth.uid(), left(btrim(v_item->>'name'), 120), left(btrim(coalesce(v_item->>'quantity', '')), 40),
              nullif(v_item->>'category', ''), coalesce(nullif(v_item->>'kind', ''), 'ingredient'),
              nullif(v_item->>'storage_tip', ''), nullif(v_item->>'food_key', ''), nullif(v_item->>'barcode', ''),
              (v_item->>'expires_at')::date, coalesce(nullif(v_item->>'added_via', ''), 'manual'),
              left(nullif(btrim(v_item->>'product_name'), ''), 120), left(nullif(btrim(v_item->>'brand'), ''), 80),
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

-- 2. Annulation pendant 24 heures (fusion : 2 minutes)

CREATE OR REPLACE FUNCTION public.undo_pantry_action(p_action_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action public.pantry_actions;
  v_change jsonb;
  v_current jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_action FROM public.pantry_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND OR v_action.user_id <> auth.uid() OR NOT public.is_household_member(v_action.household_id) THEN
    RETURN 'not_found';
  END IF;
  IF v_action.undone_at IS NOT NULL THEN RETURN 'already_undone'; END IF;
  IF v_action.created_at < now() - (CASE WHEN v_action.kind = 'merge' THEN interval '2 minutes' ELSE interval '24 hours' END) THEN
    RETURN 'expired';
  END IF;

  -- Lot modifié par l'action puis changé ou retiré par quelqu'un d'autre : rien n'est rétabli
  FOR v_change IN SELECT * FROM jsonb_array_elements(v_action.updated) LOOP
    SELECT to_jsonb(i.*) INTO v_current FROM public.ingredients i
    WHERE i.id = (v_change->'after'->>'id')::uuid
    FOR UPDATE;
    IF v_current IS NULL
       OR (v_current->>'name', v_current->>'quantity', v_current->>'expires_at', v_current->>'kind', v_current->>'household_id')
          IS DISTINCT FROM
          (v_change->'after'->>'name', v_change->'after'->>'quantity', v_change->'after'->>'expires_at', v_change->'after'->>'kind', v_change->'after'->>'household_id') THEN
      RETURN 'conflict';
    END IF;
  END LOOP;

  -- Article de courses rajouté entre-temps (même nom, pas encore acheté) : pas de doublon, conflit
  IF v_action.kind = 'delete_shopping' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_action.removed) AS lot
    JOIN public.shopping_items s ON s.household_id = v_action.household_id AND NOT s.checked
      AND lower(btrim(s.name)) = lower(btrim(lot->>'name'))
    WHERE NOT coalesce((lot->>'checked')::boolean, false)
  ) THEN
    RETURN 'conflict';
  END IF;

  PERFORM set_config('app.pantry_reason', 'undo', true);
  IF v_action.kind IN ('cook', 'delete_ingredient', 'merge') THEN
    -- Lots retirés : rétablis tels quels (même identifiant, même date, même auteur s'il existe encore)
    INSERT INTO public.ingredients
    SELECT (jsonb_populate_record(NULL::public.ingredients, lot || jsonb_build_object('user_id',
      CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (lot->>'user_id')::uuid) THEN lot->'user_id' ELSE 'null'::jsonb END))).*
    FROM jsonb_array_elements(v_action.removed) AS lot;
    -- Lots entamés ou fusionnés : quantité d'avant
    UPDATE public.ingredients i SET quantity = change->'before'->>'quantity'
    FROM jsonb_array_elements(v_action.updated) AS change
    WHERE i.id = (change->'before'->>'id')::uuid;
    -- Compteur : événements créés par l'action retirés
    DELETE FROM public.food_events e
    WHERE e.ingredient_id IN (SELECT (lot->>'id')::uuid FROM jsonb_array_elements(v_action.removed) AS lot)
      AND e.created_at >= v_action.created_at;
  ELSE
    -- Auteur, acheteur ou recette supprimés entre-temps : rétabli sans eux
    INSERT INTO public.shopping_items
    SELECT (jsonb_populate_record(NULL::public.shopping_items, lot || jsonb_build_object(
      'added_by', CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (lot->>'added_by')::uuid) THEN lot->'added_by' ELSE 'null'::jsonb END,
      'recipe_id', CASE WHEN EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = (lot->>'recipe_id')::uuid) THEN lot->'recipe_id' ELSE 'null'::jsonb END))).*
    FROM jsonb_array_elements(v_action.removed) AS lot;
    -- Coché par qui et quand : comme avant (l'ajout le remplace par l'utilisateur actuel)
    UPDATE public.shopping_items s
    SET checked_by = CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = r.checked_by) THEN r.checked_by END,
        checked_at = r.checked_at
    FROM jsonb_populate_recordset(NULL::public.shopping_items, v_action.removed) AS r
    WHERE s.id = r.id AND r.checked;
  END IF;
  -- Historique : lignes de l'action retirées
  DELETE FROM public.pantry_history h WHERE h.action_id = v_action.id;

  UPDATE public.pantry_actions SET undone_at = now() WHERE id = v_action.id;
  PERFORM public.end_pantry_action();
  RETURN 'undone';
END;
$$;

-- 3. « Récemment retirés » : mes actions annulables des dernières 24 heures, dans mon foyer actif
CREATE OR REPLACE FUNCTION public.recent_pantry_actions()
RETURNS TABLE (id uuid, kind text, created_at timestamptz, names text[], removed_count integer, updated_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id, a.kind, a.created_at,
    ARRAY(
      SELECT DISTINCT ON (lower(btrim(n))) n FROM (
        SELECT lot->>'name' AS n FROM jsonb_array_elements(a.removed) AS lot
        UNION ALL
        SELECT change->'after'->>'name' FROM jsonb_array_elements(a.updated) AS change
      ) AS all_names
      WHERE n IS NOT NULL
      ORDER BY lower(btrim(n))
    ),
    jsonb_array_length(a.removed), jsonb_array_length(a.updated)
  FROM public.pantry_actions a
  WHERE a.user_id = auth.uid()
    AND a.household_id = public.active_household_of(auth.uid())
    AND a.kind IN ('cook', 'delete_ingredient', 'delete_shopping')
    AND a.undone_at IS NULL
    AND a.created_at >= now() - interval '24 hours'
  ORDER BY a.created_at DESC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.recent_pantry_actions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_pantry_actions() TO authenticated;
