-- Tests de la phase 8 : emplacement et type de date par défaut, congélation à l'ajout, compteur (date
-- indicative, congélateur), résumé quotidien (interrupteur, heure, lots exclus), « J'ai cuisiné ça » lié à une
-- recette, et correction (modify_cook_action) : quantités remplacées en une opération, conflit si un autre
-- membre a changé un lot, auteur seulement, 24 heures, une seule fois.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/phase8_pantry.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000e0a', 'p8-a@example.com'),
  ('00000000-0000-4000-a000-000000000e0b', 'p8-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-000000000e0a', 'p8-a@example.com'),
  ('00000000-0000-4000-a000-000000000e0b', 'p8-b@example.com') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated, service_role;
CREATE FUNCTION pg_temp.login(p_user text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION pg_temp.qty(p_id text) RETURNS text LANGUAGE sql AS
  $$ SELECT quantity FROM public.ingredients WHERE id = p_id::uuid $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, service_role;

-- Foyer partagé A + B
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
INSERT INTO ctx SELECT 'code', (public.create_household_invite())->>'code';
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0b');
SELECT public.join_household((SELECT value FROM ctx WHERE key = 'code'), false);
INSERT INTO ctx SELECT 'household', (public.my_household())->>'id';
RESET ROLE;

-- 1. Valeurs par défaut et congélation à l'ajout
DO $$
BEGIN
  IF public.default_location('vegetable', 'ingredient', 'tomato') <> 'pantry'
     OR public.default_location('vegetable', 'ingredient', 'carrot') <> 'fridge'
     OR public.default_location('fruit', 'ingredient', 'strawberry') <> 'fridge'
     OR public.default_location('fruit', 'ingredient', 'banana') <> 'pantry'
     OR public.default_location('frozen', 'ingredient', NULL) <> 'freezer'
     OR public.default_location('grain', 'ingredient', 'rice') <> 'pantry'
     OR public.default_location(NULL, 'dish', NULL) <> 'fridge'
     OR public.default_location(NULL, 'ingredient', NULL) <> 'fridge' THEN
    RAISE EXCEPTION 'ÉCHEC : emplacements par défaut';
  END IF;
  IF public.default_date_kind('grain', 'ingredient') <> 'best_before'
     OR public.default_date_kind('egg', 'ingredient') <> 'best_before'
     OR public.default_date_kind('dairy', 'ingredient') <> 'use_by'
     OR public.default_date_kind('fruit', 'ingredient') <> 'use_by'
     OR public.default_date_kind(NULL, 'dish') <> 'use_by' THEN
    RAISE EXCEPTION 'ÉCHEC : types de date par défaut';
  END IF;
  RAISE NOTICE 'OK 1 : emplacements et types de date par défaut';
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
SELECT public.add_pantry_items('[
  {"name": "Riz", "quantity": "500 g", "category": "grain", "food_key": "rice", "expires_at": null},
  {"name": "Carottes", "quantity": "4", "category": "vegetable", "food_key": "carrot", "expires_at": null},
  {"name": "Poulet", "quantity": "2", "category": "meat", "location": "freezer", "date_kind": "best_before", "expires_at": null}
]'::jsonb);
RESET ROLE;
DO $$
DECLARE
  v_rice public.ingredients;
  v_carrot public.ingredients;
  v_chicken public.ingredients;
BEGIN
  SELECT * INTO v_rice FROM public.ingredients WHERE name = 'Riz' AND household_id = (SELECT value::uuid FROM ctx WHERE key = 'household');
  SELECT * INTO v_carrot FROM public.ingredients WHERE name = 'Carottes' AND household_id = (SELECT value::uuid FROM ctx WHERE key = 'household');
  SELECT * INTO v_chicken FROM public.ingredients WHERE name = 'Poulet' AND household_id = (SELECT value::uuid FROM ctx WHERE key = 'household');
  IF v_rice.location <> 'pantry' OR v_rice.date_kind <> 'best_before' OR v_rice.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : riz (% / %)', v_rice.location, v_rice.date_kind;
  END IF;
  IF v_carrot.location <> 'fridge' OR v_carrot.date_kind <> 'use_by' THEN
    RAISE EXCEPTION 'ÉCHEC : carottes (% / %)', v_carrot.location, v_carrot.date_kind;
  END IF;
  IF v_chicken.location <> 'freezer' OR v_chicken.date_kind <> 'best_before' OR v_chicken.frozen_at IS DISTINCT FROM current_date THEN
    RAISE EXCEPTION 'ÉCHEC : poulet congelé (% / % / %)', v_chicken.location, v_chicken.date_kind, v_chicken.frozen_at;
  END IF;
  RAISE NOTICE 'OK 2 : ajout avec emplacement et type de date (donnés ou par défaut), date de congélation';
END $$;

-- 2. Compteur : date indicative passée ou congélateur : pas « gaspillé » ; date stricte passée : « gaspillé »
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, expires_at, location, date_kind) VALUES
  ('00000000-0000-4000-b000-000000000e11', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'pâtes', '500 g', current_date - 10, 'pantry', 'best_before'),
  ('00000000-0000-4000-b000-000000000e12', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'steak', '1', current_date - 3, 'freezer', 'use_by'),
  ('00000000-0000-4000-b000-000000000e13', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'yaourt', '2', current_date - 1, 'fridge', 'use_by'),
  ('00000000-0000-4000-b000-000000000e14', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'crème', '20 cl', current_date - 1, NULL, NULL);
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
SELECT public.delete_ingredients_with_undo(ARRAY['00000000-0000-4000-b000-000000000e11', '00000000-0000-4000-b000-000000000e12',
  '00000000-0000-4000-b000-000000000e13', '00000000-0000-4000-b000-000000000e14']::uuid[]);
RESET ROLE;
DO $$
DECLARE
  v_wasted text[] := ARRAY(SELECT ingredient_name FROM public.food_events
    WHERE household_id = (SELECT value::uuid FROM ctx WHERE key = 'household') AND kind = 'wasted' ORDER BY ingredient_name);
BEGIN
  IF v_wasted IS DISTINCT FROM ARRAY['crème', 'yaourt'] THEN
    RAISE EXCEPTION 'ÉCHEC : gaspillés (%)', v_wasted;
  END IF;
  RAISE NOTICE 'OK 3 : compteur : date indicative ou congélateur jamais « gaspillé », date stricte (ou inconnue) oui';
END $$;

-- 3. Résumé quotidien : interrupteur, heure choisie, lots à date indicative ou au congélateur exclus
INSERT INTO ctx
SELECT 'tz', tz FROM (VALUES ('UTC'), ('Europe/Paris'), ('America/New_York'), ('Asia/Tokyo'), ('Asia/Kolkata'), ('Pacific/Honolulu'), ('Australia/Sydney')) AS z(tz)
WHERE extract(hour FROM now() AT TIME ZONE tz) BETWEEN 6 AND 19
LIMIT 1;
INSERT INTO public.push_tokens (token, user_id, platform, timezone) VALUES
  ('ExponentPushToken[p8testtokenAAAA]', '00000000-0000-4000-a000-000000000e0a', 'android', (SELECT value FROM ctx WHERE key = 'tz')),
  ('ExponentPushToken[p8testtokenBBBB]', '00000000-0000-4000-a000-000000000e0b', 'android', (SELECT value FROM ctx WHERE key = 'tz'));
UPDATE public.profiles SET digest_hour = extract(hour FROM now() AT TIME ZONE (SELECT value FROM ctx WHERE key = 'tz'))::smallint - 1
WHERE id = '00000000-0000-4000-a000-000000000e0a';
UPDATE public.profiles SET digest_enabled = false WHERE id = '00000000-0000-4000-a000-000000000e0b';
INSERT INTO public.ingredients (user_id, household_id, name, quantity, expires_at, location, date_kind)
SELECT '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), n, '1',
       (now() AT TIME ZONE (SELECT value FROM ctx WHERE key = 'tz'))::date + d, l, k
FROM (VALUES ('lait', 0, 'fridge', 'use_by'), ('biscuits', 0, 'pantry', 'best_before'), ('glace', 1, 'freezer', 'use_by'), ('jambon', 1, 'fridge', NULL)) AS v(n, d, l, k);
SET LOCAL ROLE service_role;
INSERT INTO ctx SELECT 'digests', jsonb_agg(to_jsonb(d.*))::text FROM public.claim_daily_digests(9, NULL, false) AS d
  WHERE d.user_id IN ('00000000-0000-4000-a000-000000000e0a', '00000000-0000-4000-a000-000000000e0b');
RESET ROLE;
DO $$
DECLARE
  v_digests jsonb := coalesce((SELECT value FROM ctx WHERE key = 'digests')::jsonb, '[]');
BEGIN
  IF jsonb_array_length(v_digests) <> 1 OR v_digests->0->>'user_id' <> '00000000-0000-4000-a000-000000000e0a' THEN
    RAISE EXCEPTION 'ÉCHEC : résumés dus (%) — B l''a désactivé, A l''a réglé il y a 1 heure', v_digests;
  END IF;
  IF (SELECT array_agg(x->>'name' ORDER BY x->>'name') FROM jsonb_array_elements(v_digests->0->'today') AS x) IS DISTINCT FROM ARRAY['lait']
     OR (SELECT array_agg(x->>'name' ORDER BY x->>'name') FROM jsonb_array_elements(v_digests->0->'tomorrow') AS x) IS DISTINCT FROM ARRAY['jambon'] THEN
    RAISE EXCEPTION 'ÉCHEC : contenu du résumé (%)', v_digests->0;
  END IF;
  RAISE NOTICE 'OK 4 : résumé : heure choisie, interrupteur respecté, dates indicatives et congélateur exclus';
END $$;
-- Heure pas encore venue : rien
UPDATE public.profiles SET digest_hour = least(22, extract(hour FROM now() AT TIME ZONE (SELECT value FROM ctx WHERE key = 'tz'))::smallint + 1)
WHERE id = '00000000-0000-4000-a000-000000000e0a';
DELETE FROM public.daily_digests WHERE user_id = '00000000-0000-4000-a000-000000000e0a';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.claim_daily_digests(9, '00000000-0000-4000-a000-000000000e0a', false)) THEN
    RAISE EXCEPTION 'ÉCHEC : résumé envoyé avant l''heure choisie';
  END IF;
  RAISE NOTICE 'OK 5 : résumé pas envoyé avant l''heure choisie';
END $$;

-- 4. « J'ai cuisiné ça » lié à une recette, puis correction
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, expires_at) VALUES
  ('00000000-0000-4000-b000-000000000e21', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'tomates', '4', current_date + 3),
  ('00000000-0000-4000-b000-000000000e22', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'riz au poulet', '1 portion', current_date + 1),
  ('00000000-0000-4000-b000-000000000e23', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'oignon', '2', current_date + 9);
INSERT INTO public.recipes (id, user_id, title, ingredients_used, instructions, last_cooked_at) VALUES
  ('00000000-0000-4000-c000-000000000e30', '00000000-0000-4000-a000-000000000e0a', 'Riz sauté', '[]', '[]', now() - interval '10 days');
INSERT INTO ctx VALUES ('prev_cooked', (SELECT last_cooked_at::text FROM public.recipes WHERE id = '00000000-0000-4000-c000-000000000e30'));

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
-- Premier repas : tomates 4 → 3, riz au poulet fini
INSERT INTO ctx VALUES ('cook1', public.cook_with_undo(ARRAY['00000000-0000-4000-b000-000000000e22']::uuid[],
  '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "3"}]', '00000000-0000-4000-c000-000000000e30',
  '{"used": {"tomates": 1}}')::text);
RESET ROLE;
DO $$
DECLARE
  v_last record;
BEGIN
  IF pg_temp.qty('00000000-0000-4000-b000-000000000e21') <> '3' OR pg_temp.qty('00000000-0000-4000-b000-000000000e22') IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : premier repas (tomates %, riz %)', pg_temp.qty('00000000-0000-4000-b000-000000000e21'), pg_temp.qty('00000000-0000-4000-b000-000000000e22');
  END IF;
  IF (SELECT last_cooked_at FROM public.recipes WHERE id = '00000000-0000-4000-c000-000000000e30') < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'ÉCHEC : date du repas non enregistrée';
  END IF;
  PERFORM set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000e0a", "role": "authenticated"}', true);
  SELECT * INTO v_last FROM public.last_cook_action('00000000-0000-4000-c000-000000000e30');
  IF v_last.id::text <> (SELECT value FROM ctx WHERE key = 'cook1') OR v_last.inputs->'used'->>'tomates' <> '1'
     OR jsonb_array_length(v_last.removed) <> 1 OR v_last.updated->0->'before'->>'quantity' <> '4' OR v_last.updated->0->'after'->>'quantity' <> '3' THEN
    RAISE EXCEPTION 'ÉCHEC : dernière action (%)', to_jsonb(v_last);
  END IF;
  RAISE NOTICE 'OK 6 : repas lié à la recette : date enregistrée, dernière action avec avant, après et quantités saisies';
END $$;

-- B ne voit pas l'action de A ; B ne peut pas la corriger
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0b');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.last_cook_action('00000000-0000-4000-c000-000000000e30')) THEN
    RAISE EXCEPTION 'ÉCHEC : B voit la dernière action de A';
  END IF;
  IF public.modify_cook_action((SELECT value::uuid FROM ctx WHERE key = 'cook1'), '{}', '[]')->>'status' <> 'not_found' THEN
    RAISE EXCEPTION 'ÉCHEC : B corrige l''action de A';
  END IF;
  RAISE NOTICE 'OK 7 : correction réservée à l''auteur';
END $$;

-- Correction par A : en fait tomates 4 → 1, riz au poulet fini, et l'oignon fini aussi
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
INSERT INTO ctx SELECT 'modify1', public.modify_cook_action((SELECT value::uuid FROM ctx WHERE key = 'cook1'),
  ARRAY['00000000-0000-4000-b000-000000000e22', '00000000-0000-4000-b000-000000000e23']::uuid[],
  '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "1"}]', '{"used": {"tomates": 3}}')::text;
RESET ROLE;
DO $$
DECLARE
  v_result jsonb := (SELECT value FROM ctx WHERE key = 'modify1')::jsonb;
  v_old public.pantry_actions;
  v_saved integer;
BEGIN
  IF v_result->>'status' <> 'modified' THEN RAISE EXCEPTION 'ÉCHEC : correction (%)', v_result; END IF;
  IF pg_temp.qty('00000000-0000-4000-b000-000000000e21') <> '1' OR pg_temp.qty('00000000-0000-4000-b000-000000000e22') IS NOT NULL
     OR pg_temp.qty('00000000-0000-4000-b000-000000000e23') IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : quantités après correction (tomates %)', pg_temp.qty('00000000-0000-4000-b000-000000000e21');
  END IF;
  SELECT * INTO v_old FROM public.pantry_actions WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'cook1');
  IF v_old.undone_at IS NULL OR v_old.replaced_by::text <> v_result->>'action_id' THEN
    RAISE EXCEPTION 'ÉCHEC : ancienne action (annulée %, remplacée par %)', v_old.undone_at, v_old.replaced_by;
  END IF;
  -- Compteur : riz au poulet et oignon sauvés, une fois chacun
  SELECT count(*) INTO v_saved FROM public.food_events
  WHERE household_id = (SELECT value::uuid FROM ctx WHERE key = 'household') AND kind = 'saved';
  IF v_saved <> 2 THEN RAISE EXCEPTION 'ÉCHEC : aliments sauvés après correction (%)', v_saved; END IF;
  -- La recette garde la date du premier repas
  IF (SELECT last_cooked_at FROM public.recipes WHERE id = '00000000-0000-4000-c000-000000000e30') IS DISTINCT FROM v_old.created_at THEN
    RAISE EXCEPTION 'ÉCHEC : date du repas après correction';
  END IF;
  -- Historique : seulement la nouvelle action
  IF EXISTS (SELECT 1 FROM public.pantry_history WHERE action_id = v_old.id) THEN
    RAISE EXCEPTION 'ÉCHEC : historique de l''action corrigée';
  END IF;
  RAISE NOTICE 'OK 8 : correction en une opération : quantités remplacées, ancienne action annulée et reliée, compteur juste';
END $$;

-- Ancienne action : ni annulable ni corrigeable une seconde fois ; la nouvelle est la dernière action
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
DO $$
BEGIN
  IF public.modify_cook_action((SELECT value::uuid FROM ctx WHERE key = 'cook1'), '{}', '[]')->>'status' <> 'already_undone'
     OR public.undo_pantry_action((SELECT value::uuid FROM ctx WHERE key = 'cook1')) <> 'already_undone' THEN
    RAISE EXCEPTION 'ÉCHEC : ancienne action encore modifiable';
  END IF;
  IF (SELECT id::text FROM public.last_cook_action('00000000-0000-4000-c000-000000000e30'))
     IS DISTINCT FROM ((SELECT value FROM ctx WHERE key = 'modify1')::jsonb->>'action_id') THEN
    RAISE EXCEPTION 'ÉCHEC : dernière action après correction';
  END IF;
  RAISE NOTICE 'OK 9 : action corrigée remplacée : une seule fois, la nouvelle devient la dernière';
END $$;

-- Conflit : B change les tomates entamées, puis A corrige : rien ne change
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0b');
UPDATE public.ingredients SET quantity = '5' WHERE id = '00000000-0000-4000-b000-000000000e21';
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
INSERT INTO ctx SELECT 'modify2', public.modify_cook_action(((SELECT value FROM ctx WHERE key = 'modify1')::jsonb->>'action_id')::uuid,
  ARRAY['00000000-0000-4000-b000-000000000e22']::uuid[], '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "2"}]')::text;
RESET ROLE;
DO $$
DECLARE
  v_second public.pantry_actions;
BEGIN
  IF (SELECT value FROM ctx WHERE key = 'modify2')::jsonb->>'status' <> 'conflict' THEN
    RAISE EXCEPTION 'ÉCHEC : conflit non signalé (%)', (SELECT value FROM ctx WHERE key = 'modify2');
  END IF;
  SELECT * INTO v_second FROM public.pantry_actions WHERE id = ((SELECT value FROM ctx WHERE key = 'modify1')::jsonb->>'action_id')::uuid;
  IF pg_temp.qty('00000000-0000-4000-b000-000000000e21') <> '5' OR pg_temp.qty('00000000-0000-4000-b000-000000000e22') IS NOT NULL
     OR v_second.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : conflit : quelque chose a changé (tomates %, action annulée %)', pg_temp.qty('00000000-0000-4000-b000-000000000e21'), v_second.undone_at;
  END IF;
  RAISE NOTICE 'OK 10 : conflit : correction refusée, rien ne change (le changement de B est gardé)';
END $$;

-- Correction vide (« rien utilisé ») : action seulement annulée, date du repas d'avant rétablie
UPDATE public.ingredients SET quantity = '1' WHERE id = '00000000-0000-4000-b000-000000000e21';
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
INSERT INTO ctx SELECT 'modify3', public.modify_cook_action(((SELECT value FROM ctx WHERE key = 'modify1')::jsonb->>'action_id')::uuid, '{}', '[]')::text;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT value FROM ctx WHERE key = 'modify3')::jsonb->>'status' <> 'undone' THEN
    RAISE EXCEPTION 'ÉCHEC : correction vide (%)', (SELECT value FROM ctx WHERE key = 'modify3');
  END IF;
  IF pg_temp.qty('00000000-0000-4000-b000-000000000e21') <> '4' OR pg_temp.qty('00000000-0000-4000-b000-000000000e22') <> '1 portion'
     OR pg_temp.qty('00000000-0000-4000-b000-000000000e23') <> '2' THEN
    RAISE EXCEPTION 'ÉCHEC : garde-manger après correction vide (tomates %)', pg_temp.qty('00000000-0000-4000-b000-000000000e21');
  END IF;
  IF (SELECT last_cooked_at::text FROM public.recipes WHERE id = '00000000-0000-4000-c000-000000000e30') IS DISTINCT FROM (SELECT value FROM ctx WHERE key = 'prev_cooked') THEN
    RAISE EXCEPTION 'ÉCHEC : date du repas d''avant non rétablie';
  END IF;
  IF EXISTS (SELECT 1 FROM public.food_events WHERE ingredient_id IN ('00000000-0000-4000-b000-000000000e22', '00000000-0000-4000-b000-000000000e23')) THEN
    RAISE EXCEPTION 'ÉCHEC : aliments encore comptés sauvés';
  END IF;
  RAISE NOTICE 'OK 11 : correction vide : repas annulé, garde-manger et date du repas d''avant rétablis';
END $$;

-- Plus de 24 heures : correction refusée ; deuxième vrai repas : nouvelle action, date mise à jour
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
INSERT INTO ctx VALUES ('cook2', public.cook_with_undo('{}', '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "2"}]',
  '00000000-0000-4000-c000-000000000e30')::text);
RESET ROLE;
UPDATE public.pantry_actions SET created_at = now() - interval '25 hours' WHERE id = (SELECT value::uuid FROM ctx WHERE key = 'cook2');
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
DO $$
BEGIN
  IF public.modify_cook_action((SELECT value::uuid FROM ctx WHERE key = 'cook2'), '{}', '[]')->>'status' <> 'expired' THEN
    RAISE EXCEPTION 'ÉCHEC : correction après 24 heures';
  END IF;
  IF EXISTS (SELECT 1 FROM public.last_cook_action('00000000-0000-4000-c000-000000000e30')) THEN
    RAISE EXCEPTION 'ÉCHEC : action de plus de 24 heures encore proposée';
  END IF;
  PERFORM public.cook_with_undo('{}', '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "1"}]', '00000000-0000-4000-c000-000000000e30');
  IF (SELECT count(*) FROM public.last_cook_action('00000000-0000-4000-c000-000000000e30')) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : deuxième repas';
  END IF;
  RAISE NOTICE 'OK 12 : correction limitée à 24 heures ; deuxième repas enregistré comme une nouvelle action';
END $$;
RESET ROLE;

-- Ajout direct (liste de courses, versions précédentes) : emplacement et type de date par défaut
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, category, kind, food_key) VALUES
  ('00000000-0000-4000-b000-000000000e41', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'Lentilles', '500 g', 'legume', 'ingredient', 'lentil'),
  ('00000000-0000-4000-b000-000000000e42', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'Petits pois', '1', 'frozen', 'ingredient', NULL),
  ('00000000-0000-4000-b000-000000000e43', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'Jambon', '4', 'meat', 'ingredient', NULL);
INSERT INTO public.ingredients (id, user_id, household_id, name, quantity, location, date_kind) VALUES
  ('00000000-0000-4000-b000-000000000e44', '00000000-0000-4000-a000-000000000e0a', (SELECT value::uuid FROM ctx WHERE key = 'household'), 'Soupe', '1', 'pantry', 'best_before');
DO $$
BEGIN
  IF (SELECT location || '/' || date_kind FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000e41') <> 'pantry/best_before'
     OR (SELECT location || '/' || date_kind || '/' || (frozen_at = current_date)::text FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000e42') <> 'freezer/best_before/true'
     OR (SELECT location || '/' || date_kind FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000e43') <> 'fridge/use_by'
     OR (SELECT location || '/' || date_kind FROM public.ingredients WHERE id = '00000000-0000-4000-b000-000000000e44') <> 'pantry/best_before' THEN
    RAISE EXCEPTION 'ÉCHEC : valeurs par défaut à l''ajout direct';
  END IF;
  RAISE NOTICE 'OK 14 : ajout direct : emplacement et type de date par défaut (valeurs données gardées), date de congélation';
END $$;

-- Appel à deux paramètres (versions précédentes de l'app) toujours accepté
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000e0a');
DO $$
BEGIN
  PERFORM public.cook_with_undo(p_ids => '{}'::uuid[], p_leftovers => '[{"id": "00000000-0000-4000-b000-000000000e21", "quantity": "1"}]'::jsonb);
  RAISE NOTICE 'OK 13 : « J''ai cuisiné ça » des versions précédentes de l''app accepté';
END $$;
RESET ROLE;

ROLLBACK;
