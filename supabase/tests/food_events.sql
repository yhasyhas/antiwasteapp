-- Tests du compteur anti-gaspi : sauvé avec « J'ai cuisiné ça », gaspillé si supprimé après sa date,
-- rien sinon ; compteur du foyer et personnel ; aucune écriture directe.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/food_events.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-4000-a000-0000000009' || lpad(n::text, 2, '0'))::uuid, 'waste-test-' || n || '@example.com'
FROM generate_series(1, 3) AS n;
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users WHERE email LIKE 'waste-test-%@example.com';

CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('00000000-0000-4000-a000-0000000009' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.login(n integer) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION pg_temp.error_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_code text;
  v_stats jsonb;
  v_ids uuid[];
BEGIN
  PERFORM pg_temp.login(1);
  v_code := public.create_household_invite()->>'code';
  PERFORM pg_temp.login(2);
  PERFORM public.join_household(v_code, false);

  PERFORM pg_temp.login(1);
  INSERT INTO public.ingredients (user_id, name, expires_at) VALUES
    (pg_temp.u(1), 'tomates', current_date - 3),
    (pg_temp.u(1), 'riz', current_date + 30),
    (pg_temp.u(1), 'crème', current_date - 1),
    (pg_temp.u(1), 'pain', NULL),
    (pg_temp.u(1), 'lait', current_date + 2);

  -- 1 cuisine les tomates (périmées) et le riz : 2 sauvés, pas gaspillés
  SELECT array_agg(id) INTO v_ids FROM public.ingredients WHERE name IN ('tomates', 'riz');
  IF public.cook_ingredients(v_ids) <> 2 THEN RAISE EXCEPTION 'ÉCHEC : ingrédients cuisinés non retirés'; END IF;

  -- 2 jette la crème (périmée : gaspillée), le pain (sans date) et le lait (avant sa date) : rien
  PERFORM pg_temp.login(2);
  DELETE FROM public.ingredients WHERE name IN ('crème', 'pain', 'lait');

  v_stats := public.food_stats();
  IF (v_stats->'household'->>'saved')::int <> 2 OR (v_stats->'household'->>'wasted')::int <> 1
     OR (v_stats->'me'->>'saved')::int <> 0 OR (v_stats->'me'->>'wasted')::int <> 1 OR NOT (v_stats->>'shared')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC : compteur de 2 : %', v_stats;
  END IF;
  PERFORM pg_temp.login(1);
  v_stats := public.food_stats();
  IF (v_stats->'me'->>'saved')::int <> 2 OR (v_stats->'me'->>'wasted')::int <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : compteur personnel de 1 : %', v_stats;
  END IF;

  -- Écriture directe interdite ; 3, hors du foyer, ne voit rien et ne cuisine rien
  IF pg_temp.error_of('INSERT INTO public.food_events (household_id, kind, ingredient_name) VALUES (''' || (public.my_household()->>'id') || ''', ''saved'', ''x'')') !~ 'row-level security|permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : événement écrit directement';
  END IF;
  INSERT INTO public.ingredients (user_id, name) VALUES (pg_temp.u(1), 'beurre');
  PERFORM pg_temp.login(3);
  IF (SELECT count(*) FROM public.food_events) <> 0 THEN RAISE EXCEPTION 'ÉCHEC : un non-membre voit les événements du foyer'; END IF;
  SELECT array_agg(id) INTO v_ids FROM public.ingredients WHERE name = 'beurre';
  IF public.cook_ingredients(ARRAY(SELECT id FROM public.ingredients)) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : un non-membre retire des ingrédients du foyer';
  END IF;
  IF (public.food_stats()->'household'->>'saved')::int <> 0 THEN RAISE EXCEPTION 'ÉCHEC : compteur de 3 non vide'; END IF;
  RAISE NOTICE 'OK : sauvé avec « J''ai cuisiné ça », gaspillé seulement après la date, compteurs du foyer et personnels, aucune écriture directe ni accès hors du foyer';
END;
$$;

ROLLBACK;
