-- Tests de « Récemment retirés » et des produits scannés : actions annulables 24 heures (fusion : 2 minutes),
-- liste de mes actions du foyer actif, conflit si un autre membre a changé un aliment ou rajouté l'article
-- de courses entre-temps, recette supprimée entre-temps, une seule fois, auteur uniquement ; informations
-- Open Food Facts enregistrées avec un produit.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/recent_actions.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
SAVEPOINT t;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000daa', 'recent-a@example.com'),
  ('00000000-0000-4000-a000-000000000dbb', 'recent-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-000000000daa', 'recent-a@example.com'),
  ('00000000-0000-4000-a000-000000000dbb', 'recent-b@example.com') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000daa", "role": "authenticated"}', true);
INSERT INTO ctx SELECT 'code', (public.create_household_invite())->>'code';
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000dbb", "role": "authenticated"}', true);
SELECT public.join_household((SELECT value FROM ctx WHERE key = 'code'), false);
INSERT INTO ctx SELECT 'household', (public.my_household())->>'id';
RESET ROLE;

-- Garde-manger : riz, pommes (4), lait en deux lots de même date, yaourt, œufs (de B) ; recette et courses
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, expires_at) VALUES
  ('00000000-0000-4000-b000-000000000de1', '00000000-0000-4000-a000-000000000daa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'riz', '500 g', current_date + 30),
  ('00000000-0000-4000-b000-000000000de2', '00000000-0000-4000-a000-000000000daa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'pommes', '4', current_date + 8),
  ('00000000-0000-4000-b000-000000000de3', '00000000-0000-4000-a000-000000000dbb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'lait', '1 l', current_date + 4),
  ('00000000-0000-4000-b000-000000000de4', '00000000-0000-4000-a000-000000000dbb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'lait', '50 cl', current_date + 4),
  ('00000000-0000-4000-b000-000000000de5', '00000000-0000-4000-a000-000000000daa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'yaourt', '2', current_date + 6),
  ('00000000-0000-4000-b000-000000000de6', '00000000-0000-4000-a000-000000000dbb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'œufs', '6', current_date + 12);
INSERT INTO public.recipes (id, user_id, title, ingredients_used, instructions) VALUES
  ('00000000-0000-4000-c000-000000000df0', '00000000-0000-4000-a000-000000000daa', 'Compote', '[]', '[]');
INSERT INTO public.shopping_items (id, household_id, added_by, name, quantity, recipe_id) VALUES
  ('00000000-0000-4000-c000-000000000df1', (SELECT value::uuid FROM ctx WHERE key = 'household'), '00000000-0000-4000-a000-000000000daa', 'Sucre', '1 kg', '00000000-0000-4000-c000-000000000df0'),
  ('00000000-0000-4000-c000-000000000df2', (SELECT value::uuid FROM ctx WHERE key = 'household'), '00000000-0000-4000-a000-000000000daa', 'Beurre', '', NULL);

-- Actions de A
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000daa", "role": "authenticated"}', true);
INSERT INTO ctx VALUES
  ('rice', public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-000000000de1']::uuid[])::text),
  ('cook', public.cook_with_undo('{}', '[{"id": "00000000-0000-4000-b000-000000000de2", "quantity": "1"}]')::text),
  ('sugar', public.delete_shopping_item_with_undo('00000000-0000-4000-c000-000000000df1')::text),
  ('butter', public.delete_shopping_item_with_undo('00000000-0000-4000-c000-000000000df2')::text),
  ('late', public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-000000000de5']::uuid[])::text),
  ('merge', public.merge_lots('00000000-0000-4000-b000-000000000de3', ARRAY['00000000-0000-4000-b000-000000000de4']::uuid[], '1,5 l')::text);
-- Action de B (absente de la liste de A)
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000dbb", "role": "authenticated"}', true);
INSERT INTO ctx VALUES ('b_eggs', public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-000000000de6']::uuid[])::text);
-- Entre-temps, B change les pommes entamées par A et rajoute du beurre aux courses
UPDATE public.ingredients SET quantity = '3' WHERE id = '00000000-0000-4000-b000-000000000de2';
INSERT INTO public.shopping_items (name, quantity) VALUES ('beurre', '250 g');
RESET ROLE;

-- Le temps passe : riz 3 h, cuisine 5 h, sucre 23 h, beurre 1 h, yaourt 25 h, fusion 3 minutes ; la recette
-- de l'article « Sucre » est supprimée
UPDATE public.pantry_actions SET created_at = now() - (CASE (SELECT key FROM ctx WHERE value = pantry_actions.id::text)
  WHEN 'rice' THEN interval '3 hours' WHEN 'cook' THEN interval '5 hours' WHEN 'sugar' THEN interval '23 hours'
  WHEN 'butter' THEN interval '1 hour' WHEN 'late' THEN interval '25 hours' WHEN 'merge' THEN interval '3 minutes' ELSE interval '0' END)
WHERE id::text IN (SELECT value FROM ctx);
DELETE FROM public.recipes WHERE id = '00000000-0000-4000-c000-000000000df0';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000daa", "role": "authenticated"}', true);
DO $$
DECLARE
  v_list text[] := ARRAY(SELECT (SELECT key FROM ctx WHERE value = r.id::text) FROM public.recent_pantry_actions() AS r);
  v_result text;
BEGIN
  -- 1. Liste : mes retraits et « J'ai cuisiné ça » de moins de 24 heures, du plus récent au plus ancien
  IF v_list IS DISTINCT FROM ARRAY['butter', 'rice', 'cook', 'sugar'] THEN
    RAISE EXCEPTION 'ÉCHEC : liste « Récemment retirés » (%)', v_list;
  END IF;
  IF (SELECT names FROM public.recent_pantry_actions() WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'rice')) IS DISTINCT FROM ARRAY['riz']
     OR (SELECT (removed_count, updated_count) FROM public.recent_pantry_actions() WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'cook')) IS DISTINCT FROM (0, 1) THEN
    RAISE EXCEPTION 'ÉCHEC : noms ou nombres de la liste';
  END IF;
  RAISE NOTICE 'OK : « Récemment retirés » : mes actions de moins de 24 heures (ni celles d''un autre membre, ni la fusion, ni les plus anciennes)';

  -- 2. Retrait de 3 heures : rétabli, une seule fois, plus dans la liste
  v_result := public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'rice'));
  IF v_result <> 'undone' OR NOT EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000de1' AND quantity = '500 g') THEN
    RAISE EXCEPTION 'ÉCHEC : rétablissement après 3 heures (%)', v_result;
  END IF;
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'rice')) <> 'already_undone'
     OR EXISTS (SELECT 1 FROM public.recent_pantry_actions() WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'rice')) THEN
    RAISE EXCEPTION 'ÉCHEC : rétabli deux fois ou encore listé';
  END IF;
  RAISE NOTICE 'OK : retrait de 3 heures rétabli, une seule fois, retiré de la liste';

  -- 3. Plus de 24 heures, et fusion de plus de 2 minutes : refusés
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'late')) <> 'expired'
     OR public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'merge')) <> 'expired' THEN
    RAISE EXCEPTION 'ÉCHEC : délais';
  END IF;
  RAISE NOTICE 'OK : refusé après 24 heures, et après 2 minutes pour une fusion';

  -- 4. Cuisine de 5 heures, pommes changées par B entre-temps : conflit, rien d'écrasé
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'cook')) <> 'conflict'
     OR (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000de2') <> '3' THEN
    RAISE EXCEPTION 'ÉCHEC : conflit après plusieurs heures';
  END IF;
  RAISE NOTICE 'OK : « J''ai cuisiné ça » de 5 heures, aliment changé par B : conflit, changement de B gardé';

  -- 5. Beurre rajouté aux courses par B : conflit, pas de doublon
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'butter')) <> 'conflict'
     OR (SELECT count(*) FROM public.shopping_items WHERE lower(name) = 'beurre') <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : article rajouté entre-temps';
  END IF;
  RAISE NOTICE 'OK : article de courses rajouté entre-temps par B : conflit, pas de doublon';

  -- 6. Sucre retiré il y a 23 heures, recette supprimée depuis : rétabli sans la recette
  v_result := public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'sugar'));
  IF v_result <> 'undone' OR NOT EXISTS (SELECT 1 FROM public.shopping_items WHERE id = '00000000-0000-4000-c000-000000000df1'
       AND recipe_id IS NULL AND added_by = '00000000-0000-4000-a000-000000000daa') THEN
    RAISE EXCEPTION 'ÉCHEC : article rétabli après 23 heures (%)', v_result;
  END IF;
  RAISE NOTICE 'OK : article retiré il y a 23 heures rétabli (recette supprimée entre-temps : sans elle)';

  -- 7. Action de B : ni listée ni annulable par A
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'b_eggs')) <> 'not_found' THEN
    RAISE EXCEPTION 'ÉCHEC : A annule l''action de B';
  END IF;
  RAISE NOTICE 'OK : seul l''auteur rétablit son action';

  -- 8. Produit scanné : informations Open Food Facts enregistrées
  PERFORM public.add_pantry_items(jsonb_build_array(jsonb_build_object(
    'name', 'Palmito L''original', 'quantity', '400 g', 'barcode', '3250390000013', 'added_via', 'barcode', 'category', 'vegetable',
    'product_name', 'Palmito L''original', 'brand', 'Palmito', 'nova_group', 3, 'nutriscore_grade', 'b',
    'off_categories', jsonb_build_array('en:canned-foods', 'en:canned-vegetables', 'en:palm-hearts'))));
  IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE barcode = '3250390000013' AND added_via = 'barcode' AND brand = 'Palmito'
                 AND nova_group = 3 AND nutriscore_grade = 'b' AND off_categories @> ARRAY['en:palm-hearts']) THEN
    RAISE EXCEPTION 'ÉCHEC : produit mal enregistré';
  END IF;
  BEGIN
    PERFORM public.add_pantry_items(jsonb_build_array(jsonb_build_object('name', 'x', 'nova_group', 7)));
    RAISE EXCEPTION 'ÉCHEC : niveau NOVA invalide accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK : produit scanné avec sa marque, son niveau NOVA, son Nutri-Score et ses catégories ; NOVA invalide refusé';
END;
$$;

ROLLBACK TO SAVEPOINT t; RESET ROLE;
ROLLBACK;
