-- Tests des quotas (usage_counters, consume_quota, refund_quota).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/usage_counters.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-00000000000a', 'quota-test-a@example.com'),
  ('00000000-0000-4000-a000-00000000000b', 'quota-test-b@example.com');

-- En tant que serveur (service_role, comme les Edge Functions avec la clé secrète)
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF NOT public.consume_quota('00000000-0000-4000-a000-00000000000a', 'generations', 2)
     OR NOT public.consume_quota('00000000-0000-4000-a000-00000000000a', 'generations', 2) THEN
    RAISE EXCEPTION 'ÉCHEC : les 2 premières générations sont refusées';
  END IF;
  IF public.consume_quota('00000000-0000-4000-a000-00000000000a', 'generations', 2) THEN
    RAISE EXCEPTION 'ÉCHEC : la 3e génération est acceptée avec une limite de 2';
  END IF;
  IF (SELECT generations FROM public.usage_counters WHERE user_id = '00000000-0000-4000-a000-00000000000a') <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : le compteur dépasse la limite';
  END IF;
  RAISE NOTICE 'OK : limite respectée (2 acceptées, la 3e refusée, compteur à 2)';

  PERFORM public.refund_quota('00000000-0000-4000-a000-00000000000a', 'generations');
  IF (SELECT generations FROM public.usage_counters WHERE user_id = '00000000-0000-4000-a000-00000000000a') <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : le remboursement ne rend pas une unité';
  END IF;
  PERFORM public.refund_quota('00000000-0000-4000-a000-00000000000a', 'scans');
  IF (SELECT scans FROM public.usage_counters WHERE user_id = '00000000-0000-4000-a000-00000000000a') <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : un compteur descend sous zéro';
  END IF;
  RAISE NOTICE 'OK : remboursement d''une unité, jamais sous zéro';

  PERFORM public.consume_quota('00000000-0000-4000-a000-00000000000b', 'scans', 20);
  BEGIN
    PERFORM public.consume_quota('00000000-0000-4000-a000-00000000000b', 'inconnu', 20);
    RAISE EXCEPTION 'ÉCHEC : type de quota inconnu accepté';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'ÉCHEC%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK : type de quota inconnu refusé';
END;
$$;

-- En tant que A, connecté
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}', true);
DO $$
DECLARE
  v_rows integer;
BEGIN
  IF (SELECT count(*) FROM public.usage_counters) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.usage_counters WHERE user_id = '00000000-0000-4000-a000-00000000000a') THEN
    RAISE EXCEPTION 'ÉCHEC : A ne voit pas uniquement ses propres compteurs';
  END IF;
  RAISE NOTICE 'OK : A ne voit que ses propres compteurs';

  UPDATE public.usage_counters SET generations = 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : A a remis ses compteurs à zéro'; END IF;
  DELETE FROM public.usage_counters;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : A a supprimé ses compteurs'; END IF;
  BEGIN
    INSERT INTO public.usage_counters (user_id, day) VALUES ('00000000-0000-4000-a000-00000000000a', '2000-01-01');
    RAISE EXCEPTION 'ÉCHEC : A a créé une ligne de compteurs';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK : A ne peut ni modifier, ni supprimer, ni créer de compteurs';

  BEGIN
    PERFORM public.consume_quota('00000000-0000-4000-a000-00000000000a', 'generations', 1000);
    RAISE EXCEPTION 'ÉCHEC : A peut appeler consume_quota';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.refund_quota('00000000-0000-4000-a000-00000000000a', 'generations');
    RAISE EXCEPTION 'ÉCHEC : A peut appeler refund_quota';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK : consume_quota et refund_quota interdits à l''app';
END;
$$;

ROLLBACK;
