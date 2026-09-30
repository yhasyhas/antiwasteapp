/*
  # Lots du garde-manger et historique (phase 7b)

  Chaque ligne de `ingredients` devient un lot : l'app regroupe les lots d'un même aliment (même `food_key`
  ou même nom normalisé) sur une seule ligne. Rien ne change dans la table elle-même.

  - `pantry_history` : historique des ajouts, utilisations (totales ou partielles), fusions, modifications de
    quantité et suppressions, avec l'aliment, la quantité et le membre du foyer. Écrit seulement par le
    déclencheur `log_pantry_history` ; lisible par les membres du foyer (aucun écran pour l'instant).
    `quantity` : quantité concernée (ajoutée, ou celle d'avant) ; `quantity_after` : ce qui reste après.
    Les fonctions indiquent la raison du changement par des réglages locaux à la transaction :
    app.pantry_reason ('add', 'cook', 'merge', 'remove', 'undo'), app.pantry_action (action annulable, pour
    retirer exactement ses lignes d'historique à l'annulation), app.pantry_added (quantité ajoutée à un lot).
  - `add_pantry_items(p_items)` : ajout depuis le scan ou la saisie manuelle, en une fois ; chaque aliment
    devient un nouveau lot, ou s'ajoute à un lot existant (« Ajouter aux existants ») : quantité totale
    calculée par l'app, date la plus proche des deux. Si le lot a changé entre-temps (autre membre),
    erreur 'pantry_conflict' et rien n'est enregistré.
  - `merge_lots(p_target, p_others, p_quantity)` : fusion de lots de même date (même unité, vérifiée par
    l'app) ; annulable, ne compte ni « sauvé » ni « gaspillé ».
  - `delete_ingredients_with_undo(p_ids)` : suppression annulable de plusieurs lots (ligne entière).
  - `cook_with_undo`, `delete_ingredient_with_undo`, `delete_shopping_item_with_undo`, `undo_pantry_action` :
    mêmes règles qu'avant, avec l'historique ; l'annulation retire les lignes d'historique de l'action.

  Ajouts uniquement : nouvelle table vide, aucune donnée existante modifiée. Les actions annulables en
  cours (moins de 2 minutes) restent annulables.
*/

-- 1. Historique

CREATE TABLE IF NOT EXISTS pantry_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Membre à l'origine du changement (null : compte supprimé, ou fonction du serveur)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ingredient_id uuid,
  action_id uuid,
  kind text NOT NULL CHECK (kind IN ('added', 'used', 'merged', 'edited', 'removed')),
  name text NOT NULL,
  food_key text,
  quantity text,
  quantity_after text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pantry_history_household ON pantry_history(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pantry_history_action ON pantry_history(action_id) WHERE action_id IS NOT NULL;

ALTER TABLE pantry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household pantry history"
  ON pantry_history FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE OR REPLACE FUNCTION public.log_pantry_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := coalesce(current_setting('app.pantry_reason', true), '');
  v_action uuid := nullif(current_setting('app.pantry_action', true), '')::uuid;
  v_row public.ingredients;
  v_kind text;
  v_quantity text;
  v_after text;
BEGIN
  -- Annulation : les lignes de l'action sont retirées par undo_pantry_action
  IF v_reason = 'undo' THEN RETURN NULL; END IF;

  IF TG_OP = 'INSERT' THEN
    v_row := NEW;
    v_kind := 'added';
    v_quantity := NEW.quantity;
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := NEW;
    IF v_reason = 'add' THEN
      v_kind := 'added';
      v_quantity := nullif(current_setting('app.pantry_added', true), '');
      v_after := NEW.quantity;
    ELSIF OLD.quantity IS NOT DISTINCT FROM NEW.quantity THEN
      -- Date, fiche reliée, nom : pas dans l'historique
      RETURN NULL;
    ELSE
      v_kind := CASE v_reason WHEN 'cook' THEN 'used' WHEN 'merge' THEN 'merged' ELSE 'edited' END;
      v_quantity := OLD.quantity;
      v_after := NEW.quantity;
    END IF;
  ELSE
    v_row := OLD;
    -- Foyer en cours de suppression : rien à garder
    IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = OLD.household_id) THEN RETURN NULL; END IF;
    -- Lot fusionné dans un autre : la fusion est notée sur celui qui reste
    IF v_reason = 'merge' THEN RETURN NULL; END IF;
    v_kind := CASE WHEN v_reason = 'cook' OR current_setting('app.food_event', true) = 'saved' THEN 'used' ELSE 'removed' END;
    v_quantity := OLD.quantity;
  END IF;

  INSERT INTO public.pantry_history (household_id, user_id, ingredient_id, action_id, kind, name, food_key, quantity, quantity_after)
  VALUES (v_row.household_id, auth.uid(), v_row.id, v_action, v_kind, left(v_row.name, 120), v_row.food_key,
          left(v_quantity, 40), left(v_after, 40));
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_pantry_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_pantry_history
  AFTER INSERT OR UPDATE OR DELETE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.log_pantry_history();

-- 2. Compteur : un lot fusionné dans un autre n'est ni sauvé ni gaspillé

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
  ELSIF OLD.expires_at IS NOT NULL AND OLD.expires_at < (now() AT TIME ZONE 'utc')::date THEN
    v_kind := 'wasted';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.food_events (household_id, user_id, kind, ingredient_name, expires_at, ingredient_id)
  VALUES (OLD.household_id, auth.uid(), v_kind, left(OLD.name, 120), OLD.expires_at, OLD.id);
  RETURN NULL;
END;
$$;

-- 3. Actions annulables : fusion, identifiant choisi avant l'action (relié à l'historique)

ALTER TABLE pantry_actions DROP CONSTRAINT IF EXISTS pantry_actions_kind_check;
ALTER TABLE pantry_actions ADD CONSTRAINT pantry_actions_kind_check
  CHECK (kind IN ('cook', 'delete_ingredient', 'delete_shopping', 'merge'));

DROP FUNCTION IF EXISTS public.record_pantry_action(uuid, text, jsonb, jsonb);

-- Début d'une action annulable : raison et identifiant pour l'historique
CREATE OR REPLACE FUNCTION public.begin_pantry_action(p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('app.pantry_reason', p_reason, true);
  PERFORM set_config('app.pantry_action', v_id::text, true);
  RETURN v_id;
END;
$$;

-- Fin : réglages effacés (plusieurs appels dans une même transaction ne se mélangent pas)
CREATE OR REPLACE FUNCTION public.end_pantry_action()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.pantry_reason', '', true);
  PERFORM set_config('app.pantry_action', '', true);
  PERFORM set_config('app.pantry_added', '', true);
  PERFORM set_config('app.food_event', '', true);
END;
$$;

-- Enregistre une action (et oublie celles de plus d'un jour)
CREATE OR REPLACE FUNCTION public.record_pantry_action(p_id uuid, p_household uuid, p_kind text, p_removed jsonb, p_updated jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.pantry_actions WHERE created_at < now() - interval '1 day';
  INSERT INTO public.pantry_actions (id, household_id, user_id, kind, removed, updated)
  VALUES (p_id, p_household, auth.uid(), p_kind, p_removed, p_updated);
  PERFORM public.end_pantry_action();
  RETURN p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.begin_pantry_action(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_pantry_action() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_pantry_action(uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- « J'ai cuisiné ça » : lots finis (p_ids) retirés et comptés « sauvés », lots entamés (p_leftovers :
-- [{ "id", "quantity" }]) mis à jour, date inchangée. Seulement dans un foyer dont on est membre.
CREATE OR REPLACE FUNCTION public.cook_with_undo(p_ids uuid[], p_leftovers jsonb DEFAULT '[]'::jsonb)
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

  RETURN public.record_pantry_action(v_action, v_household, 'cook', v_removed, v_updated);
END;
$$;

-- Lots retirés du garde-manger (chacun compté « gaspillé » s'il était périmé)
CREATE OR REPLACE FUNCTION public.delete_ingredients_with_undo(p_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household uuid;
  v_removed jsonb;
  v_action uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT i.household_id INTO v_household FROM public.ingredients i
  WHERE i.id = ANY(coalesce(p_ids, '{}')) AND public.is_household_member(i.household_id)
  LIMIT 1;
  IF v_household IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  v_action := public.begin_pantry_action('remove');
  WITH gone AS (
    DELETE FROM public.ingredients i WHERE i.id = ANY(p_ids) AND i.household_id = v_household
    RETURNING to_jsonb(i.*) AS row
  )
  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_removed FROM gone;
  RETURN public.record_pantry_action(v_action, v_household, 'delete_ingredient', v_removed, '[]'::jsonb);
END;
$$;

-- Un seul lot (versions précédentes de l'app)
CREATE OR REPLACE FUNCTION public.delete_ingredient_with_undo(p_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.delete_ingredients_with_undo(ARRAY[p_id]);
$$;

-- Article retiré de la liste de courses
CREATE OR REPLACE FUNCTION public.delete_shopping_item_with_undo(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row jsonb;
  v_action uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_action := public.begin_pantry_action('remove');
  DELETE FROM public.shopping_items s WHERE s.id = p_id AND public.is_household_member(s.household_id)
  RETURNING to_jsonb(s.*) INTO v_row;
  IF v_row IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN public.record_pantry_action(v_action, (v_row->>'household_id')::uuid, 'delete_shopping', jsonb_build_array(v_row), '[]'::jsonb);
END;
$$;

-- Fusion de lots de même date dans p_target, qui prend la quantité totale p_quantity (calculée par l'app,
-- unités vérifiées par l'app). Les autres lots sont retirés sans compter ni « sauvé » ni « gaspillé ».
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
  UPDATE public.ingredients i SET quantity = btrim(p_quantity) WHERE i.id = p_target
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

-- Ajout depuis le scan ou la saisie manuelle. p_items : [{ name, quantity, category, kind, storage_tip,
-- food_key, barcode, expires_at, added_via }] ; pour ajouter à un lot existant : merge_into (lot),
-- expected_quantity (sa quantité lue par l'app) et merged_quantity (total calculé par l'app).
-- Règles de sécurité du garde-manger (appel avec les droits de l'utilisateur). Renvoie le nombre d'aliments.
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
      INSERT INTO public.ingredients (user_id, name, quantity, category, kind, storage_tip, food_key, barcode, expires_at, added_via)
      VALUES (auth.uid(), left(btrim(v_item->>'name'), 120), left(btrim(coalesce(v_item->>'quantity', '')), 40),
              nullif(v_item->>'category', ''), coalesce(nullif(v_item->>'kind', ''), 'ingredient'),
              nullif(v_item->>'storage_tip', ''), nullif(v_item->>'food_key', ''), nullif(v_item->>'barcode', ''),
              (v_item->>'expires_at')::date, coalesce(nullif(v_item->>'added_via', ''), 'manual'));
    END IF;
    v_count := v_count + 1;
  END LOOP;
  PERFORM set_config('app.pantry_reason', '', true);
  PERFORM set_config('app.pantry_added', '', true);
  RETURN v_count;
END;
$$;

-- Annulation, tout ou rien
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
  IF v_action.created_at < now() - interval '2 minutes' THEN RETURN 'expired'; END IF;

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

  PERFORM set_config('app.pantry_reason', 'undo', true);
  IF v_action.kind IN ('cook', 'delete_ingredient', 'merge') THEN
    -- Lots retirés : rétablis tels quels (même identifiant, même date, même auteur)
    INSERT INTO public.ingredients SELECT * FROM jsonb_populate_recordset(NULL::public.ingredients, v_action.removed);
    -- Lots entamés ou fusionnés : quantité d'avant
    UPDATE public.ingredients i SET quantity = change->'before'->>'quantity'
    FROM jsonb_array_elements(v_action.updated) AS change
    WHERE i.id = (change->'before'->>'id')::uuid;
    -- Compteur : événements créés par l'action retirés
    DELETE FROM public.food_events e
    WHERE e.ingredient_id IN (SELECT (row->>'id')::uuid FROM jsonb_array_elements(v_action.removed) AS row)
      AND e.created_at >= v_action.created_at;
  ELSE
    INSERT INTO public.shopping_items SELECT * FROM jsonb_populate_recordset(NULL::public.shopping_items, v_action.removed);
    -- Coché par qui et quand : comme avant (l'ajout le remplace par l'utilisateur actuel)
    UPDATE public.shopping_items s SET checked_by = r.checked_by, checked_at = r.checked_at
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

REVOKE EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_ingredients_with_undo(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_ingredient_with_undo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_shopping_item_with_undo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merge_lots(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_pantry_items(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_pantry_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ingredients_with_undo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ingredient_with_undo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shopping_item_with_undo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_lots(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_pantry_items(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_pantry_action(uuid) TO authenticated;
