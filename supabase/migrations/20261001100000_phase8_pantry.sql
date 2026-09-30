/*
  # Anti-gaspi avancé (phase 8)

  1. Lots (`ingredients`) :
     - `location` : frigo (`fridge`), congélateur (`freezer`) ou placard (`pantry`) ;
     - `date_kind` : « à consommer jusqu'au » (`use_by`, stricte) ou « de préférence avant » (`best_before`,
       indicative) ;
     - `opened_at` : date d'ouverture (« Je l'ai ouvert ») ;
     - `frozen_at` : date de congélation (lot au congélateur), `thawed_at` : date de décongélation.
     Colonnes facultatives : un lot rétabli par l'annulation d'une action d'avant cette migration n'en a pas.
     Valeurs par défaut selon l'aliment : `default_location` et `default_date_kind`, mêmes règles que l'app
     (`lib/storage.ts`), appliquées par `add_pantry_items` quand l'app ne les donne pas, et aux lots existants
     (après sauvegarde).
  2. Compteur : un lot n'est compté « gaspillé » que si sa date stricte (« à consommer jusqu'au ») est passée
     et qu'il n'est pas au congélateur.
  3. Résumé quotidien : interrupteur et heure par utilisateur (`profiles.digest_enabled`,
     `profiles.digest_hour`) ; seuls les lots à date stricte hors congélateur y figurent.
  4. « J'ai cuisiné ça » :
     - recette liée à l'action (`pantry_actions.recipe_id`), quantités saisies (`inputs`) pour rouvrir la
       feuille ;
     - date du dernier repas sur la recette (`recipes.last_cooked_at`), rétablie par l'annulation ;
     - `modify_cook_action` : correction en une seule opération (annulation de l'action précédente, mêmes
       règles, conflit compris, puis nouvelle action) ;
     - `last_cook_action(p_recipe_id)` : ma dernière action encore modifiable pour une recette (avant et
       après de chaque lot, pour le récapitulatif).

  Ajouts, et remplissage de `location` et `date_kind` des lots existants selon leur catégorie.
*/

-- 1. Lots : emplacement, type de date, ouverture, congélation

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS date_kind text,
  ADD COLUMN IF NOT EXISTS opened_at date,
  ADD COLUMN IF NOT EXISTS frozen_at date,
  ADD COLUMN IF NOT EXISTS thawed_at date;
ALTER TABLE ingredients
  ADD CONSTRAINT ingredients_location_check CHECK (location IS NULL OR location IN ('fridge', 'freezer', 'pantry')),
  ADD CONSTRAINT ingredients_date_kind_check CHECK (date_kind IS NULL OR date_kind IN ('use_by', 'best_before'));

-- Emplacement proposé : congelés au congélateur ; frais au frigo, sauf ce qui se garde hors du frigo
-- (tomates, pommes de terre, oignons, bananes, agrumes…) ; épicerie au placard ; restes au frigo
CREATE OR REPLACE FUNCTION public.default_location(p_category text, p_kind text, p_food_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_kind = 'dish' THEN 'fridge'
    WHEN p_category = 'frozen' THEN 'freezer'
    WHEN p_food_key IN ('strawberry', 'raspberry', 'blueberry', 'blackberry', 'cherry', 'grape', 'fig') THEN 'fridge'
    WHEN p_food_key IN ('tomato', 'cherry_tomato', 'potato', 'sweet_potato', 'onion', 'red_onion', 'shallot', 'garlic',
                        'banana', 'plantain', 'avocado', 'cassava', 'yam', 'pumpkin', 'squash', 'butternut', 'ginger',
                        'lemon', 'lime', 'orange', 'mandarin', 'grapefruit', 'apple', 'pear', 'mango', 'pineapple',
                        'melon', 'watermelon', 'bread', 'sandwich_bread', 'baguette') THEN 'pantry'
    WHEN p_category IN ('dairy', 'meat', 'fish', 'vegetable') THEN 'fridge'
    WHEN p_category = 'fruit' THEN 'pantry'
    WHEN p_category IN ('egg', 'grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack') THEN 'pantry'
    ELSE 'fridge'
  END;
$$;

-- Type de date proposé : indicative pour l'épicerie, les œufs et les surgelés ; stricte pour le frais et les
-- restes
CREATE OR REPLACE FUNCTION public.default_date_kind(p_category text, p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_kind = 'dish' THEN 'use_by'
    WHEN p_category IN ('grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack', 'egg', 'frozen') THEN 'best_before'
    ELSE 'use_by'
  END;
$$;

-- Lots existants : emplacement et type de date selon l'aliment (la date et la quantité ne changent pas ;
-- l'historique n'enregistre pas ce changement)
UPDATE ingredients
SET location = public.default_location(category, kind, food_key),
    date_kind = public.default_date_kind(category, kind)
WHERE location IS NULL OR date_kind IS NULL;

-- Ajout depuis le scan ou la saisie : emplacement et type de date donnés par l'app, sinon par défaut
CREATE OR REPLACE FUNCTION public.add_pantry_items(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
  v_category text;
  v_kind text;
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
      v_category := nullif(v_item->>'category', '');
      v_kind := coalesce(nullif(v_item->>'kind', ''), 'ingredient');
      INSERT INTO public.ingredients (user_id, name, quantity, category, kind, storage_tip, food_key, barcode, expires_at, added_via,
                                      product_name, generic_name, brand, nova_group, nutriscore_grade, off_categories,
                                      location, date_kind, frozen_at)
      VALUES (auth.uid(), left(btrim(v_item->>'name'), 120), left(btrim(coalesce(v_item->>'quantity', '')), 40),
              v_category, v_kind,
              nullif(v_item->>'storage_tip', ''), nullif(v_item->>'food_key', ''), nullif(v_item->>'barcode', ''),
              (v_item->>'expires_at')::date, coalesce(nullif(v_item->>'added_via', ''), 'manual'),
              left(nullif(btrim(v_item->>'product_name'), ''), 120), left(nullif(btrim(v_item->>'generic_name'), ''), 120),
              left(nullif(btrim(v_item->>'brand'), ''), 80),
              (v_item->>'nova_group')::smallint, nullif(v_item->>'nutriscore_grade', ''),
              CASE WHEN jsonb_typeof(v_item->'off_categories') = 'array'
                   THEN (SELECT array_agg(value) FROM (SELECT value FROM jsonb_array_elements_text(v_item->'off_categories') LIMIT 60) AS c)
                   END,
              coalesce(nullif(v_item->>'location', ''), public.default_location(v_category, v_kind, nullif(v_item->>'food_key', ''))),
              coalesce(nullif(v_item->>'date_kind', ''), public.default_date_kind(v_category, v_kind)),
              CASE WHEN coalesce(nullif(v_item->>'location', ''), public.default_location(v_category, v_kind, nullif(v_item->>'food_key', ''))) = 'freezer'
                   THEN current_date END);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.pantry_reason', '', true);
  PERFORM set_config('app.pantry_added', '', true);
  RETURN v_count;
END;
$$;

-- 2. Compteur : « gaspillé » seulement pour une date stricte passée, hors congélateur

CREATE OR REPLACE FUNCTION public.log_food_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
BEGIN
  -- Foyer en cours de suppression (compte supprimé, dernier membre parti) : rien à compter
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = OLD.household_id) THEN
    RETURN NULL;
  END IF;
  IF current_setting('app.pantry_reason', true) = 'merge' THEN
    RETURN NULL;
  END IF;
  IF current_setting('app.food_event', true) = 'saved' THEN
    v_kind := 'saved';
  ELSIF OLD.expires_at IS NOT NULL AND OLD.expires_at < (now() AT TIME ZONE 'utc')::date
        AND coalesce(OLD.date_kind, 'use_by') = 'use_by'
        AND OLD.location IS DISTINCT FROM 'freezer' THEN
    v_kind := 'wasted';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.food_events (household_id, user_id, kind, ingredient_name, expires_at, ingredient_id)
  VALUES (OLD.household_id, auth.uid(), v_kind, left(OLD.name, 120), OLD.expires_at, OLD.id);
  RETURN NULL;
END;
$$;

-- 3. Résumé quotidien : interrupteur et heure par utilisateur, lots à date stricte hors congélateur

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_hour smallint NOT NULL DEFAULT 9;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_digest_hour_check CHECK (digest_hour BETWEEN 5 AND 22);

CREATE OR REPLACE FUNCTION public.claim_daily_digests(p_hour integer DEFAULT 9, p_only_user uuid DEFAULT NULL, p_force boolean DEFAULT false)
RETURNS TABLE (
  user_id uuid,
  local_date date,
  language text,
  tokens text[],
  today jsonb,
  tomorrow jsonb,
  pantry_size integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH devices AS (
    -- Fuseau et langue de l'appareil utilisé le plus récemment
    SELECT DISTINCT ON (t.user_id) t.user_id, t.timezone, t.language
    FROM public.push_tokens t
    WHERE p_only_user IS NULL OR t.user_id = p_only_user
    ORDER BY t.user_id, t.updated_at DESC
  ),
  due AS (
    -- Heure choisie par l'utilisateur (sinon p_hour), rattrapage pendant 2 heures ; résumé désactivé : rien
    SELECT d.user_id, (now() AT TIME ZONE d.timezone)::date AS local_date, d.language,
           public.active_household_of(d.user_id) AS household_id
    FROM devices d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    WHERE coalesce(p.digest_enabled, true)
      AND (p_force
           OR extract(hour FROM now() AT TIME ZONE d.timezone) BETWEEN coalesce(p.digest_hour, p_hour) AND coalesce(p.digest_hour, p_hour) + 2)
  ),
  contents AS (
    SELECT due.*,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                FROM public.ingredients i WHERE i.household_id = due.household_id AND i.expires_at = due.local_date
                  AND coalesce(i.date_kind, 'use_by') = 'use_by' AND i.location IS DISTINCT FROM 'freezer'), '[]') AS today,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                FROM public.ingredients i WHERE i.household_id = due.household_id AND i.expires_at = due.local_date + 1
                  AND coalesce(i.date_kind, 'use_by') = 'use_by' AND i.location IS DISTINCT FROM 'freezer'), '[]') AS tomorrow,
      (SELECT count(*)::integer FROM public.ingredients i WHERE i.household_id = due.household_id) AS pantry_size
    FROM due
  ),
  claimed AS (
    INSERT INTO public.daily_digests AS dd (user_id, local_date, status, items_count)
    SELECT c.user_id, c.local_date,
           CASE WHEN jsonb_array_length(c.today) + jsonb_array_length(c.tomorrow) = 0 THEN 'nothing' ELSE 'sending' END,
           jsonb_array_length(c.today) + jsonb_array_length(c.tomorrow)
    FROM contents c
    ON CONFLICT ON CONSTRAINT daily_digests_pkey DO NOTHING
    RETURNING dd.user_id, dd.local_date, dd.status
  )
  SELECT c.user_id, c.local_date, c.language,
         ARRAY(SELECT t.token FROM public.push_tokens t WHERE t.user_id = c.user_id ORDER BY t.token),
         c.today, c.tomorrow, c.pantry_size
  FROM contents c
  JOIN claimed cl ON cl.user_id = c.user_id AND cl.local_date = c.local_date
  WHERE cl.status = 'sending';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_digests(integer, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_digests(integer, uuid, boolean) TO service_role;

-- 4. « J'ai cuisiné ça » : recette liée, correction

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS last_cooked_at timestamptz;
ALTER TABLE pantry_actions
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  -- Date du dernier repas de la recette avant l'action (rétablie par l'annulation)
  ADD COLUMN IF NOT EXISTS recipe_prev_cooked_at timestamptz,
  -- Quantités saisies dans la feuille (rouverte par « Modifier ») ; format propre à l'app
  ADD COLUMN IF NOT EXISTS inputs jsonb,
  -- Correction : action qui remplace celle-ci
  ADD COLUMN IF NOT EXISTS replaced_by uuid;
ALTER TABLE pantry_actions
  ADD CONSTRAINT pantry_actions_inputs_size CHECK (inputs IS NULL OR pg_column_size(inputs) <= 20000);
CREATE INDEX IF NOT EXISTS idx_pantry_actions_recipe ON pantry_actions(recipe_id, created_at) WHERE recipe_id IS NOT NULL;

-- Appels à deux paramètres (versions précédentes de l'app) : la nouvelle fonction les accepte
DROP FUNCTION IF EXISTS public.cook_with_undo(uuid[], jsonb);

-- Lots finis (p_ids) retirés et comptés « sauvés », lots entamés (p_leftovers : [{ "id", "quantity" }])
-- mis à jour. Recette (p_recipe_id, la mienne) : date du repas enregistrée, rétablie par l'annulation.
CREATE OR REPLACE FUNCTION public.cook_with_undo(p_ids uuid[], p_leftovers jsonb DEFAULT '[]'::jsonb,
                                                 p_recipe_id uuid DEFAULT NULL, p_inputs jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[] := coalesce(p_ids, '{}');
  v_household uuid;
  v_removed jsonb;
  v_updated jsonb := '[]'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_item jsonb;
  v_action uuid;
  v_recipe uuid;
  v_prev timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  -- Foyer des lots concernés (un seul), dont l'utilisateur est membre
  SELECT i.household_id INTO v_household
  FROM public.ingredients i
  WHERE (i.id = ANY(v_ids) OR i.id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(coalesce(p_leftovers, '[]'::jsonb)) AS item))
    AND public.is_household_member(i.household_id)
  LIMIT 1;
  IF v_household IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  v_action := public.begin_pantry_action('cook');

  -- Lots entamés : quantité mise à jour (avant / après gardés pour l'annulation)
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_leftovers, '[]'::jsonb)) LOOP
    SELECT to_jsonb(i.*) INTO v_before FROM public.ingredients i
    WHERE i.id = (v_item->>'id')::uuid AND i.household_id = v_household AND NOT (i.id = ANY(v_ids))
    FOR UPDATE;
    CONTINUE WHEN v_before IS NULL;
    UPDATE public.ingredients i SET quantity = left(btrim(v_item->>'quantity'), 40)
    WHERE i.id = (v_item->>'id')::uuid
    RETURNING to_jsonb(i.*) INTO v_after;
    v_updated := v_updated || jsonb_build_array(jsonb_build_object('before', v_before, 'after', v_after));
  END LOOP;

  -- Lots finis : retirés et comptés « sauvés », chacun
  PERFORM set_config('app.food_event', 'saved', true);
  WITH gone AS (
    DELETE FROM public.ingredients i WHERE i.id = ANY(v_ids) AND i.household_id = v_household
    RETURNING to_jsonb(i.*) AS row
  )
  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_removed FROM gone;

  -- Recette : la mienne seulement
  IF p_recipe_id IS NOT NULL THEN
    SELECT r.id, r.last_cooked_at INTO v_recipe, v_prev FROM public.recipes r
    WHERE r.id = p_recipe_id AND r.user_id = auth.uid()
    FOR UPDATE;
    IF v_recipe IS NOT NULL THEN
      UPDATE public.recipes SET last_cooked_at = now() WHERE id = v_recipe;
    END IF;
  END IF;

  PERFORM public.record_pantry_action(v_action, v_household, 'cook', v_removed, v_updated);
  UPDATE public.pantry_actions
  SET recipe_id = v_recipe, recipe_prev_cooked_at = v_prev,
      inputs = CASE WHEN jsonb_typeof(p_inputs) IN ('object', 'array') THEN p_inputs END
  WHERE id = v_action;
  RETURN v_action;
END;
$$;

-- Annulation : mêmes règles qu'avant ; « J'ai cuisiné ça » d'une recette : date du repas d'avant rétablie
-- (sauf si la recette a été cuisinée de nouveau depuis)
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
    -- Recette : date du repas d'avant, si elle n'a pas été cuisinée de nouveau depuis
    IF v_action.kind = 'cook' AND v_action.recipe_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pantry_actions a
      WHERE a.recipe_id = v_action.recipe_id AND a.kind = 'cook' AND a.undone_at IS NULL
        AND a.id <> v_action.id AND a.created_at > v_action.created_at
    ) THEN
      UPDATE public.recipes SET last_cooked_at = v_action.recipe_prev_cooked_at WHERE id = v_action.recipe_id;
    END IF;
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

-- Correction de « J'ai cuisiné ça » : l'action précédente est annulée (mêmes règles : auteur, 24 heures,
-- une seule fois, conflit si un autre membre a changé un lot entre-temps), puis la nouvelle est enregistrée,
-- en une seule opération : si l'une échoue, rien ne change. La recette garde la date du premier repas.
-- Nouvelles quantités vides (rien d'utilisé) : l'action est seulement annulée.
-- Réponse : { "status": "modified", "action_id" } ; { "status": "undone" } ; sinon la raison du refus.
CREATE OR REPLACE FUNCTION public.modify_cook_action(p_action_id uuid, p_ids uuid[], p_leftovers jsonb DEFAULT '[]'::jsonb,
                                                     p_inputs jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action public.pantry_actions;
  v_result text;
  v_new uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_action FROM public.pantry_actions WHERE id = p_action_id AND kind = 'cook';
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'not_found'); END IF;

  v_result := public.undo_pantry_action(p_action_id);
  IF v_result <> 'undone' THEN RETURN jsonb_build_object('status', v_result); END IF;

  IF cardinality(coalesce(p_ids, '{}')) = 0 AND jsonb_array_length(coalesce(p_leftovers, '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object('status', 'undone');
  END IF;

  v_new := public.cook_with_undo(p_ids, p_leftovers, v_action.recipe_id, p_inputs);
  -- La recette garde la date du premier repas ; l'annulation de la correction rétablit celle d'avant
  IF v_action.recipe_id IS NOT NULL THEN
    UPDATE public.recipes SET last_cooked_at = v_action.created_at WHERE id = v_action.recipe_id AND user_id = auth.uid();
    UPDATE public.pantry_actions SET recipe_prev_cooked_at = v_action.recipe_prev_cooked_at WHERE id = v_new;
  END IF;
  UPDATE public.pantry_actions SET replaced_by = v_new WHERE id = p_action_id;
  RETURN jsonb_build_object('status', 'modified', 'action_id', v_new);
END;
$$;

-- Ma dernière action « J'ai cuisiné ça » encore modifiable pour une recette (24 heures, pas annulée) : lots
-- retirés et lots entamés (avant / après) pour le récapitulatif, quantités saisies pour « Modifier »
CREATE OR REPLACE FUNCTION public.last_cook_action(p_recipe_id uuid)
RETURNS TABLE (id uuid, created_at timestamptz, removed jsonb, updated jsonb, inputs jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id, a.created_at, a.removed, a.updated, a.inputs
  FROM public.pantry_actions a
  WHERE a.recipe_id = p_recipe_id
    AND a.kind = 'cook'
    AND a.user_id = auth.uid()
    AND public.is_household_member(a.household_id)
    AND a.undone_at IS NULL
    AND a.created_at >= now() - interval '24 hours'
  ORDER BY a.created_at DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.modify_cook_action(uuid, uuid[], jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.last_cook_action(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.default_location(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.default_date_kind(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_cook_action(uuid, uuid[], jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.last_cook_action(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_location(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_date_kind(text, text) TO authenticated;
