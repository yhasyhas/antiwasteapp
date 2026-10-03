-- Tests de la surveillance du secours : un incident par fournisseur, jour et type (quota et dysfonctionnement
-- le même jour : deux alertes), décompte des générations servies, lecture seule pour les utilisateurs.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/provider_monitoring.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

-- 1. Quota puis dysfonctionnement le même jour : chacun est le premier de son type ; le second
--    dysfonctionnement n'est pas le premier
DO $$
BEGIN
  IF NOT record_provider_quota('groq', 'test', 'quota', true) THEN
    RAISE EXCEPTION 'premier quota du jour non signalé';
  END IF;
  IF NOT record_provider_quota('groq', 'test', '400 json_validate_failed', true, 'provider_failure') THEN
    RAISE EXCEPTION 'premier dysfonctionnement du jour non signalé (confondu avec le quota)';
  END IF;
  IF record_provider_quota('groq', 'test', '400 json_validate_failed', true, 'provider_failure') THEN
    RAISE EXCEPTION 'second dysfonctionnement du jour signalé comme premier';
  END IF;
  IF (SELECT occurrences FROM provider_quota_events WHERE provider = 'groq' AND simulated AND alert = 'provider_failure'
      AND day = (now() AT TIME ZONE 'utc')::date) <> 2 THEN
    RAISE EXCEPTION 'occurrences du dysfonctionnement mal comptées';
  END IF;
END;
$$;

-- 2. Générations servies : cumul par fournisseur et secours
SELECT record_provider_usage('test-fn', 'groq', false, 3, true);
SELECT record_provider_usage('test-fn', 'groq', false, 2, true);
SELECT record_provider_usage('test-fn', 'gemini', true, 3, true);
DO $$
BEGIN
  IF (SELECT generations || '/' || recipes FROM provider_usage_daily WHERE function_name = 'test-fn' AND provider = 'groq' AND simulated) <> '2/5' THEN
    RAISE EXCEPTION 'générations de groq mal cumulées';
  END IF;
  IF (SELECT recipes FROM provider_usage_daily WHERE function_name = 'test-fn' AND provider = 'gemini' AND fallback AND simulated) <> 3 THEN
    RAISE EXCEPTION 'recettes du secours mal comptées';
  END IF;
END;
$$;

-- 3. Utilisateur connecté : lecture possible, écriture et appel des fonctions refusés
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-a000-000000000f0a', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF (SELECT count(*) FROM provider_usage_daily WHERE function_name = 'test-fn') <> 2 THEN
    RAISE EXCEPTION 'décompte illisible pour un utilisateur connecté';
  END IF;
  BEGIN
    PERFORM record_provider_usage('test-fn', 'groq', false, 1, true);
    RAISE EXCEPTION 'record_provider_usage appelable depuis l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM record_provider_quota('groq', 'test', 'x', true, 'provider_failure');
    RAISE EXCEPTION 'record_provider_quota appelable depuis l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO provider_usage_daily (function_name, provider, fallback) VALUES ('x', 'groq', false);
    RAISE EXCEPTION 'écriture directe possible depuis l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

\echo 'provider_monitoring : tous les tests passent'
ROLLBACK;
