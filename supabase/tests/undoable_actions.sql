-- Tests des actions annulables (« Annuler » pendant 5 secondes) : « J'ai cuisiné ça » et suppressions
-- enregistrés tout de suite ; annulation tout ou rien (lignes rétablies à l'identique, quantités, compteur) ;
-- conflit si un autre membre a modifié ou retiré un aliment entre-temps (rien rétabli) ; une seule
-- annulation, par son auteur seulement, dans les 24 heures ; rien pour qui n'est pas du foyer.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/undoable_actions.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
SAVEPOINT t;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-0000000008aa', 'undo-a@example.com'),
  ('00000000-0000-4000-a000-0000000008bb', 'undo-b@example.com'),
  ('00000000-0000-4000-a000-0000000008cc', 'undo-c@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-0000000008aa', 'undo-a@example.com'),
  ('00000000-0000-4000-a000-0000000008bb', 'undo-b@example.com'),
  ('00000000-0000-4000-a000-0000000008cc', 'undo-c@example.com') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008aa", "role": "authenticated"}', true);
INSERT INTO ctx SELECT 'code', (public.create_household_invite())->>'code';
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008bb", "role": "authenticated"}', true);
SELECT public.join_household((SELECT value FROM ctx WHERE key = 'code'), false);
INSERT INTO ctx SELECT 'household', (public.my_household())->>'id';
RESET ROLE;

-- Garde-manger du foyer : œufs (4), riz (500 g), tomates (3), yaourt périmé ; courses : lait coché par B
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, expires_at) VALUES
  ('00000000-0000-4000-b000-0000000008e1', '00000000-0000-4000-a000-0000000008bb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'œufs', '4 œufs', current_date + 5),
  ('00000000-0000-4000-b000-0000000008e2', '00000000-0000-4000-a000-0000000008aa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'riz', '500 g', current_date + 30),
  ('00000000-0000-4000-b000-0000000008e3', '00000000-0000-4000-a000-0000000008aa', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'tomates', '3', current_date + 2),
  ('00000000-0000-4000-b000-0000000008e4', '00000000-0000-4000-a000-0000000008bb', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'yaourt', '1', current_date - 2);
INSERT INTO public.shopping_items (id, household_id, added_by, name, quantity, checked) VALUES
  ('00000000-0000-4000-c000-0000000008f1', (SELECT value::uuid FROM ctx WHERE key = 'household'), '00000000-0000-4000-a000-0000000008bb', 'Lait', '1 l', false);
-- Coché (le déclencheur note qui et quand), puis coché par B il y a une heure
UPDATE public.shopping_items SET checked = true WHERE id = '00000000-0000-4000-c000-0000000008f1';
UPDATE public.shopping_items SET checked_by = '00000000-0000-4000-a000-0000000008bb', checked_at = now() - interval '1 hour'
WHERE id = '00000000-0000-4000-c000-0000000008f1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008aa", "role": "authenticated"}', true);

DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
  v_before_rows jsonb := (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household);
  v_saved integer := (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved');
  v_action uuid;
  v_result text;
BEGIN
  -- 1. Cuisiné : tomates finies, œufs 4 → 2, riz 500 g → 300 g ; enregistré tout de suite
  v_action := public.cook_with_undo(ARRAY['00000000-0000-4000-b000-0000000008e3']::uuid[],
    '[{"id": "00000000-0000-4000-b000-0000000008e1", "quantity": "2 œufs"}, {"id": "00000000-0000-4000-b000-0000000008e2", "quantity": "300 g"}]');
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e3')
     OR (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e1') <> '2 œufs'
     OR (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved + 1 THEN
    RAISE EXCEPTION 'ÉCHEC : cuisiné mal enregistré';
  END IF;
  RAISE NOTICE 'OK : cuisiné enregistré tout de suite (retiré, reste mis à jour, compté sauvé)';

  -- Annulation : tout revient comme avant (lignes identiques, compteur)
  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone' THEN RAISE EXCEPTION 'ÉCHEC : annulation (%)', v_result; END IF;
  IF (SELECT jsonb_agg(to_jsonb(i.*) ORDER BY i.id) FROM public.ingredients i WHERE i.household_id = v_household) IS DISTINCT FROM v_before_rows THEN
    RAISE EXCEPTION 'ÉCHEC : garde-manger différent après annulation';
  END IF;
  IF (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved THEN
    RAISE EXCEPTION 'ÉCHEC : compteur non rétabli';
  END IF;
  RAISE NOTICE 'OK : annulation du cuisiné (aliment retiré rétabli à l''identique, quantités et compteur d''avant)';

  IF public.undo_pantry_action(v_action) <> 'already_undone' THEN RAISE EXCEPTION 'ÉCHEC : double annulation'; END IF;
  RAISE NOTICE 'OK : une seule annulation possible';

  -- 2. Aliment périmé retiré (compté gaspillé), puis annulé
  v_action := public.delete_ingredient_with_undo('00000000-0000-4000-b000-0000000008e4');
  IF NOT EXISTS (SELECT 1 FROM public.food_events WHERE ingredient_id = '00000000-0000-4000-b000-0000000008e4' AND kind = 'wasted') THEN
    RAISE EXCEPTION 'ÉCHEC : gaspillé non compté';
  END IF;
  -- Annulation d'abord : une même requête verrait l'état d'avant
  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone'
     OR NOT EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e4' AND user_id = '00000000-0000-4000-a000-0000000008bb')
     OR EXISTS (SELECT 1 FROM public.food_events WHERE ingredient_id = '00000000-0000-4000-b000-0000000008e4') THEN
    RAISE EXCEPTION 'ÉCHEC : annulation de la suppression';
  END IF;
  RAISE NOTICE 'OK : suppression annulée (aliment de B rétabli avec son auteur, « gaspillé » retiré du compteur)';

  -- 3. Article de courses de B, coché par B, retiré par A puis annulé
  v_action := public.delete_shopping_item_with_undo('00000000-0000-4000-c000-0000000008f1');
  IF EXISTS (SELECT 1 FROM public.shopping_items WHERE id = '00000000-0000-4000-c000-0000000008f1') THEN RAISE EXCEPTION 'ÉCHEC : article non retiré'; END IF;
  -- Annulation d'abord : une même requête verrait l'état d'avant
  v_result := public.undo_pantry_action(v_action);
  IF v_result <> 'undone'
     OR NOT EXISTS (SELECT 1 FROM public.shopping_items WHERE id = '00000000-0000-4000-c000-0000000008f1'
                    AND added_by = '00000000-0000-4000-a000-0000000008bb' AND checked AND checked_by = '00000000-0000-4000-a000-0000000008bb'
                    AND checked_at < now() - interval '50 minutes') THEN
    RAISE EXCEPTION 'ÉCHEC : article mal rétabli';
  END IF;
  RAISE NOTICE 'OK : article de courses rétabli (auteur, coché par B, heure d''origine)';

  -- 4. Préparation du cas concurrent : A cuisine (œufs 4 → 1, tomates finies)
  v_action := public.cook_with_undo(ARRAY['00000000-0000-4000-b000-0000000008e3']::uuid[], '[{"id": "00000000-0000-4000-b000-0000000008e1", "quantity": "1 œuf"}]');
  INSERT INTO ctx VALUES ('concurrent', v_action::text);
END;
$$;

-- B modifie les œufs entre-temps
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008bb", "role": "authenticated"}', true);
UPDATE public.ingredients SET quantity = '6 œufs' WHERE id = '00000000-0000-4000-b000-0000000008e1';
DO $$
BEGIN
  -- B ne peut pas annuler l'action de A
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'concurrent')) <> 'not_found' THEN RAISE EXCEPTION 'ÉCHEC : B annule l''action de A'; END IF;
  RAISE NOTICE 'OK : seul l''auteur peut annuler son action';
END;
$$;

SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008aa", "role": "authenticated"}', true);
DO $$
DECLARE
  v_household uuid := (SELECT value::uuid FROM ctx WHERE key = 'household');
  v_saved integer := (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved');
BEGIN
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'concurrent')) <> 'conflict' THEN RAISE EXCEPTION 'ÉCHEC : conflit non détecté'; END IF;
  IF (SELECT quantity FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e1') <> '6 œufs' THEN RAISE EXCEPTION 'ÉCHEC : changement de B écrasé'; END IF;
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e3') THEN RAISE EXCEPTION 'ÉCHEC : annulation partielle (tomates rétablies)'; END IF;
  IF (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved') <> v_saved THEN RAISE EXCEPTION 'ÉCHEC : compteur modifié malgré le conflit'; END IF;
  RAISE NOTICE 'OK : modification concurrente de B : conflit, rien rétabli (changement de B gardé, tout ou rien)';
END;
$$;

-- Aliment modifié puis retiré par B : conflit aussi
DO $$
DECLARE
  v_action uuid := public.cook_with_undo('{}', '[{"id": "00000000-0000-4000-b000-0000000008e2", "quantity": "100 g"}]');
BEGIN
  INSERT INTO ctx VALUES ('removed', v_action::text);
END;
$$;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008bb", "role": "authenticated"}', true);
DELETE FROM public.ingredients WHERE id = '00000000-0000-4000-b000-0000000008e2';
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008aa", "role": "authenticated"}', true);
DO $$
BEGIN
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'removed')) <> 'conflict' THEN RAISE EXCEPTION 'ÉCHEC : aliment retiré par B non détecté'; END IF;
  RAISE NOTICE 'OK : aliment retiré entre-temps par B : conflit';
END;
$$;

-- Hors délai (plus de 24 heures)
DO $$
DECLARE
  v_action uuid := public.delete_ingredient_with_undo('00000000-0000-4000-b000-0000000008e4');
BEGIN
  INSERT INTO ctx VALUES ('late', v_action::text);
END;
$$;
RESET ROLE;
UPDATE public.pantry_actions SET created_at = now() - interval '25 hours' WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'late');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008aa", "role": "authenticated"}', true);
DO $$
BEGIN
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'late')) <> 'expired' THEN RAISE EXCEPTION 'ÉCHEC : délai'; END IF;
  RAISE NOTICE 'OK : annulation refusée après le délai';
END;
$$;

-- C, hors du foyer : ni suppression ni lecture des actions
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-0000000008cc", "role": "authenticated"}', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_ingredient_with_undo('00000000-0000-4000-b000-0000000008e1');
    RAISE EXCEPTION 'ÉCHEC : C retire un aliment d''un autre foyer';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.pantry_actions) THEN RAISE EXCEPTION 'ÉCHEC : actions lisibles'; END IF;
  IF public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'late')) <> 'not_found' THEN RAISE EXCEPTION 'ÉCHEC : C annule'; END IF;
  RAISE NOTICE 'OK : hors du foyer, rien à retirer ni à annuler ; table des actions illisible';
END;
$$;

ROLLBACK TO SAVEPOINT t; RESET ROLE;
ROLLBACK;
