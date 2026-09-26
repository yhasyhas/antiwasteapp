/*
  # Liste de courses du foyer (phase 6b)

  - `shopping_items` : un article de la liste de courses du foyer (nom, quantité, recette d'origine),
    coché quand il est acheté (par qui, quand). Partagée par les membres du foyer, comme le garde-manger.
  - Sans household_id, l'article va dans le foyer actif de son auteur (comme les ingrédients).
  - Temps réel : chaque changement est diffusé sur le canal privé household:<id> (événement « shopping »),
    avec les mêmes déclencheurs que le garde-manger et les membres.
  - `add_to_shopping_list` : ajoute plusieurs articles en une fois (ingrédients manquants d'une recette),
    sans doublon avec les articles pas encore achetés.
  - `stock_shopping_items` : envoie des articles achetés au garde-manger (dates choisies) et les retire
    de la liste, en une seule transaction.

  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

CREATE TABLE IF NOT EXISTS shopping_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Auteur (null : compte supprimé)
  added_by uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  quantity text NOT NULL DEFAULT '' CHECK (char_length(quantity) <= 40),
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_title text CHECK (recipe_title IS NULL OR char_length(recipe_title) <= 120),
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_household ON shopping_items(household_id, checked, created_at);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household shopping items"
  ON shopping_items FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE POLICY "Members can add household shopping items"
  ON shopping_items FOR INSERT TO authenticated
  WITH CHECK (added_by = (SELECT auth.uid()) AND public.is_household_member(household_id));

CREATE POLICY "Members can update household shopping items"
  ON shopping_items FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Members can delete household shopping items"
  ON shopping_items FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- Foyer actif de l'auteur quand l'app n'envoie pas de household_id ; auteur figé
CREATE OR REPLACE FUNCTION public.prepare_shopping_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.household_id IS NULL THEN
      NEW.household_id := public.active_household_of(NEW.added_by);
    END IF;
    NEW.name := btrim(NEW.name);
  ELSIF NEW.added_by IS DISTINCT FROM OLD.added_by
        AND NOT (NEW.added_by IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.added_by)) THEN
    RAISE EXCEPTION 'shopping_author_locked' USING ERRCODE = '42501';
  END IF;
  -- Coché : par qui, quand ; décoché : effacé
  IF NEW.checked AND (TG_OP = 'INSERT' OR NOT OLD.checked) THEN
    NEW.checked_by := auth.uid();
    NEW.checked_at := now();
  ELSIF NOT NEW.checked THEN
    NEW.checked_by := NULL;
    NEW.checked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_shopping_item() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prepare_shopping_item
  BEFORE INSERT OR UPDATE ON shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.prepare_shopping_item();

-- Temps réel : événement selon la table (garde-manger, membres, courses)
CREATE OR REPLACE FUNCTION public.household_event_name(p_table text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_table
    WHEN 'ingredients' THEN 'pantry'
    WHEN 'shopping_items' THEN 'shopping'
    ELSE 'members'
  END
$$;

CREATE OR REPLACE FUNCTION public.broadcast_household_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT DISTINCT household_id FROM new_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'insert'), public.household_event_name(TG_TABLE_NAME), 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_household_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT household_id FROM new_rows UNION SELECT household_id FROM old_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'update'), public.household_event_name(TG_TABLE_NAME), 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_household_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT DISTINCT household_id FROM old_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'delete'), public.household_event_name(TG_TABLE_NAME), 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER broadcast_shopping_insert AFTER INSERT ON shopping_items
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_insert();
CREATE TRIGGER broadcast_shopping_update AFTER UPDATE ON shopping_items
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_update();
CREATE TRIGGER broadcast_shopping_delete AFTER DELETE ON shopping_items
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_delete();

-- Ingrédients manquants d'une recette, en une fois : ceux déjà sur la liste (pas encore achetés) sont
-- ignorés. Renvoie le nombre d'articles ajoutés.
CREATE OR REPLACE FUNCTION public.add_to_shopping_list(p_names text[], p_recipe_id uuid DEFAULT NULL, p_recipe_title text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Foyer actif (my_household : seule fonction du foyer ouverte à l'app)
  v_household uuid := (public.my_household()->>'id')::uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.shopping_items (household_id, name, recipe_id, recipe_title)
  SELECT DISTINCT ON (lower(btrim(n))) v_household, left(btrim(n), 80), p_recipe_id, left(p_recipe_title, 120)
  FROM unnest(p_names) AS n
  WHERE btrim(n) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.shopping_items s
      WHERE s.household_id = v_household AND NOT s.checked AND lower(s.name) = lower(btrim(n))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Articles achetés → garde-manger (date choisie par article), retirés de la liste. p_items :
-- [{ "id": "…", "expires_at": "2026-10-03" | null }]. Renvoie le nombre d'aliments rangés.
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
    SELECT s.id, s.household_id, s.name, s.quantity, (item->>'expires_at')::date AS expires_at
    FROM jsonb_array_elements(p_items) AS item
    JOIN public.shopping_items s ON s.id = (item->>'id')::uuid
  ),
  stocked AS (
    INSERT INTO public.ingredients (user_id, household_id, name, quantity, expires_at, added_via)
    SELECT auth.uid(), household_id, name, quantity, expires_at, 'shopping' FROM chosen
    RETURNING 1
  ),
  removed AS (
    DELETE FROM public.shopping_items WHERE id IN (SELECT id FROM chosen)
  )
  SELECT count(*) INTO v_count FROM stocked;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_to_shopping_list(text[], uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.stock_shopping_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_shopping_list(text[], uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_shopping_items(jsonb) TO authenticated;
