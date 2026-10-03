-- Tests de « Mes recettes » 2.0 : signet « Pour plus tard » (recipes.later_at) posé et retiré par l'auteur de la recette,
-- jamais sur la recette d'un autre utilisateur ; cuisine enregistrée avec la recette (recipes.cuisine).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/recipes_later.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-000000000f0a', 'later-a@example.com'),
  ('00000000-0000-4000-a000-000000000f0b', 'later-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-000000000f0a', 'later-a@example.com'),
  ('00000000-0000-4000-a000-000000000f0b', 'later-b@example.com') ON CONFLICT DO NOTHING;
INSERT INTO public.recipes (id, user_id, title) VALUES
  ('00000000-0000-4000-a000-0000000f0a01', '00000000-0000-4000-a000-000000000f0a', 'Recette de A');

CREATE FUNCTION pg_temp.login(p_user text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

-- 1. L'auteur pose puis retire le signet
SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-000000000f0a');
UPDATE public.recipes SET later_at = now() WHERE id = '00000000-0000-4000-a000-0000000f0a01';
DO $$
BEGIN
  IF (SELECT later_at FROM public.recipes WHERE id = '00000000-0000-4000-a000-0000000f0a01') IS NULL THEN
    RAISE EXCEPTION 'signet non posé par l''auteur';
  END IF;
END $$;
UPDATE public.recipes SET later_at = NULL WHERE id = '00000000-0000-4000-a000-0000000f0a01';
DO $$
BEGIN
  IF (SELECT later_at FROM public.recipes WHERE id = '00000000-0000-4000-a000-0000000f0a01') IS NOT NULL THEN
    RAISE EXCEPTION 'signet non retiré par l''auteur';
  END IF;
END $$;

-- Cuisine enregistrée à l'insertion par l'auteur
INSERT INTO public.recipes (user_id, title, cuisine) VALUES ('00000000-0000-4000-a000-000000000f0a', 'Tajine', 'maghreb');
DO $$
BEGIN
  IF (SELECT cuisine FROM public.recipes WHERE title = 'Tajine' AND user_id = '00000000-0000-4000-a000-000000000f0a') IS DISTINCT FROM 'maghreb' THEN
    RAISE EXCEPTION 'cuisine non enregistrée';
  END IF;
END $$;

-- 2. Un autre utilisateur ne peut pas poser de signet sur la recette de A (aucune ligne visible ni modifiée)
SELECT pg_temp.login('00000000-0000-4000-a000-000000000f0b');
UPDATE public.recipes SET later_at = now() WHERE id = '00000000-0000-4000-a000-0000000f0a01';
RESET ROLE;
DO $$
BEGIN
  IF (SELECT later_at FROM public.recipes WHERE id = '00000000-0000-4000-a000-0000000f0a01') IS NOT NULL THEN
    RAISE EXCEPTION 'signet posé par un autre utilisateur';
  END IF;
  RAISE NOTICE 'recipes_later : tous les tests passent';
END $$;

ROLLBACK;
