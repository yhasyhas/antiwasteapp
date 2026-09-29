/*
  # « J'ai cuisiné ça » avec quantités, quantités vers les courses, traductions des recettes

  - `cook_ingredients(p_ids, p_leftovers)` : les aliments entièrement utilisés (p_ids) sont retirés et
    comptés « sauvés » ; ceux dont il reste une partie (p_leftovers : [{ "id", "quantity" }]) gardent leur
    date et prennent la quantité restante, sans être comptés (ils le seront une fois entièrement utilisés).
    Remplace la version à un seul argument (même appel possible : p_leftovers est facultatif).
  - `add_to_shopping_list(…, p_quantities)` : quantité de chaque ingrédient manquant (même ordre que
    p_names), qui arrive dans la liste de courses. Remplace la version sans quantités (même appel possible).
  - `recipes.translations` : traductions d'une recette générées à la demande (« Traduire en … »), par
    langue : { "en": { title, description, ingredients_used[], ingredients_from_list[], … } }. Écrites
    seulement par la fonction translate-recipe (clé secrète), une seule fois par langue.
  - Quotas du jour : `links` (aliment relié à sa fiche par l'IA quand son nom est inconnu) et
    `translations` (traductions de recettes).

  Ajouts uniquement : colonnes nouvelles avec une valeur par défaut, aucune donnée existante modifiée.
*/

-- 1. « J'ai cuisiné ça » avec les restes

DROP FUNCTION IF EXISTS public.cook_ingredients(uuid[]);

CREATE OR REPLACE FUNCTION public.cook_ingredients(p_ids uuid[], p_leftovers jsonb DEFAULT '[]'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;

  -- Restes : quantité mise à jour, date inchangée, pas comptés (règles de sécurité du garde-manger)
  UPDATE public.ingredients i
  SET quantity = left(btrim(item->>'quantity'), 40)
  FROM jsonb_array_elements(coalesce(p_leftovers, '[]'::jsonb)) AS item
  WHERE i.id = (item->>'id')::uuid
    AND NOT (i.id = ANY(coalesce(p_ids, '{}')));

  -- Entièrement utilisés : retirés et comptés « sauvés »
  PERFORM set_config('app.food_event', 'saved', true);
  DELETE FROM public.ingredients WHERE id = ANY(coalesce(p_ids, '{}'));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.food_event', '', true);
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cook_ingredients(uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cook_ingredients(uuid[], jsonb) TO authenticated;

-- 2. Ingrédients manquants avec leurs quantités

DROP FUNCTION IF EXISTS public.add_to_shopping_list(text[], uuid, text);

CREATE OR REPLACE FUNCTION public.add_to_shopping_list(
  p_names text[],
  p_recipe_id uuid DEFAULT NULL,
  p_recipe_title text DEFAULT NULL,
  p_quantities text[] DEFAULT NULL
)
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
  INSERT INTO public.shopping_items (household_id, name, quantity, recipe_id, recipe_title)
  SELECT DISTINCT ON (lower(btrim(n.name)))
    v_household, left(btrim(n.name), 80), left(btrim(coalesce(p_quantities[n.position], '')), 40), p_recipe_id, left(p_recipe_title, 120)
  FROM unnest(p_names) WITH ORDINALITY AS n(name, position)
  WHERE btrim(n.name) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.shopping_items s
      WHERE s.household_id = v_household AND NOT s.checked AND lower(s.name) = lower(btrim(n.name))
    )
  ORDER BY lower(btrim(n.name)), n.position;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_to_shopping_list(text[], uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_to_shopping_list(text[], uuid, text, text[]) TO authenticated;

-- 3. Traductions des recettes

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.save_recipe_translation(p_recipe_id uuid, p_language text, p_content jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.recipes
  SET translations = translations || jsonb_build_object(p_language, p_content)
  WHERE id = p_recipe_id AND p_language IN ('fr', 'en', 'es');
$$;

REVOKE EXECUTE ON FUNCTION public.save_recipe_translation(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_recipe_translation(uuid, text, jsonb) TO service_role;

-- 4. Quotas : liens vers les fiches et traductions

ALTER TABLE usage_counters ADD COLUMN IF NOT EXISTS links integer NOT NULL DEFAULT 0;
ALTER TABLE usage_counters ADD COLUMN IF NOT EXISTS translations integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consume_quota(p_user_id uuid, p_kind text, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_kind NOT IN ('scans', 'generations', 'images', 'facts', 'links', 'translations') THEN
    RAISE EXCEPTION 'Type de quota inconnu : %', p_kind;
  END IF;

  INSERT INTO public.usage_counters (user_id, day)
  VALUES (p_user_id, v_day)
  ON CONFLICT (user_id, day) DO NOTHING;

  -- La condition est réévaluée après le verrou de ligne : pas de dépassement en cas d'appels simultanés
  UPDATE public.usage_counters
  SET scans = scans + (p_kind = 'scans')::int,
      generations = generations + (p_kind = 'generations')::int,
      images = images + (p_kind = 'images')::int,
      facts = facts + (p_kind = 'facts')::int,
      links = links + (p_kind = 'links')::int,
      translations = translations + (p_kind = 'translations')::int
  WHERE user_id = p_user_id
    AND day = v_day
    AND CASE p_kind
      WHEN 'scans' THEN scans
      WHEN 'generations' THEN generations
      WHEN 'images' THEN images
      WHEN 'facts' THEN facts
      WHEN 'links' THEN links
      ELSE translations
    END < p_limit;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_quota(p_user_id uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.usage_counters
  SET scans = greatest(scans - (p_kind = 'scans')::int, 0),
      generations = greatest(generations - (p_kind = 'generations')::int, 0),
      images = greatest(images - (p_kind = 'images')::int, 0),
      facts = greatest(facts - (p_kind = 'facts')::int, 0),
      links = greatest(links - (p_kind = 'links')::int, 0),
      translations = greatest(translations - (p_kind = 'translations')::int, 0)
  WHERE user_id = p_user_id
    AND day = (now() AT TIME ZONE 'UTC')::date;
$$;
