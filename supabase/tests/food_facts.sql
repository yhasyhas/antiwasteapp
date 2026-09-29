-- Tests des fiches aliments : réservation (une seule génération), lecture des seules fiches prêtes,
-- écriture réservée aux fonctions, signalements, quota des fiches, identifiant sur le garde-manger.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/food_facts.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000c01', 'facts-test-a@example.com'),
  ('00000000-0000-4000-a000-000000000c02', 'facts-test-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-000000000c01', 'facts-test-a@example.com'),
  ('00000000-0000-4000-a000-000000000c02', 'facts-test-b@example.com');

CREATE FUNCTION pg_temp.error_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, service_role;

-- 1. Fonctions (clé secrète) : réservation, enregistrement, alias, quota
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF NOT public.claim_food_fact('test_zz_banana') THEN RAISE EXCEPTION 'ÉCHEC : première réservation refusée'; END IF;
  IF public.claim_food_fact('test_zz_banana') THEN RAISE EXCEPTION 'ÉCHEC : deuxième génération simultanée'; END IF;
  UPDATE public.food_facts SET claimed_at = now() - interval '3 minutes' WHERE food_key = 'test_zz_banana';
  IF NOT public.claim_food_fact('test_zz_banana') THEN RAISE EXCEPTION 'ÉCHEC : réservation abandonnée non reprise'; END IF;
  PERFORM public.save_food_fact('test_zz_banana', '{"fr": {"name": "Banane"}, "en": {"name": "Banana"}, "es": {"name": "Plátano"}}', ARRAY['banane', 'banana', 'platano'], 'test');
  IF public.claim_food_fact('test_zz_banana') THEN RAISE EXCEPTION 'ÉCHEC : fiche prête régénérée'; END IF;
  PERFORM public.release_food_fact('test_zz_banana');
  IF NOT EXISTS (SELECT 1 FROM public.food_facts WHERE food_key = 'test_zz_banana' AND status = 'ready') THEN
    RAISE EXCEPTION 'ÉCHEC : fiche prête supprimée par release';
  END IF;
  PERFORM public.add_food_fact_alias('test_zz_banana', 'bananes mures');
  PERFORM public.add_food_fact_alias('test_zz_banana', 'bananes mures');
  IF (SELECT cardinality(aliases) FROM public.food_facts WHERE food_key = 'test_zz_banana') <> 4 THEN
    RAISE EXCEPTION 'ÉCHEC : alias absent ou en double';
  END IF;
  PERFORM public.claim_food_fact('test_zz_kiwi');
  IF NOT public.consume_quota('00000000-0000-4000-a000-000000000c01', 'facts', 1)
     OR public.consume_quota('00000000-0000-4000-a000-000000000c01', 'facts', 1) THEN
    RAISE EXCEPTION 'ÉCHEC : quota des fiches';
  END IF;
  PERFORM public.refund_quota('00000000-0000-4000-a000-000000000c01', 'facts');
  IF (SELECT facts FROM public.usage_counters WHERE user_id = '00000000-0000-4000-a000-000000000c01') <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : remboursement du quota des fiches';
  END IF;
  RAISE NOTICE 'OK : une seule génération à la fois, reprise après abandon, fiche prête gardée, alias sans doublon, quota des fiches';
END;
$$;

-- 2. App (utilisateur connecté) : lecture des fiches prêtes, aucune écriture, signalements
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000c01", "role": "authenticated"}', true);
DO $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.food_facts WHERE food_key = 'test_zz_banana')
     OR EXISTS (SELECT 1 FROM public.food_facts WHERE food_key = 'test_zz_kiwi') THEN
    RAISE EXCEPTION 'ÉCHEC : fiches lisibles (prête visible, en cours invisible)';
  END IF;
  IF pg_temp.error_of('SELECT public.claim_food_fact(''test_zz_pear'')') !~ 'permission denied'
     OR pg_temp.error_of('SELECT public.save_food_fact(''test_zz_pear'', ''{}'', ''{}'', ''x'')') !~ 'permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : fonctions d''écriture appelables depuis l''app';
  END IF;
  UPDATE public.food_facts SET reviewed = true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : fiche modifiable par l''app'; END IF;
  IF pg_temp.error_of('INSERT INTO public.food_facts (food_key, status, content) VALUES (''test_zz_fake'', ''ready'', ''{}'')') !~ 'row-level security' THEN
    RAISE EXCEPTION 'ÉCHEC : fiche créée par l''app';
  END IF;

  INSERT INTO public.food_fact_reports (food_key, language, message) VALUES ('test_zz_banana', 'fr', 'Saison inexacte');
  IF pg_temp.error_of('INSERT INTO public.food_fact_reports (food_key, language, user_id) VALUES (''test_zz_banana'', ''fr'', ''00000000-0000-4000-a000-000000000c02'')') !~ 'row-level security' THEN
    RAISE EXCEPTION 'ÉCHEC : signalement au nom d''un autre';
  END IF;

  INSERT INTO public.ingredients (user_id, name, food_key) VALUES ('00000000-0000-4000-a000-000000000c01', 'bananes', 'test_zz_banana');
  IF pg_temp.error_of('UPDATE public.ingredients SET food_key = ''Pas Valide'' WHERE name = ''bananes''') !~ 'food_key_format' THEN
    RAISE EXCEPTION 'ÉCHEC : identifiant mal formé accepté';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000c02", "role": "authenticated"}', true);
  IF EXISTS (SELECT 1 FROM public.food_fact_reports) THEN RAISE EXCEPTION 'ÉCHEC : B voit les signalements de A'; END IF;
  RAISE NOTICE 'OK : l''app lit les fiches prêtes sans pouvoir les écrire ; signalements personnels ; identifiant validé sur le garde-manger';
END;
$$;

ROLLBACK;
