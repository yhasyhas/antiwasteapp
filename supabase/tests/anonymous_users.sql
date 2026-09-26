-- Tests de l'essai sans compte : un compte anonyme a un profil sans e-mail, son garde-manger, et peut
-- rejoindre un foyer par invitation ; à la conversion (même identifiant), tout est conservé.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/anonymous_users.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

-- 1 : compte normal ; 2 : compte anonyme (sans e-mail)
INSERT INTO auth.users (id, email, is_anonymous) VALUES
  ('00000000-0000-4000-a000-000000000b01', 'anon-test-owner@example.com', false),
  ('00000000-0000-4000-a000-000000000b02', NULL, true);
INSERT INTO public.profiles (id, email) VALUES ('00000000-0000-4000-a000-000000000b01', 'anon-test-owner@example.com');

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_code text;
  v_household uuid;
  v_me jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000b01", "role": "authenticated"}', true);
  v_code := public.create_household_invite()->>'code';

  -- Le compte anonyme crée son profil sans e-mail (comme l'app), ajoute un aliment, rejoint le foyer
  PERFORM set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000b02", "role": "authenticated", "is_anonymous": true}', true);
  INSERT INTO public.profiles (id, email) VALUES ('00000000-0000-4000-a000-000000000b02', NULL);
  INSERT INTO public.ingredients (user_id, name) VALUES ('00000000-0000-4000-a000-000000000b02', 'pommes');
  v_household := public.join_household(v_code, true);
  v_me := public.my_household();
  IF (v_me->>'id')::uuid <> v_household OR jsonb_array_length(v_me->'members') <> 2
     OR (SELECT m->>'name' FROM jsonb_array_elements(v_me->'members') m WHERE (m->>'is_me')::boolean) IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : foyer du compte anonyme : %', v_me;
  END IF;
  IF (SELECT count(*) FROM public.ingredients WHERE household_id = v_household) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : garde-manger du compte anonyme non transféré';
  END IF;
  INSERT INTO ctx VALUES ('household', v_household);
  RAISE NOTICE 'OK : compte anonyme avec profil sans e-mail, garde-manger, arrivée dans un foyer par invitation (nom vide : « Invité » dans l''app)';
END;
$$;

-- Conversion en vrai compte : même identifiant, e-mail ajouté ; tout est conservé
RESET ROLE;
UPDATE auth.users SET email = 'anon-test-converted@example.com', is_anonymous = false WHERE id = '00000000-0000-4000-a000-000000000b02';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-000000000b02", "role": "authenticated"}', true);
  UPDATE public.profiles SET email = 'anon-test-converted@example.com' WHERE id = '00000000-0000-4000-a000-000000000b02';
  IF (public.my_household()->>'id') <> (SELECT value FROM ctx WHERE key = 'household')
     OR (SELECT count(*) FROM public.ingredients WHERE name = 'pommes') <> 1
     OR (SELECT m->>'name' FROM jsonb_array_elements(public.my_household()->'members') m WHERE (m->>'is_me')::boolean) <> 'anon-test-converted' THEN
    RAISE EXCEPTION 'ÉCHEC : données perdues à la conversion';
  END IF;
  RAISE NOTICE 'OK : conversion en vrai compte sans perte (foyer, garde-manger, nom affiché)';
END;
$$;

ROLLBACK;
