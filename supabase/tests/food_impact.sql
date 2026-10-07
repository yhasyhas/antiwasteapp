-- Tests de « Mon impact » (food_impact) : 6 mois du foyer et personnels, aliments les plus gaspillés regroupés par
-- fiche (identifiant de l'aliment ou alias du nom) avec le conseil de la fiche dans la langue demandée, rien pour un
-- non-membre, pas d'accès anonyme.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/food_impact.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-4000-a000-0000000012' || lpad(n::text, 2, '0'))::uuid, 'impact-test-' || n || '@example.com'
FROM generate_series(1, 3) AS n;
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users WHERE email LIKE 'impact-test-%@example.com';
INSERT INTO public.food_facts (food_key, status, content, aliases) VALUES ('zz_test_cream', 'ready', '{
  "fr": {"name": "Crème test", "tips": ["Garder la crème au frais, bien fermée."]},
  "en": {"name": "Test cream", "tips": ["Keep cream cold and closed."]},
  "es": {"name": "Nata de prueba", "tips": ["Guarda la nata en frío."]}
}', ARRAY['creme test', 'test cream']);

CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('00000000-0000-4000-a000-0000000012' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.login(n integer) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_code text;
  v_ids uuid[];
BEGIN
  PERFORM pg_temp.login(1);
  v_code := public.create_household_invite()->>'code';
  PERFORM pg_temp.login(2);
  PERFORM public.join_household(v_code, false);

  PERFORM pg_temp.login(1);
  INSERT INTO public.ingredients (user_id, name, expires_at, food_key) VALUES
    (pg_temp.u(1), 'Crème test', current_date - 2, 'zz_test_cream'),
    (pg_temp.u(1), 'crème TEST', current_date - 1, NULL),
    (pg_temp.u(1), 'Zzpommes', current_date - 1, NULL),
    (pg_temp.u(1), 'Riz', current_date + 30, NULL);
  SELECT array_agg(id) INTO v_ids FROM public.ingredients WHERE name = 'Riz';
  PERFORM public.cook_ingredients(v_ids);
  -- 2 jette les trois aliments périmés
  PERFORM pg_temp.login(2);
  DELETE FROM public.ingredients WHERE name IN ('Crème test', 'crème TEST', 'Zzpommes');
END $$;
RESET ROLE;

-- Événements plus anciens du foyer : il y a 3 mois (compté), il y a 7 mois (hors période)
INSERT INTO public.food_events (household_id, user_id, kind, ingredient_name, created_at)
SELECT e.household_id, pg_temp.u(1), 'wasted', name, now() - age
FROM (SELECT household_id FROM public.food_events WHERE ingredient_name = 'Zzpommes' LIMIT 1) e,
     (VALUES ('Zzcarottes', interval '3 months'), ('Zzpommes', interval '7 months')) AS old(name, age);

DO $$
DECLARE
  v_key text;
BEGIN
  -- 1. Identifiant de la fiche gardé avec l'événement
  SELECT food_key INTO v_key FROM public.food_events WHERE ingredient_name = 'Crème test';
  IF v_key IS DISTINCT FROM 'zz_test_cream' THEN RAISE EXCEPTION 'ÉCHEC : fiche non gardée avec l''événement (%)', v_key; END IF;
  IF public.food_alias(' Crème  TEST! ') <> 'creme test' THEN RAISE EXCEPTION 'ÉCHEC : nom normalisé : %', public.food_alias(' Crème  TEST! '); END IF;
  RAISE NOTICE 'OK 1 : fiche gardée avec l''événement, nom normalisé comme les alias';
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v jsonb;
  v_months jsonb;
  v_top jsonb;
BEGIN
  PERFORM pg_temp.login(2);
  v := public.food_impact('en');
  v_months := v->'months';
  -- 2. Six mois, du plus récent au plus ancien ; ce mois-ci : foyer 1 sauvé, 3 gaspillés ; 2 : 3 gaspillés
  IF jsonb_array_length(v_months) <> 6 OR v_months->0->>'month' <> to_char(now() AT TIME ZONE 'utc', 'YYYY-MM') THEN
    RAISE EXCEPTION 'ÉCHEC : mois : %', v_months;
  END IF;
  IF (v_months->0->'household'->>'saved')::int <> 1 OR (v_months->0->'household'->>'wasted')::int <> 3
     OR (v_months->0->'me'->>'saved')::int <> 0 OR (v_months->0->'me'->>'wasted')::int <> 3 OR NOT (v->>'shared')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC : ce mois-ci : %', v_months->0;
  END IF;
  IF (v_months->3->'household'->>'wasted')::int <> 1 THEN RAISE EXCEPTION 'ÉCHEC : il y a 3 mois : %', v_months->3; END IF;
  RAISE NOTICE 'OK 2 : six mois, foyer et personnel';

  -- 3. Les plus gaspillés : la crème (2, regroupée par fiche et par alias) avec son nom et son conseil en anglais,
  --    puis deux aliments sans fiche (le plus récent d'abord) ; rien au-delà de 6 mois
  v_top := v->'top_wasted';
  IF jsonb_array_length(v_top) <> 3
     OR v_top->0->>'name' <> 'Test cream' OR (v_top->0->>'count')::int <> 2 OR v_top->0->>'tip' <> 'Keep cream cold and closed.'
     OR v_top->1->>'name' <> 'Zzpommes' OR (v_top->1->>'count')::int <> 1 OR v_top->1->'tip' <> 'null'::jsonb
     OR v_top->2->>'name' <> 'Zzcarottes' THEN
    RAISE EXCEPTION 'ÉCHEC : les plus gaspillés : %', v_top;
  END IF;
  IF public.food_impact('es')->'top_wasted'->0->>'tip' <> 'Guarda la nata en frío.' THEN RAISE EXCEPTION 'ÉCHEC : conseil en espagnol'; END IF;
  IF public.food_impact('de')->'top_wasted'->0->>'name' <> 'Crème test' THEN RAISE EXCEPTION 'ÉCHEC : langue inconnue : français attendu'; END IF;
  RAISE NOTICE 'OK 3 : les plus gaspillés, regroupés, avec le conseil de la fiche dans la langue demandée';

  -- 4. Hors du foyer : rien
  PERFORM pg_temp.login(3);
  v := public.food_impact('fr');
  IF (v->'months'->0->'household'->>'wasted')::int <> 0 OR jsonb_array_length(v->'top_wasted') <> 0 OR (v->>'shared')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC : un non-membre voit l''impact du foyer : %', v;
  END IF;
  RAISE NOTICE 'OK 4 : rien pour un non-membre';
END $$;
RESET ROLE;

DO $$
BEGIN
  -- 5. Pas d'accès anonyme
  IF has_function_privilege('anon', 'public.food_impact(text)', 'execute') THEN RAISE EXCEPTION 'ÉCHEC : appel anonyme possible'; END IF;
  RAISE NOTICE 'OK 5 : pas d''accès anonyme';
END $$;

ROLLBACK;
