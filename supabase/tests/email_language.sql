-- Langue des e-mails d'authentification : la langue choisie dans l'app est copiée dans les métadonnées du compte
-- (lues par les modèles d'e-mail), sans toucher aux autres métadonnées ; une valeur inconnue est ignorée.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/email_language.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-a000-0000000011aa', 'langue-a@example.com', '{"keep": 1}');
INSERT INTO public.profiles (id, email) VALUES ('00000000-0000-4000-a000-0000000011aa', 'langue-a@example.com') ON CONFLICT DO NOTHING;

CREATE FUNCTION pg_temp.login(p_user text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-0000000011aa');
-- Comme l'app (contexts/LanguageContext.tsx) : upsert de la langue par l'utilisateur lui-même
INSERT INTO public.user_preferences (user_id, default_language) VALUES ('00000000-0000-4000-a000-0000000011aa', 'es')
  ON CONFLICT (user_id) DO UPDATE SET default_language = EXCLUDED.default_language;
RESET ROLE;

DO $$
DECLARE
  meta jsonb;
BEGIN
  -- 1. Langue copiée à la création des préférences, autres métadonnées gardées
  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = '00000000-0000-4000-a000-0000000011aa';
  IF meta->>'lang' IS DISTINCT FROM 'es' OR meta->>'keep' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'langue non copiée : %', meta; END IF;
  RAISE NOTICE 'OK 1 : langue copiée, autres métadonnées gardées';

  -- 2. Changement de langue
  UPDATE public.user_preferences SET default_language = 'en' WHERE user_id = '00000000-0000-4000-a000-0000000011aa';
  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = '00000000-0000-4000-a000-0000000011aa';
  IF meta->>'lang' IS DISTINCT FROM 'en' THEN RAISE EXCEPTION 'changement non copié : %', meta; END IF;
  RAISE NOTICE 'OK 2 : changement de langue copié';

  -- 3. Valeur inconnue ignorée
  UPDATE public.user_preferences SET default_language = 'de' WHERE user_id = '00000000-0000-4000-a000-0000000011aa';
  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = '00000000-0000-4000-a000-0000000011aa';
  IF meta->>'lang' IS DISTINCT FROM 'en' THEN RAISE EXCEPTION 'valeur inconnue copiée : %', meta; END IF;
  RAISE NOTICE 'OK 3 : valeur inconnue ignorée';
END $$;

-- 4. La fonction n'est pas appelable directement par l'app
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF has_function_privilege('public.sync_email_language()', 'execute') THEN RAISE EXCEPTION 'fonction appelable par l''app'; END IF;
  RAISE NOTICE 'OK 4 : fonction non appelable par l''app';
END $$;

ROLLBACK;
