-- Tests des règles de sécurité du garde-manger (foyers).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/household_rls.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.
-- Chaque test affiche « OK : … » ; le premier échec interrompt le script avec « ÉCHEC : … ».

BEGIN;

-- Deux utilisateurs fictifs, A et B ; le trigger leur crée un foyer personnel
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-00000000000a', 'rls-test-a@example.com'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-test-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-00000000000a', 'rls-test-a@example.com'),
  ('00000000-0000-4000-a000-00000000000b', 'rls-test-b@example.com');

-- Un ingrédient chacun, sans household_id (comme l'app) : le trigger choisit le foyer personnel
INSERT INTO public.ingredients (id, user_id, name) VALUES
  ('00000000-0000-4000-b000-00000000000a', '00000000-0000-4000-a000-00000000000a', 'ingrédient de A'),
  ('00000000-0000-4000-b000-00000000000b', '00000000-0000-4000-a000-00000000000b', 'ingrédient de B');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.households
      WHERE is_personal AND created_by IN ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-00000000000b')) <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : foyer personnel non créé à l''inscription';
  END IF;
  IF (SELECT role FROM public.household_members m JOIN public.households h ON h.id = m.household_id
      WHERE h.is_personal AND h.created_by = '00000000-0000-4000-a000-00000000000a'
        AND m.user_id = '00000000-0000-4000-a000-00000000000a') IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'ÉCHEC : A n''est pas propriétaire de son foyer personnel';
  END IF;
  IF (SELECT h.created_by FROM public.ingredients i JOIN public.households h ON h.id = i.household_id
      WHERE i.id = '00000000-0000-4000-b000-00000000000a') IS DISTINCT FROM '00000000-0000-4000-a000-00000000000a' THEN
    RAISE EXCEPTION 'ÉCHEC : ingrédient sans household_id non rattaché au foyer personnel';
  END IF;
  RAISE NOTICE 'OK : foyer personnel créé à l''inscription (A propriétaire), ingrédient rattaché automatiquement';
END;
$$;

-- À partir d'ici, on agit en tant que A, connecté, comme l'app
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-00000000000a", "role": "authenticated"}', true);

DO $$
DECLARE
  v_rows integer;
  v_household_b uuid;
BEGIN
  -- Lecture
  IF (SELECT count(*) FROM public.ingredients WHERE id = '00000000-0000-4000-b000-00000000000a') <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : A ne voit pas son propre ingrédient';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE user_id <> '00000000-0000-4000-a000-00000000000a') THEN
    RAISE EXCEPTION 'ÉCHEC : A voit des ingrédients d''un autre foyer';
  END IF;
  IF (SELECT count(*) FROM public.households) <> 1 OR (SELECT count(*) FROM public.household_members) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : A voit d''autres foyers ou d''autres membres que les siens';
  END IF;
  RAISE NOTICE 'OK : A ne voit que les ingrédients, le foyer et les membres de son foyer';

  -- Modification et suppression d'un ingrédient de B : aucune ligne touchée
  UPDATE public.ingredients SET name = 'modifié par A' WHERE id = '00000000-0000-4000-b000-00000000000b';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : A a modifié un ingrédient de B'; END IF;
  DELETE FROM public.ingredients WHERE id = '00000000-0000-4000-b000-00000000000b';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : A a supprimé un ingrédient de B'; END IF;
  RAISE NOTICE 'OK : A ne peut ni modifier ni supprimer un ingrédient de B';

  -- Le foyer de B n'est pas visible pour A : on le lit en tant que postgres
  RESET ROLE;
  SELECT id INTO v_household_b FROM public.households
  WHERE is_personal AND created_by = '00000000-0000-4000-a000-00000000000b';
  SET LOCAL ROLE authenticated;

  -- Ajout d'un ingrédient dans le foyer de B : refusé
  BEGIN
    INSERT INTO public.ingredients (user_id, household_id, name)
    VALUES ('00000000-0000-4000-a000-00000000000a', v_household_b, 'intrus');
    RAISE EXCEPTION 'ÉCHEC : A a ajouté un ingrédient dans le foyer de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Déplacer son propre ingrédient dans le foyer de B : refusé
  BEGIN
    UPDATE public.ingredients SET household_id = v_household_b WHERE id = '00000000-0000-4000-b000-00000000000a';
    RAISE EXCEPTION 'ÉCHEC : A a déplacé un ingrédient dans le foyer de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Ajouter un ingrédient au nom de B (dans son propre foyer) : refusé
  BEGIN
    INSERT INTO public.ingredients (user_id, name) VALUES ('00000000-0000-4000-a000-00000000000b', 'usurpation');
    RAISE EXCEPTION 'ÉCHEC : A a ajouté un ingrédient au nom de B';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Rejoindre le foyer de B de lui-même : refusé
  BEGIN
    INSERT INTO public.household_members (household_id, user_id) VALUES (v_household_b, '00000000-0000-4000-a000-00000000000a');
    RAISE EXCEPTION 'ÉCHEC : A a rejoint le foyer de B sans invitation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK : A ne peut pas écrire dans le foyer de B, y déplacer un ingrédient, agir au nom de B, ni rejoindre son foyer';

  -- Les ingrédients de B n'ont pas bougé
  RESET ROLE;
  IF (SELECT name FROM public.ingredients WHERE id = '00000000-0000-4000-b000-00000000000b') <> 'ingrédient de B'
     OR EXISTS (SELECT 1 FROM public.ingredients WHERE household_id = v_household_b AND id <> '00000000-0000-4000-b000-00000000000b') THEN
    RAISE EXCEPTION 'ÉCHEC : le garde-manger de B a été modifié';
  END IF;
  RAISE NOTICE 'OK : le garde-manger de B est intact';

  -- Partage : une fois A membre du foyer de B (ajout par le serveur), A voit et modifie ses ingrédients
  INSERT INTO public.household_members (household_id, user_id) VALUES (v_household_b, '00000000-0000-4000-a000-00000000000a');
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-00000000000b') THEN
    RAISE EXCEPTION 'ÉCHEC : A, membre du foyer de B, ne voit pas ses ingrédients';
  END IF;
  UPDATE public.ingredients SET quantity = '3' WHERE id = '00000000-0000-4000-b000-00000000000b';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'ÉCHEC : A, membre du foyer de B, ne peut pas modifier ses ingrédients'; END IF;
  RAISE NOTICE 'OK : membre du foyer de B, A voit et modifie le garde-manger partagé';
END;
$$;

-- Sans connexion (rôle anon) : rien n'est visible
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ingredients) OR EXISTS (SELECT 1 FROM public.households)
     OR EXISTS (SELECT 1 FROM public.household_members) THEN
    RAISE EXCEPTION 'ÉCHEC : un visiteur non connecté voit des données du garde-manger';
  END IF;
  RAISE NOTICE 'OK : un visiteur non connecté ne voit aucun ingrédient, foyer ni membre';
END;
$$;

ROLLBACK;
