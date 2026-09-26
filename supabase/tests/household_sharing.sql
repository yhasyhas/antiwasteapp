-- Tests du garde-manger partagé : invitations, arrivée, limite de membres, retrait, départ, transfert
-- de propriété, suppression de compte, auteur des ingrédients.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/household_sharing.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

-- A invite, B, C, D et E1 à E6 : utilisateurs fictifs (foyer personnel créé par le trigger)
INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-4000-a000-0000000006' || lpad(n::text, 2, '0'))::uuid, 'share-test-' || n || '@example.com'
FROM generate_series(1, 10) AS n;
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users WHERE email LIKE 'share-test-%@example.com';
UPDATE public.profiles SET display_name = 'Awa' WHERE email = 'share-test-1@example.com';

-- Raccourcis : identifiant du n-ième utilisateur, et « se connecter » en tant que lui
CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('00000000-0000-4000-a000-0000000006' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.login(n integer) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'role', 'authenticated')::text, true) $$;
-- Erreur attendue : le code renvoyé par la fonction, ou 'ok'
CREATE FUNCTION pg_temp.error_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

INSERT INTO public.ingredients (user_id, name) VALUES (pg_temp.u(1), 'riz de A'), (pg_temp.u(2), 'lait de B');

CREATE TEMP TABLE ctx (key text PRIMARY KEY, value text);
GRANT ALL ON ctx TO authenticated;

SET LOCAL ROLE authenticated;

-- 1. Invitation et codes refusés
DO $$
DECLARE
  v_invite jsonb;
BEGIN
  PERFORM pg_temp.login(1);
  IF (public.my_household()->>'shared')::boolean OR public.my_household()->>'role' <> 'owner' THEN
    RAISE EXCEPTION 'ÉCHEC : A n''est pas seul propriétaire de son foyer personnel';
  END IF;
  v_invite := public.create_household_invite();
  IF v_invite->>'code' !~ '^[A-HJ-NP-Z2-9]{6}$'
     OR (v_invite->>'expires_at')::timestamptz NOT BETWEEN now() + interval '47 hours 59 minutes' AND now() + interval '48 hours 1 minute' THEN
    RAISE EXCEPTION 'ÉCHEC : code ou validité incorrects : %', v_invite;
  END IF;
  IF public.my_household()->'invite'->>'code' <> v_invite->>'code' THEN
    RAISE EXCEPTION 'ÉCHEC : code en cours absent de my_household';
  END IF;
  INSERT INTO ctx VALUES ('code', v_invite->>'code');

  PERFORM pg_temp.login(2);
  IF pg_temp.error_of('SELECT public.join_household(''ZZZZZZ'', true)') <> 'invalid_code' THEN
    RAISE EXCEPTION 'ÉCHEC : code inexistant accepté';
  END IF;
  IF pg_temp.error_of('SELECT public.preview_household_invite(''zzzzzz'')') <> 'invalid_code' THEN
    RAISE EXCEPTION 'ÉCHEC : aperçu d''un code inexistant';
  END IF;
  IF pg_temp.error_of('SELECT count(*) FROM public.household_invites') <> 'ok'
     OR (SELECT count(*) FROM public.household_invites) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : les invitations sont lisibles directement';
  END IF;
  IF (public.preview_household_invite(lower(v_invite->>'code'))->>'invited_by') <> 'Awa' THEN
    RAISE EXCEPTION 'ÉCHEC : aperçu sans le nom de l''invitant';
  END IF;
  RAISE NOTICE 'OK : code de 6 caractères valable 48 h ; code invalide refusé ; invitations illisibles directement';
END;
$$;

-- 2. B rejoint avec son garde-manger ; le foyer de A devient partagé, A reçoit un foyer personnel vide
DO $$
DECLARE
  v_household uuid;
  v_me jsonb;
BEGIN
  PERFORM pg_temp.login(2);
  v_household := public.join_household((SELECT value FROM ctx WHERE key = 'code'), true);
  INSERT INTO ctx VALUES ('household', v_household);
  v_me := public.my_household();
  IF (v_me->>'id')::uuid <> v_household OR NOT (v_me->>'shared')::boolean OR v_me->>'role' <> 'member'
     OR jsonb_array_length(v_me->'members') <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : foyer de B après l''arrivée : %', v_me;
  END IF;
  IF (SELECT count(*) FROM public.ingredients WHERE household_id = v_household) <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : garde-manger commun incomplet (riz de A, lait de B transféré)';
  END IF;
  IF v_me->'members'->0->>'name' <> 'Awa' OR v_me->'members'->1->>'name' <> 'share-test-2' THEN
    RAISE EXCEPTION 'ÉCHEC : noms des membres : %', v_me->'members';
  END IF;

  INSERT INTO public.ingredients (user_id, name) VALUES (pg_temp.u(2), 'pain de B');
  IF (SELECT household_id FROM public.ingredients WHERE name = 'pain de B') <> v_household THEN
    RAISE EXCEPTION 'ÉCHEC : nouvel ingrédient hors du foyer actif';
  END IF;

  PERFORM pg_temp.login(1);
  IF (public.my_household()->>'id')::uuid <> v_household OR public.my_household()->>'role' <> 'owner' THEN
    RAISE EXCEPTION 'ÉCHEC : A n''est pas propriétaire du foyer partagé';
  END IF;
  IF (SELECT count(*) FROM public.households WHERE is_personal) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : A n''a pas reçu de nouveau foyer personnel';
  END IF;
  IF pg_temp.error_of('SELECT public.join_household(''' || (SELECT value FROM ctx WHERE key = 'code') || ''', false)') <> 'already_member' THEN
    RAISE EXCEPTION 'ÉCHEC : A peut rejoindre son propre foyer';
  END IF;
  RAISE NOTICE 'OK : arrivée avec transfert, foyer de l''invitant partagé, nouvel invitant personnel, ingrédient ajouté au foyer actif';
END;
$$;

-- 3. Auteur des ingrédients non modifiable ; écritures directes interdites
DO $$
DECLARE
  v_rows integer;
BEGIN
  PERFORM pg_temp.login(2);
  IF pg_temp.error_of('UPDATE public.ingredients SET user_id = ''' || pg_temp.u(2) || ''' WHERE name = ''riz de A''') <> 'ingredient_author_locked' THEN
    RAISE EXCEPTION 'ÉCHEC : B peut s''attribuer l''ingrédient de A';
  END IF;
  UPDATE public.ingredients SET quantity = '500 g' WHERE name = 'riz de A';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'ÉCHEC : B ne peut pas modifier un ingrédient du foyer'; END IF;

  PERFORM pg_temp.login(3);
  IF (SELECT count(*) FROM public.ingredients) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : C voit le garde-manger d''un foyer dont il n''est pas membre';
  END IF;
  IF pg_temp.error_of('INSERT INTO public.household_members (household_id, user_id) VALUES (''' || (SELECT value FROM ctx WHERE key = 'household') || ''', ''' || pg_temp.u(3) || ''')') = 'ok' THEN
    RAISE EXCEPTION 'ÉCHEC : C s''ajoute directement au foyer';
  END IF;
  IF pg_temp.error_of('INSERT INTO public.household_invites (code, household_id) VALUES (''ABCDEF'', ''' || (SELECT value FROM ctx WHERE key = 'household') || ''')') = 'ok' THEN
    RAISE EXCEPTION 'ÉCHEC : C crée une invitation directement';
  END IF;
  RAISE NOTICE 'OK : auteur non modifiable, modification permise aux membres, aucun accès ni écriture directe pour un non-membre';
END;
$$;

-- 4. Invitation expirée
RESET ROLE;
INSERT INTO public.household_invites (code, household_id, created_by, created_at, expires_at)
VALUES ('EXPRD2', (SELECT value FROM ctx WHERE key = 'household')::uuid, pg_temp.u(1), now() - interval '49 hours', now() - interval '1 hour');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM pg_temp.login(3);
  IF pg_temp.error_of('SELECT public.join_household(''EXPRD2'', false)') <> 'expired_code' THEN
    RAISE EXCEPTION 'ÉCHEC : invitation expirée acceptée';
  END IF;
  RAISE NOTICE 'OK : invitation expirée refusée';
END;
$$;

-- 5. Limite de 8 membres ; un seul foyer partagé par utilisateur
DO $$
DECLARE
  v_code text;
  n integer;
BEGIN
  PERFORM pg_temp.login(1);
  v_code := public.create_household_invite()->>'code';
  FOR n IN 3..8 LOOP
    PERFORM pg_temp.login(n);
    PERFORM public.join_household(v_code, false);
  END LOOP;
  IF (SELECT count(*) FROM public.household_members WHERE household_id = (SELECT value FROM ctx WHERE key = 'household')::uuid) <> 8 THEN
    RAISE EXCEPTION 'ÉCHEC : le foyer n''a pas 8 membres';
  END IF;
  PERFORM pg_temp.login(9);
  IF pg_temp.error_of('SELECT public.join_household(''' || v_code || ''', false)') <> 'household_full' THEN
    RAISE EXCEPTION 'ÉCHEC : 9e membre accepté';
  END IF;
  PERFORM pg_temp.login(1);
  IF pg_temp.error_of('SELECT public.create_household_invite()') <> 'household_full' THEN
    RAISE EXCEPTION 'ÉCHEC : invitation créée pour un foyer complet';
  END IF;

  -- 10 invite 3, déjà dans un foyer partagé
  PERFORM pg_temp.login(10);
  v_code := public.create_household_invite()->>'code';
  PERFORM pg_temp.login(3);
  IF pg_temp.error_of('SELECT public.join_household(''' || v_code || ''', false)') <> 'already_in_household' THEN
    RAISE EXCEPTION 'ÉCHEC : C rejoint un deuxième foyer partagé';
  END IF;
  RAISE NOTICE 'OK : 8 membres au plus (arrivée et invitation refusées au-delà), un seul foyer partagé par utilisateur';
END;
$$;

-- 6. Retrait d'un membre : propriétaire seulement
DO $$
BEGIN
  PERFORM pg_temp.login(2);
  IF pg_temp.error_of('SELECT public.remove_household_member(''' || pg_temp.u(3) || ''')') <> 'not_owner' THEN
    RAISE EXCEPTION 'ÉCHEC : un membre retire un autre membre';
  END IF;
  PERFORM pg_temp.login(1);
  IF pg_temp.error_of('SELECT public.remove_household_member(''' || pg_temp.u(1) || ''')') <> 'cannot_remove_self' THEN
    RAISE EXCEPTION 'ÉCHEC : le propriétaire se retire lui-même';
  END IF;
  PERFORM public.remove_household_member(pg_temp.u(3));
  PERFORM pg_temp.login(3);
  IF (public.my_household()->>'shared')::boolean THEN
    RAISE EXCEPTION 'ÉCHEC : C retiré n''est pas revenu à son foyer personnel';
  END IF;
  IF (SELECT count(*) FROM public.ingredients WHERE name = 'riz de A') <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : C retiré voit encore le garde-manger du foyer';
  END IF;
  RAISE NOTICE 'OK : seul le propriétaire retire un membre (pas lui-même) ; le membre retiré retrouve son foyer personnel';
END;
$$;

-- 7. Départ du propriétaire : le membre le plus ancien (B) devient propriétaire
DO $$
BEGIN
  PERFORM pg_temp.login(1);
  PERFORM public.leave_household();
  IF (public.my_household()->>'shared')::boolean OR jsonb_array_length(public.my_household()->'members') <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : A n''a pas retrouvé son foyer personnel';
  END IF;
  IF (SELECT count(*) FROM public.ingredients) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : A voit encore le garde-manger partagé';
  END IF;
  IF pg_temp.error_of('SELECT public.leave_household()') <> 'not_in_shared_household' THEN
    RAISE EXCEPTION 'ÉCHEC : quitter son foyer personnel';
  END IF;
  PERFORM pg_temp.login(2);
  IF public.my_household()->>'role' <> 'owner' THEN
    RAISE EXCEPTION 'ÉCHEC : B (le plus ancien) n''est pas devenu propriétaire';
  END IF;
  IF (SELECT count(*) FROM public.ingredients WHERE name = 'riz de A') <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : l''ingrédient de A a quitté le foyer avec lui';
  END IF;
  RAISE NOTICE 'OK : départ du propriétaire, le plus ancien devient propriétaire, le garde-manger reste au foyer';
END;
$$;

-- 8. Suppression du compte du propriétaire (B) : propriété transférée, ses ingrédients restent au foyer
RESET ROLE;
DELETE FROM auth.users WHERE id = pg_temp.u(2);
DO $$
DECLARE
  v_household uuid := (SELECT value FROM ctx WHERE key = 'household')::uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = v_household) THEN
    RAISE EXCEPTION 'ÉCHEC : foyer supprimé avec le compte de son propriétaire';
  END IF;
  IF (SELECT user_id FROM public.household_members WHERE household_id = v_household AND role = 'owner') <> pg_temp.u(4) THEN
    RAISE EXCEPTION 'ÉCHEC : le membre le plus ancien (4) n''est pas devenu propriétaire';
  END IF;
  IF (SELECT count(*) FROM public.ingredients WHERE household_id = v_household AND name IN ('lait de B', 'pain de B') AND user_id IS NULL) <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : ingrédients de B supprimés ou auteur non vidé';
  END IF;
  IF EXISTS (SELECT 1 FROM public.households WHERE created_by = pg_temp.u(2) OR (is_personal AND created_by IS NULL)) THEN
    RAISE EXCEPTION 'ÉCHEC : foyer personnel de B conservé';
  END IF;
  RAISE NOTICE 'OK : compte du propriétaire supprimé, propriété transférée, ingrédients conservés sans auteur, foyer personnel supprimé';
END;
$$;

-- 9. Le dernier membre part : foyer supprimé, garde-manger récupéré dans son foyer personnel
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  n integer;
  v_household uuid := (SELECT value FROM ctx WHERE key = 'household')::uuid;
BEGIN
  FOR n IN 4..8 LOOP
    PERFORM pg_temp.login(n);
    PERFORM public.leave_household();
  END LOOP;
  IF (SELECT count(*) FROM public.ingredients WHERE name IN ('riz de A', 'lait de B', 'pain de B')) <> 3 THEN
    RAISE EXCEPTION 'ÉCHEC : le dernier membre (8) n''a pas récupéré le garde-manger';
  END IF;
  IF public.is_household_member(v_household) THEN
    RAISE EXCEPTION 'ÉCHEC : 8 est encore membre du foyer';
  END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.households WHERE id = (SELECT value FROM ctx WHERE key = 'household')::uuid) THEN
    RAISE EXCEPTION 'ÉCHEC : foyer conservé après le départ du dernier membre';
  END IF;
  RAISE NOTICE 'OK : dernier membre parti, foyer supprimé, garde-manger récupéré dans son foyer personnel';
END;
$$;

-- 10. Visiteur non connecté : aucune fonction du foyer
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
DO $$
BEGIN
  IF pg_temp.error_of('SELECT public.my_household()') !~ 'permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : my_household appelable sans connexion';
  END IF;
  IF pg_temp.error_of('SELECT public.join_household(''ABCDEF'', false)') !~ 'permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : join_household appelable sans connexion';
  END IF;
  RAISE NOTICE 'OK : aucune fonction du foyer sans connexion';
END;
$$;

ROLLBACK;
