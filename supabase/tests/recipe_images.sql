-- Tests des règles d'accès du bucket recipe-images.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/recipe_images.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-00000000000a', 'images-test-a@example.com');

-- Une image déposée par le serveur (comme generate-recipe-image avec la clé secrète)
INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('recipe-images', '00000000-0000-4000-a000-00000000000a/recette-test.jpg', NULL);

DO $$
BEGIN
  IF NOT (SELECT public FROM storage.buckets WHERE id = 'recipe-images') THEN
    RAISE EXCEPTION 'ÉCHEC : le bucket recipe-images n''est pas public en lecture';
  END IF;
  IF (SELECT file_size_limit FROM storage.buckets WHERE id = 'recipe-images') > 2097152 THEN
    RAISE EXCEPTION 'ÉCHEC : taille maximale des images supérieure à 2 Mo';
  END IF;
  RAISE NOTICE 'OK : bucket public en lecture, 2 Mo au plus par image';
END;
$$;

-- En tant qu'utilisateur connecté, puis en tant que visiteur
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}', true);

DO $$
DECLARE
  v_rows integer;
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'recipe-images') THEN
    RAISE EXCEPTION 'ÉCHEC : un utilisateur peut lister les images du bucket';
  END IF;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('recipe-images', '00000000-0000-4000-a000-00000000000a/intrus.jpg');
    RAISE EXCEPTION 'ÉCHEC : un utilisateur peut déposer une image';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE storage.objects SET name = 'remplace.jpg' WHERE bucket_id = 'recipe-images';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : un utilisateur peut modifier une image'; END IF;

  -- La suppression directe dans storage.objects est interdite par Supabase pour tous les rôles :
  -- elle est testée via l'API Storage avec un jeton d'utilisateur (voir le rapport de la phase 3).

  RAISE NOTICE 'OK : un utilisateur connecté ne peut ni lister, ni déposer, ni modifier d''image';
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'recipe-images') THEN
    RAISE EXCEPTION 'ÉCHEC : un visiteur peut lister les images du bucket';
  END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('recipe-images', 'visiteur.jpg');
    RAISE EXCEPTION 'ÉCHEC : un visiteur peut déposer une image';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK : un visiteur ne peut ni lister ni déposer d''image';
END;
$$;

ROLLBACK;
