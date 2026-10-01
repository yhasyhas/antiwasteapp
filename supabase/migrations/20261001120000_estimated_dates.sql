/*
  # Dates estimées et dates indicatives proches (phase 8)

  1. Origine de la date d'un lot : `expiry_estimated` vrai quand la date vient d'une estimation de l'app (scan
     photo, valeur proposée par défaut, congélation, décongélation, ouverture), faux quand elle vient de
     l'emballage (saisie ou modification par l'utilisateur). Gardée par add_pantry_items (y compris l'ajout à
     un lot existant : origine de la date retenue), stock_shopping_items et merge_lots (rétablie par
     undo_pantry_action) ; un lot rétabli depuis une action d'avant cette migration, ou un lot sans date, n'est
     pas estimé.
  2. Résumé quotidien : une date indicative (« de préférence avant ») proche y figure comme une date stricte ;
     dépassée, jamais (le résumé ne compte que les dates d'aujourd'hui et de demain). Congélateur : jamais.

  Ajout d'une colonne (faux pour les lots existants, dont l'origine de la date est inconnue) ; aucune autre
  donnée modifiée.
*/

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS expiry_estimated boolean NOT NULL DEFAULT false;

-- 1. Valeurs par défaut à chaque ajout : origine de la date absente (lot rétabli) ou sans date : non estimée

CREATE OR REPLACE FUNCTION public.fill_storage_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.location := coalesce(NEW.location, public.default_location(NEW.category, NEW.kind, NEW.food_key));
  NEW.date_kind := coalesce(NEW.date_kind, public.default_date_kind(NEW.category, NEW.kind));
  IF NEW.location = 'freezer' AND NEW.frozen_at IS NULL THEN
    NEW.frozen_at := current_date;
  END IF;
  NEW.expiry_estimated := coalesce(NEW.expiry_estimated, false) AND NEW.expires_at IS NOT NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fill_storage_defaults() FROM PUBLIC, anon, authenticated;

-- 2. Ajout depuis le scan ou la saisie : origine de la date donnée par l'app (expiry_estimated). Ajout à un
-- lot existant : la date retenue est la plus proche, avec son origine (même date : estimée seulement si les
-- deux le sont)

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
  v_date date;
  v_estimated boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    v_date := (v_item->>'expires_at')::date;
    v_estimated := coalesce((v_item->>'expiry_estimated')::boolean, false) AND v_date IS NOT NULL;
    IF nullif(v_item->>'merge_into', '') IS NOT NULL THEN
      PERFORM set_config('app.pantry_reason', 'add', true);
      PERFORM set_config('app.pantry_added', coalesce(v_item->>'quantity', ''), true);
      UPDATE public.ingredients i
      SET quantity = left(btrim(v_item->>'merged_quantity'), 40),
          expires_at = CASE
            WHEN i.expires_at IS NULL THEN v_date
            WHEN v_date IS NULL THEN i.expires_at
            ELSE least(i.expires_at, v_date) END,
          expiry_estimated = CASE
            WHEN i.expires_at IS NULL THEN v_estimated
            WHEN v_date IS NULL OR v_date > i.expires_at THEN i.expiry_estimated
            WHEN v_date < i.expires_at THEN v_estimated
            ELSE i.expiry_estimated AND v_estimated END
      WHERE i.id = (v_item->>'merge_into')::uuid
        AND i.quantity IS NOT DISTINCT FROM (v_item->>'expected_quantity');
      IF NOT FOUND THEN RAISE EXCEPTION 'pantry_conflict' USING ERRCODE = 'P0001'; END IF;
    ELSE
      PERFORM set_config('app.pantry_reason', '', true);
      v_category := nullif(v_item->>'category', '');
      v_kind := coalesce(nullif(v_item->>'kind', ''), 'ingredient');
      INSERT INTO public.ingredients (user_id, name, quantity, category, kind, storage_tip, food_key, barcode, expires_at, added_via,
                                      product_name, generic_name, brand, nova_group, nutriscore_grade, off_categories,
                                      location, date_kind, frozen_at, expiry_estimated)
      VALUES (auth.uid(), left(btrim(v_item->>'name'), 120), left(btrim(coalesce(v_item->>'quantity', '')), 40),
              v_category, v_kind,
              nullif(v_item->>'storage_tip', ''), nullif(v_item->>'food_key', ''), nullif(v_item->>'barcode', ''),
              v_date, coalesce(nullif(v_item->>'added_via', ''), 'manual'),
              left(nullif(btrim(v_item->>'product_name'), ''), 120), left(nullif(btrim(v_item->>'generic_name'), ''), 120),
              left(nullif(btrim(v_item->>'brand'), ''), 80),
              (v_item->>'nova_group')::smallint, nullif(v_item->>'nutriscore_grade', ''),
              CASE WHEN jsonb_typeof(v_item->'off_categories') = 'array'
                   THEN (SELECT array_agg(value) FROM (SELECT value FROM jsonb_array_elements_text(v_item->'off_categories') LIMIT 60) AS c)
                   END,
              coalesce(nullif(v_item->>'location', ''), public.default_location(v_category, v_kind, nullif(v_item->>'food_key', ''))),
              coalesce(nullif(v_item->>'date_kind', ''), public.default_date_kind(v_category, v_kind)),
              CASE WHEN coalesce(nullif(v_item->>'location', ''), public.default_location(v_category, v_kind, nullif(v_item->>'food_key', ''))) = 'freezer'
                   THEN current_date END,
              v_estimated);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.pantry_reason', '', true);
  PERFORM set_config('app.pantry_added', '', true);
  RETURN v_count;
END;
$$;

-- 3. Courses rangées au garde-manger : date proposée (estimée) ou choisie

CREATE OR REPLACE FUNCTION public.stock_shopping_items(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  WITH chosen AS (
    SELECT s.id, s.household_id, s.name, s.quantity, (item->>'expires_at')::date AS expires_at,
           coalesce((item->>'expiry_estimated')::boolean, false) AS expiry_estimated
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.shopping_items s ON s.id = (item->>'id')::uuid
  ),
  stocked AS (
    INSERT INTO public.ingredients (user_id, household_id, name, quantity, expires_at, added_via, expiry_estimated)
    SELECT auth.uid(), household_id, name, quantity, expires_at, 'shopping', expiry_estimated FROM chosen
    RETURNING 1
  ),
  removed AS (
    DELETE FROM public.shopping_items WHERE id IN (SELECT id FROM chosen)
  )
  SELECT count(*) INTO v_count FROM stocked;
  RETURN v_count;
END;
$$;

-- 4. Fusion de lots de même date : estimée seulement si toutes les dates fusionnées le sont

CREATE OR REPLACE FUNCTION public.merge_lots(p_target uuid, p_others uuid[], p_quantity text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.ingredients;
  v_others uuid[] := array_remove(coalesce(p_others, '{}'), p_target);
  v_removed jsonb;
  v_after jsonb;
  v_action uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_target FROM public.ingredients i
  WHERE i.id = p_target AND public.is_household_member(i.household_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF cardinality(v_others) = 0 OR btrim(coalesce(p_quantity, '')) = '' OR char_length(p_quantity) > 40 THEN
    RAISE EXCEPTION 'invalid_merge' USING ERRCODE = '22023';
  END IF;
  -- Tous présents, du même foyer, de même sorte et de même date
  IF (SELECT count(*) FROM public.ingredients i
      WHERE i.id = ANY(v_others) AND i.household_id = v_target.household_id AND i.kind = v_target.kind
        AND i.expires_at IS NOT DISTINCT FROM v_target.expires_at) <> cardinality(v_others) THEN
    RAISE EXCEPTION 'invalid_merge' USING ERRCODE = '22023';
  END IF;

  v_action := public.begin_pantry_action('merge');
  UPDATE public.ingredients i
  SET quantity = btrim(p_quantity),
      expiry_estimated = i.expiry_estimated
        AND NOT EXISTS (SELECT 1 FROM public.ingredients o WHERE o.id = ANY(v_others) AND NOT o.expiry_estimated)
  WHERE i.id = p_target
  RETURNING to_jsonb(i.*) INTO v_after;
  WITH gone AS (
    DELETE FROM public.ingredients i WHERE i.id = ANY(v_others)
    RETURNING to_jsonb(i.*) AS row
  )
  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_removed FROM gone;
  RETURN public.record_pantry_action(v_action, v_target.household_id, 'merge', v_removed,
    jsonb_build_array(jsonb_build_object('before', to_jsonb(v_target), 'after', v_after)));
END;
$$;

-- 5. Résumé quotidien : dates strictes et indicatives d'aujourd'hui et de demain, hors congélateur

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
                  AND i.location IS DISTINCT FROM 'freezer'), '[]') AS today,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                FROM public.ingredients i WHERE i.household_id = due.household_id AND i.expires_at = due.local_date + 1
                  AND i.location IS DISTINCT FROM 'freezer'), '[]') AS tomorrow,
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

-- 6. Annulation : la fusion rétablit aussi l'origine de la date du lot gardé (rien d'autre ne change)

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
    UPDATE public.ingredients i SET quantity = change->'before'->>'quantity',
      expiry_estimated = coalesce((change->'before'->>'expiry_estimated')::boolean, i.expiry_estimated)
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
