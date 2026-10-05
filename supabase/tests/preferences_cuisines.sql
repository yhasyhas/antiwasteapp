-- Tests de la cuisine préférée (phase 9b) : nouveaux choix et anciennes valeurs acceptés, valeur inconnue refusée,
-- texte de « Autre cuisine… » limité à 40 caractères, préférences d'un autre utilisateur inaccessibles.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/preferences_cuisines.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000c0a', 'cuisine-a@example.com'),
  ('00000000-0000-4000-a000-000000000c0b', 'cuisine-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-000000000c0a', 'cuisine-a@example.com'),
  ('00000000-0000-4000-a000-000000000c0b', 'cuisine-b@example.com') ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.login(p_user text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000c0a');

DO $$
DECLARE
  v text;
BEGIN
  -- 1. Nouveaux choix et anciennes valeurs acceptés
  INSERT INTO user_preferences (user_id, default_cuisine) VALUES ('00000000-0000-4000-a000-000000000c0a', 'afrique-ouest')
    ON CONFLICT (user_id) DO UPDATE SET default_cuisine = EXCLUDED.default_cuisine;
  FOREACH v IN ARRAY ARRAY['any', 'africa', 'maghreb', 'asie-sud-est', 'caraibes', 'france', 'african', 'latin', 'french'] LOOP
    UPDATE user_preferences SET default_cuisine = v WHERE user_id = '00000000-0000-4000-a000-000000000c0a';
  END LOOP;
  UPDATE user_preferences SET default_cuisine = 'other', default_cuisine_other = 'géorgienne' WHERE user_id = '00000000-0000-4000-a000-000000000c0a';

  -- 2. Valeur inconnue et texte trop long refusés
  BEGIN
    UPDATE user_preferences SET default_cuisine = 'klingon' WHERE user_id = '00000000-0000-4000-a000-000000000c0a';
    RAISE EXCEPTION 'cuisine inconnue acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE user_preferences SET default_cuisine_other = repeat('x', 41) WHERE user_id = '00000000-0000-4000-a000-000000000c0a';
    RAISE EXCEPTION 'texte de 41 caractères accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK 1 : choix acceptés, valeurs invalides refusées';
END;
$$;

-- 3. Un autre utilisateur ne voit ni ne modifie ces préférences
SELECT pg_temp.login('00000000-0000-4000-a000-000000000c0b');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_preferences WHERE user_id = '00000000-0000-4000-a000-000000000c0a') THEN
    RAISE EXCEPTION 'préférences d''un autre utilisateur visibles';
  END IF;
  UPDATE user_preferences SET default_cuisine_other = 'piratée' WHERE user_id = '00000000-0000-4000-a000-000000000c0a';
  RAISE NOTICE 'OK 2 : préférences privées';
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT default_cuisine_other FROM user_preferences WHERE user_id = '00000000-0000-4000-a000-000000000c0a') <> 'géorgienne' THEN
    RAISE EXCEPTION 'préférences modifiées par un autre utilisateur';
  END IF;
END;
$$;

\echo 'preferences_cuisines : tous les tests passent'
ROLLBACK;
