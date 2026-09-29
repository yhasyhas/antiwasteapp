/*
  # Actions annulables du garde-manger et des courses (« Annuler » pendant 5 secondes)

  Chaque action est enregistrée tout de suite (rien ne se perd si l'app passe en arrière-plan, est fermée ou
  perd la connexion après la confirmation), avec l'état d'avant, pour pouvoir l'annuler en une seule
  opération côté serveur, tout ou rien.

  - `pantry_actions` : une ligne par action annulable, avec les lignes retirées (entières) et les lignes
    modifiées (avant / après). Lisible et écrite seulement par les fonctions ci-dessous ; gardée un jour.
  - `food_events.ingredient_id` : aliment à l'origine de l'événement du compteur, pour retirer exactement les
    événements créés par l'action annulée (« sauvé » ou « gaspillé »). Vide pour les événements existants.
  - `cook_with_undo(p_ids, p_leftovers)` : « J'ai cuisiné ça » (aliments finis retirés et comptés « sauvés »,
    restes mis à jour) ; renvoie l'identifiant de l'action.
  - `delete_ingredient_with_undo(p_id)`, `delete_shopping_item_with_undo(p_id)` : suppressions annulables.
  - `undo_pantry_action(p_action_id)` : rétablit l'état d'avant (lignes, quantités, compteur) et renvoie
    'undone' ; 'conflict' si un membre du foyer a modifié entre-temps un aliment concerné (rien n'est alors
    rétabli, pour ne pas écraser son changement) ; 'already_undone', 'expired' (plus de 2 minutes) ou
    'not_found' (action d'un autre, foyer quitté).

  Ajouts uniquement : nouvelle table, nouvelle colonne vide, aucune donnée existante modifiée.
*/

-- 1. Événements du compteur reliés à leur aliment

ALTER TABLE food_events ADD COLUMN IF NOT EXISTS ingredient_id uuid;
CREATE INDEX IF NOT EXISTS idx_food_events_ingredient ON food_events(ingredient_id) WHERE ingredient_id IS NOT NULL;

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

-- 2. Actions annulables

CREATE TABLE IF NOT EXISTS pantry_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cook', 'delete_ingredient', 'delete_shopping')),
  -- Lignes retirées, entières (ingrédients ou articles de courses)
  removed jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Ingrédients modifiés : [{ "before": ligne, "after": ligne }]
  updated jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pantry_actions_created ON pantry_actions(created_at);

-- Aucune règle : seulement par les fonctions ci-dessous
ALTER TABLE pantry_actions ENABLE ROW LEVEL SECURITY;

-- Enregistre une action (et oublie celles de plus d'un jour)
CREATE OR REPLACE FUNCTION public.record_pantry_action(p_household uuid, p_kind text, p_removed jsonb, p_updated jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  DELETE FROM public.pantry_actions WHERE created_at < now() - interval '1 day';
  INSERT INTO public.pantry_actions (household_id, user_id, kind, removed, updated)
  VALUES (p_household, auth.uid(), p_kind, p_removed, p_updated)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_pantry_action(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- « J'ai cuisiné ça » : aliments finis (p_ids) retirés et comptés « sauvés », restes (p_leftovers :
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  -- Foyer des aliments concernés (un seul), dont l'utilisateur est membre
  SELECT i.household_id INTO v_household
  FROM public.ingredients i
  WHERE (i.id = ANY(v_ids) OR i.id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(coalesce(p_leftovers, '[]'::jsonb)) AS item))
    AND public.is_household_member(i.household_id)
  LIMIT 1;
  IF v_household IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  -- Restes : quantité mise à jour (avant / après gardés pour l'annulation)
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

  -- Entièrement utilisés : retirés et comptés « sauvés »
  PERFORM set_config('app.food_event', 'saved', true);
  WITH gone AS (
    DELETE FROM public.ingredients i WHERE i.id = ANY(v_ids) AND i.household_id = v_household
    RETURNING to_jsonb(i.*) AS row
  )
  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) INTO v_removed FROM gone;
  PERFORM set_config('app.food_event', '', true);

  RETURN public.record_pantry_action(v_household, 'cook', v_removed, v_updated);
END;
$$;

-- Aliment retiré du garde-manger (compté « gaspillé » s'il était périmé)
CREATE OR REPLACE FUNCTION public.delete_ingredient_with_undo(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.ingredients i WHERE i.id = p_id AND public.is_household_member(i.household_id)
  RETURNING to_jsonb(i.*) INTO v_row;
  IF v_row IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN public.record_pantry_action((v_row->>'household_id')::uuid, 'delete_ingredient', jsonb_build_array(v_row), '[]'::jsonb);
END;
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
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.shopping_items s WHERE s.id = p_id AND public.is_household_member(s.household_id)
  RETURNING to_jsonb(s.*) INTO v_row;
  IF v_row IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN public.record_pantry_action((v_row->>'household_id')::uuid, 'delete_shopping', jsonb_build_array(v_row), '[]'::jsonb);
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

  -- Aliment modifié par l'action puis changé ou retiré par quelqu'un d'autre : rien n'est rétabli
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

  IF v_action.kind IN ('cook', 'delete_ingredient') THEN
    -- Aliments retirés : rétablis tels quels (même identifiant, même date, même auteur)
    INSERT INTO public.ingredients SELECT * FROM jsonb_populate_recordset(NULL::public.ingredients, v_action.removed);
    -- Restes : quantité d'avant
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

  UPDATE public.pantry_actions SET undone_at = now() WHERE id = v_action.id;
  RETURN 'undone';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_ingredient_with_undo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_shopping_item_with_undo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_pantry_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cook_with_undo(uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ingredient_with_undo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shopping_item_with_undo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_pantry_action(uuid) TO authenticated;
