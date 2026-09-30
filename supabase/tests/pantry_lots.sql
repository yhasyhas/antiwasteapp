-- Tests des lots du garde-manger et de l'historique (phase 7b) : ajout en nouveau lot ou à un lot existant
-- (conflit si le lot a changé), « J'ai cuisiné ça » sur plusieurs lots du plus ancien au plus récent et son
-- annulation tout ou rien (lots, quantités, compteur, historique), conflit quand un autre membre modifie ou
-- retire un lot entamé, fusion de lots (annulable, sans compter), suppression d'un aliment entier, rien pour
-- qui n'est pas du foyer.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/pantry_lots.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
SAVEPOINT t;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-0000000009aa', 'lots-a@example.com'),
  ('00000000-0000-4000-a000-0000000009bb', 'lots-b@example.com'),
  ('00000000-0000-4000-a000-0000000009cc', 'lots-c@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-0000000009aa', 'lots-a@example.com'),
  ('00000000-0000-4000-a000-0000000009bb', 'lots-b@example.com'),
  ('00000000-0000-4000-a000-0000000009cc', 'lots-c@example.com') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009aa", "role": "authenticated"}', true);
INSERT INTO ctx SELECT 'code', (public.create_household_invite())->>'code';
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009bb", "role": "authenticated"}', true);
SELECT public.join_household((SELECT value FROM ctx WHERE key = 'code'), false);
INSERT INTO ctx SELECT 'household', (public.my_household())->>'id';
RESET ROLE;

-- Tomates en trois lots (2 dans 1 jour, 3 dans 3 jours, 4 dans 6 jours) ; lait en deux lots de même date,
-- périmés (la fusion ne doit pas les compter gaspillés)
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, food_key, expires_at) VALUES
  ('00000000-0000-4000-b000-0000000009e1', '00000000-0000-4000-a000-0000000009aa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'tomates', '2', 'tomato', current_date + 1),
  ('00000000-0000-4000-b000-0000000009e2', '00000000-0000-4000-a000-0000000009bb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'tomates', '3', 'tomato', current_date + 3),
  ('00000000-0000-4000-b000-0000000009e3', '00000000-0000-4000-a000-0000000009aa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'Tomates', '4', 'tomato', current_date + 6),
  ('00000000-0000-4000-b000-0000000009f1', '00000000-0000-4000-a000-0000000009aa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'lait', '1 l', 'milk', current_date - 1),
  ('00000000-0000-4000-b000-0000000009f2', '00000000-0000-4000-a000-0000000009bb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'lait', '50 cl', 'milk', current_date - 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009aa", "role": "authenticated"}', true);

DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
BEGIN
  -- 1. Ajout : un nouveau lot (courgettes) et 2 tomates ajoutées au lot de 3 (date plus proche gardée)
  IF public.add_pantry_items(jsonb_build_array(
       jsonb_build_object('name', 'courgettes', 'quantity', '2', 'expires_at', current_date + 5, 'added_via', 'camera', 'food_key', 'zucchini'),
       jsonb_build_object('name', 'tomates', 'quantity', '2', 'expires_at', current_date + 2, 'merge_into', '00000000-0000-4000-b000-0000000009e2',
                          'expected_quantity', '3', 'merged_quantity', '5'))) <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : ajout';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE household_id = v_household AND name = 'courgettes' AND added_via = 'camera' AND user_id = auth.uid())
     OR (SELECT (quantity, expires_at) FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009e2') IS DISTINCT FROM ('5'::text, current_date + 2) THEN
    RAISE EXCEPTION 'ÉCHEC : nouveau lot ou ajout au lot existant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pantry_history WHERE household_id = v_household AND kind = 'added' AND name = 'courgettes' AND quantity = '2' AND user_id = auth.uid())
     OR NOT EXISTS (SELECT 1 FROM public.pantry_history WHERE ingredient_id = '00000000-0000-4000-b000-0000000009e2' AND kind = 'added' AND quantity = '2' AND quantity_after = '5') THEN
    RAISE EXCEPTION 'ÉCHEC : historique des ajouts';
  END IF;
  RAISE NOTICE 'OK : ajout en nouveau lot et à un lot existant (total, date la plus proche), dans l''historique avec l''auteur';

  -- Lot changé entre-temps (quantité lue périmée) : erreur, rien d'enregistré, même le nouveau lot
  BEGIN
    PERFORM public.add_pantry_items(jsonb_build_array(
      jsonb_build_object('name', 'poivrons', 'quantity', '1', 'expires_at', current_date + 5),
      jsonb_build_object('name', 'tomates', 'quantity', '1', 'merge_into', '00000000-0000-4000-b000-0000000009e2', 'expected_quantity', '3', 'merged_quantity', '4')));
    RAISE EXCEPTION 'ÉCHEC : conflit d''ajout non détecté';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'pantry_conflict' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE household_id = v_household AND name = 'poivrons')
     OR (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009e2') <> '5' THEN
    RAISE EXCEPTION 'ÉCHEC : ajout partiel malgré le conflit';
  END IF;
  RAISE NOTICE 'OK : lot modifié entre-temps : conflit, rien d''enregistré (tout ou rien)';
END;
$$;

DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
  v_before_rows jsonb := (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household);
  v_saved integer := (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved');
  v_history integer := (SELECT count(*) FROM public.pantry_history WHERE household_id = v_household);
  v_action uuid;
  v_result text;
BEGIN
  -- 2. Cuisiné 8 tomates sur 11 : les deux plus anciens lots finis (2 + 5), le dernier entamé (4 → 3)
  v_action := public.cook_with_undo(ARRAY['00000000-0000-4000-b000-0000000009e1', '00000000-0000-4000-b000-0000000009e2']::uuid[],
    '[{"id": "00000000-0000-4000-b000-0000000009e3", "quantity": "3"}]');
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE id IN ('00000000-0000-4000-b000-0000000009e1', '00000000-0000-4000-b000-0000000009e2'))
     OR (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009e3') <> '3' THEN
    RAISE EXCEPTION 'ÉCHEC : lots mal consommés';
  END IF;
  IF (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved + 2 THEN
    RAISE EXCEPTION 'ÉCHEC : compteur (un « sauvé » par lot fini)';
  END IF;
  IF (SELECT count(*) FROM public.pantry_history WHERE action_id = v_action AND kind = 'used' AND quantity_after IS NULL) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.pantry_history WHERE action_id = v_action AND kind = 'used'
                    AND ingredient_id = '00000000-0000-4000-b000-0000000009e3' AND quantity = '4' AND quantity_after = '3') THEN
    RAISE EXCEPTION 'ÉCHEC : historique des utilisations';
  END IF;
  RAISE NOTICE 'OK : cuisiné sur trois lots (deux finis, un entamé), compté lot par lot, historique (utilisations totales et partielle)';

  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone' THEN RAISE EXCEPTION 'ÉCHEC : annulation (%)', v_result; END IF;
  IF (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household) IS DISTINCT FROM v_before_rows
     OR (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved
     OR (SELECT count(*) FROM public.pantry_history WHERE household_id = v_household) <> v_history THEN
    RAISE EXCEPTION 'ÉCHEC : état d''avant non rétabli';
  END IF;
  RAISE NOTICE 'OK : annulation sur plusieurs lots (lots rétablis à l''identique, quantité, compteur et historique d''avant)';

  -- Préparation des cas concurrents : même cuisine, deux fois
  INSERT INTO ctx VALUES ('modified', public.cook_with_undo(ARRAY['00000000-0000-4000-b000-0000000009e1']::uuid[],
    '[{"id": "00000000-0000-4000-b000-0000000009e2", "quantity": "1"}]')::text);
END;
$$;

-- B change le lot entamé entre-temps
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009bb", "role": "authenticated"}', true);
UPDATE public.ingredients SET quantity = '6' WHERE id = '00000000-0000-4000-b000-0000000009e2';
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009aa", "role": "authenticated"}', true);
DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
  v_saved integer := (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved');
BEGIN
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'modified')) <> 'conflict' THEN RAISE EXCEPTION 'ÉCHEC : conflit non détecté'; END IF;
  IF (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009e2') <> '6'
     OR EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009e1')
     OR (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved THEN
    RAISE EXCEPTION 'ÉCHEC : annulation partielle malgré le conflit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pantry_history WHERE ingredient_id = '00000000-0000-4000-b000-0000000009e2' AND kind = 'edited'
                 AND quantity = '1' AND quantity_after = '6' AND user_id = '00000000-0000-4000-a000-0000000009bb') THEN
    RAISE EXCEPTION 'ÉCHEC : modification de B absente de l''historique';
  END IF;
  RAISE NOTICE 'OK : lot entamé modifié par B : conflit, rien rétabli (lot fini toujours retiré, changement de B gardé, compteur inchangé)';

  -- Lot entamé puis retiré par B : conflit aussi
  INSERT INTO ctx VALUES ('removed', public.cook_with_undo('{}', '[{"id": "00000000-0000-4000-b000-0000000009e3", "quantity": "1"}]')::text);
END;
$$;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009bb", "role": "authenticated"}', true);
SELECT public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-0000000009e3']::uuid[]);
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009aa", "role": "authenticated"}', true);
DO $$
BEGIN
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'removed')) <> 'conflict' THEN RAISE EXCEPTION 'ÉCHEC : lot retiré par B non détecté'; END IF;
  RAISE NOTICE 'OK : lot entamé puis retiré par B : conflit';
END;
$$;

DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
  v_before_rows jsonb := (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household);
  v_events integer := (SELECT count(*) FROM public.food_events WHERE household_id = v_household);
  v_action uuid;
  v_result text;
BEGIN
  -- 3. Fusion des deux laits périmés (même date) : 1,5 l, sans « gaspillé »
  v_action := public.merge_lots('00000000-0000-4000-b000-0000000009f1', ARRAY['00000000-0000-4000-b000-0000000009f2']::uuid[], '1,5 l');
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009f2')
     OR (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000009f1') <> '1,5 l'
     OR (SELECT count(*) FROM public.food_events WHERE household_id = v_household) <> v_events
     OR NOT EXISTS (SELECT 1 FROM public.pantry_history WHERE action_id = v_action AND kind = 'merged' AND quantity = '1 l' AND quantity_after = '1,5 l')
     OR EXISTS (SELECT 1 FROM public.pantry_history WHERE ingredient_id = '00000000-0000-4000-b000-0000000009f2' AND kind = 'removed') THEN
    RAISE EXCEPTION 'ÉCHEC : fusion';
  END IF;
  RAISE NOTICE 'OK : fusion de deux lots de même date (quantité totale, ni sauvé ni gaspillé, notée « fusionné »)';

  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone'
     OR (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household) IS DISTINCT FROM v_before_rows
     OR EXISTS (SELECT 1 FROM public.pantry_history WHERE action_id = v_action) THEN
    RAISE EXCEPTION 'ÉCHEC : annulation de la fusion';
  END IF;
  RAISE NOTICE 'OK : fusion annulée (deux lots d''avant, historique de la fusion retiré)';

  -- Dates différentes : refusée
  BEGIN
    PERFORM public.merge_lots('00000000-0000-4000-b000-0000000009f1', ARRAY['00000000-0000-4000-b000-0000000009e2']::uuid[], '2 l');
    RAISE EXCEPTION 'ÉCHEC : fusion de lots de dates différentes';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  RAISE NOTICE 'OK : fusion refusée pour des lots de dates différentes';

  -- 4. Aliment entier retiré (deux lots périmés : deux « gaspillés »), puis annulé
  v_action := public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-0000000009f1', '00000000-0000-4000-b000-0000000009f2']::uuid[]);
  IF (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'wasted') <> 2
     OR (SELECT count(*) FROM public.pantry_history WHERE action_id = v_action AND kind = 'removed') <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : suppression de l''aliment entier';
  END IF;
  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone'
     OR (SELECT count(*) FROM public.ingredients WHERE id IN ('00000000-0000-4000-b000-0000000009f1', '00000000-0000-4000-b000-0000000009f2')) <> 2
     OR EXISTS (SELECT 1 FROM public.food_events WHERE household_id = v_household AND kind = 'wasted') THEN
    RAISE EXCEPTION 'ÉCHEC : annulation de la suppression de l''aliment entier';
  END IF;
  RAISE NOTICE 'OK : aliment entier retiré (compté lot par lot) puis rétabli';
END;
$$;

-- C, hors du foyer : ni ajout à un lot, ni fusion, ni suppression, ni historique
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000009cc", "role": "authenticated"}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.add_pantry_items(jsonb_build_array(jsonb_build_object('name', 'lait', 'quantity', '1 l',
      'merge_into', '00000000-0000-4000-b000-0000000009f1', 'expected_quantity', '1 l', 'merged_quantity', '2 l')));
    RAISE EXCEPTION 'ÉCHEC : C ajoute à un lot d''un autre foyer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'pantry_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.merge_lots('00000000-0000-4000-b000-0000000009f1', ARRAY['00000000-0000-4000-b000-0000000009f2']::uuid[], '2 l');
    RAISE EXCEPTION 'ÉCHEC : C fusionne des lots d''un autre foyer';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-0000000009f1']::uuid[]);
    RAISE EXCEPTION 'ÉCHEC : C retire des lots d''un autre foyer';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.pantry_history WHERE household_id = (SELECT value::uuid FROM ctx WHERE key = 'household')) THEN
    RAISE EXCEPTION 'ÉCHEC : historique lisible hors du foyer';
  END IF;
  RAISE NOTICE 'OK : hors du foyer, rien à ajouter, fusionner ni retirer ; historique illisible';
END;
$$;

ROLLBACK TO SAVEPOINT t; RESET ROLE;
ROLLBACK;
