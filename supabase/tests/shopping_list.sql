-- Tests de la liste de courses du foyer : ajout sans doublon, partage entre membres, achat, rangement au
-- garde-manger, auteur figé, aucun accès hors du foyer.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/shopping_list.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-4000-a000-0000000008' || lpad(n::text, 2, '0'))::uuid, 'shop-test-' || n || '@example.com'
FROM generate_series(1, 3) AS n;
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users WHERE email LIKE 'shop-test-%@example.com';

CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('00000000-0000-4000-a000-0000000008' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.login(n integer) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(n), 'role', 'authenticated')::text, true) $$;
CREATE FUNCTION pg_temp.error_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END;
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_code text;
  v_household uuid;
  v_rows integer;
BEGIN
  -- 1 invite 2 : foyer partagé
  PERFORM pg_temp.login(1);
  v_code := public.create_household_invite()->>'code';
  PERFORM pg_temp.login(2);
  v_household := public.join_household(v_code, false);

  -- Ajout en une fois, sans doublon (casse et espaces ignorés)
  PERFORM pg_temp.login(1);
  IF public.add_to_shopping_list(ARRAY['Tomates', ' tomates ', 'Lait', ''], NULL, 'Gratin') <> 2 THEN
    RAISE EXCEPTION 'ÉCHEC : ajout des ingrédients manquants (doublons ou vides acceptés)';
  END IF;
  IF public.add_to_shopping_list(ARRAY['lait', 'Œufs']) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : article déjà sur la liste ajouté une seconde fois';
  END IF;
  INSERT INTO public.shopping_items (name, quantity) VALUES ('Pain', '1');
  IF (SELECT count(*) FROM public.shopping_items WHERE household_id = v_household) <> 4 THEN
    RAISE EXCEPTION 'ÉCHEC : articles hors du foyer actif';
  END IF;

  -- 2 voit la liste, coche le lait, puis le range au garde-manger avec une date
  PERFORM pg_temp.login(2);
  IF (SELECT count(*) FROM public.shopping_items) <> 4 THEN
    RAISE EXCEPTION 'ÉCHEC : liste non partagée avec le membre';
  END IF;
  UPDATE public.shopping_items SET checked = true WHERE name = 'Lait';
  IF (SELECT checked_by FROM public.shopping_items WHERE name = 'Lait') <> pg_temp.u(2) THEN
    RAISE EXCEPTION 'ÉCHEC : « acheté par » non enregistré';
  END IF;
  IF pg_temp.error_of('UPDATE public.shopping_items SET added_by = ''' || pg_temp.u(2) || ''' WHERE name = ''Pain''') <> 'shopping_author_locked' THEN
    RAISE EXCEPTION 'ÉCHEC : auteur d''un article modifiable';
  END IF;
  IF public.stock_shopping_items(jsonb_build_array(jsonb_build_object(
       'id', (SELECT id FROM public.shopping_items WHERE name = 'Lait'), 'expires_at', '2030-01-15'))) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : article non rangé au garde-manger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingredients WHERE household_id = v_household AND name = 'Lait'
                 AND expires_at = '2030-01-15' AND added_via = 'shopping' AND user_id = pg_temp.u(2))
     OR EXISTS (SELECT 1 FROM public.shopping_items WHERE name = 'Lait') THEN
    RAISE EXCEPTION 'ÉCHEC : rangement incomplet (ingrédient, date, auteur, article retiré)';
  END IF;

  -- 3, hors du foyer : rien à voir, rien à écrire
  PERFORM pg_temp.login(3);
  IF (SELECT count(*) FROM public.shopping_items) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : un non-membre voit la liste du foyer';
  END IF;
  IF pg_temp.error_of('INSERT INTO public.shopping_items (household_id, name) VALUES (''' || v_household || ''', ''intrus'')') = 'ok' THEN
    RAISE EXCEPTION 'ÉCHEC : un non-membre ajoute à la liste du foyer';
  END IF;
  UPDATE public.shopping_items SET checked = true;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : un non-membre coche un article'; END IF;
  IF public.stock_shopping_items(jsonb_build_array(jsonb_build_object(
       'id', (SELECT id FROM public.shopping_items LIMIT 1), 'expires_at', null))) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : un non-membre range un article du foyer';
  END IF;
  RAISE NOTICE 'OK : ajout sans doublon, liste partagée, acheté par, rangement au garde-manger, auteur figé, aucun accès hors du foyer';
END;
$$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role": "anon"}', true);
DO $$
BEGIN
  IF pg_temp.error_of('SELECT public.add_to_shopping_list(ARRAY[''x''])') !~ 'permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : ajout sans connexion';
  END IF;
  RAISE NOTICE 'OK : rien sans connexion';
END;
$$;

ROLLBACK;
