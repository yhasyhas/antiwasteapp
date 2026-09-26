-- Tests des épuisements de quota des fournisseurs (alerte une fois par jour et par fournisseur).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/provider_quota_events.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

-- Essais simulés du jour déjà en base (écran « État des services », simulations) : ignorés ici
DELETE FROM provider_quota_events WHERE simulated AND day = (now() AT TIME ZONE 'utc')::date;

-- En tant que service_role (les fonctions, avec la clé secrète)
SET LOCAL ROLE service_role;

DO $$
BEGIN
  IF NOT record_provider_quota('groq', 'generate-recipes', 'Groq 429: rate_limit_exceeded', true) THEN
    RAISE EXCEPTION 'ÉCHEC : le premier épuisement du jour ne déclenche pas d''alerte';
  END IF;
  IF record_provider_quota('groq', 'analyze-image', 'Groq 429: rate_limit_exceeded (2)', true) THEN
    RAISE EXCEPTION 'ÉCHEC : deuxième alerte le même jour pour le même fournisseur';
  END IF;
  IF NOT record_provider_quota('gemini', 'analyze-image', 'Gemini 429: RESOURCE_EXHAUSTED', true) THEN
    RAISE EXCEPTION 'ÉCHEC : un autre fournisseur n''a pas sa propre alerte';
  END IF;
  IF (SELECT occurrences FROM provider_quota_events WHERE provider = 'groq' AND simulated) <> 2
     OR (SELECT function_name FROM provider_quota_events WHERE provider = 'groq' AND simulated) <> 'analyze-image' THEN
    RAISE EXCEPTION 'ÉCHEC : occurrences ou dernière fonction non mises à jour';
  END IF;
  BEGIN
    PERFORM record_provider_quota('openai', 'x', 'y', true);
    RAISE EXCEPTION 'ÉCHEC : fournisseur inconnu accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK : une alerte par jour et par fournisseur, occurrences comptées, fournisseur inconnu refusé';
END;
$$;

RESET ROLE;
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-a000-00000000002a', 'quota-test-a@example.com');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-00000000002a", "role": "authenticated"}', true);

DO $$
DECLARE
  v_rows integer;
BEGIN
  IF (SELECT count(*) FROM provider_quota_events WHERE simulated) <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : un utilisateur connecté ne lit pas l''état des fournisseurs';
  END IF;
  BEGIN
    PERFORM record_provider_quota('groq', 'x', 'y', true);
    RAISE EXCEPTION 'ÉCHEC : record_provider_quota permise à l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO provider_quota_events (provider, function_name) VALUES ('groq', 'x');
    RAISE EXCEPTION 'ÉCHEC : insertion permise à l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE provider_quota_events SET occurrences = 0;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : modification permise à l''app'; END IF;
  DELETE FROM provider_quota_events;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : suppression permise à l''app'; END IF;
  RAISE NOTICE 'OK : l''app lit l''état des fournisseurs, sans pouvoir l''écrire ni appeler record_provider_quota';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM provider_quota_events) THEN
    RAISE EXCEPTION 'ÉCHEC : un visiteur non connecté lit l''état des fournisseurs';
  END IF;
  RAISE NOTICE 'OK : un visiteur non connecté ne lit rien';
END;
$$;

ROLLBACK;
