-- Tests des préférences de génération : enregistrement, limites, préférences d'un autre utilisateur refusées.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/user_preferences.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-a000-000000000a01', 'pref-test@example.com');
INSERT INTO public.profiles (id, email) VALUES ('00000000-0000-4000-a000-000000000a01', 'pref-test@example.com');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000a01", "role": "authenticated"}', true);
DO $$
BEGIN
  INSERT INTO public.user_preferences (user_id, dietary_preferences, excluded_ingredients, max_cook_time, default_cuisine, servings)
  VALUES ('00000000-0000-4000-a000-000000000a01', ARRAY['Vegetarian'], ARRAY['arachide'], 30, 'african', 4);
  BEGIN
    UPDATE public.user_preferences SET servings = 20;
    RAISE EXCEPTION 'ÉCHEC : 20 personnes accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.user_preferences SET default_cuisine = 'mars';
    RAISE EXCEPTION 'ÉCHEC : cuisine inconnue acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.user_preferences (user_id) VALUES ('00000000-0000-4000-a000-000000000001');
    RAISE EXCEPTION 'ÉCHEC : préférences d''un autre utilisateur';
  EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL;
  END;
  RAISE NOTICE 'OK : préférences enregistrées (cuisine, personnes, exclus), valeurs hors limites refusées, autre utilisateur refusé';
END;
$$;
ROLLBACK;
