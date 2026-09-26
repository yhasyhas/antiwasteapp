-- Tests des colonnes anti-gaspi du garde-manger (péremption, catégorie, type, conseil, code-barres).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/ingredients_expiry.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.
-- Chaque test affiche « OK : … » ; le premier échec interrompt le script avec « ÉCHEC : … ».

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-00000000001a', 'expiry-test-a@example.com'),
  ('00000000-0000-4000-a000-00000000001b', 'expiry-test-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-00000000001a', 'expiry-test-a@example.com'),
  ('00000000-0000-4000-a000-00000000001b', 'expiry-test-b@example.com');

INSERT INTO public.ingredients (id, user_id, name) VALUES
  ('00000000-0000-4000-b000-00000000001b', '00000000-0000-4000-a000-00000000001b', 'ingrédient de B');

-- En tant que A, connecté, comme l'app
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-a000-00000000001a", "role": "authenticated"}', true);

DO $$
DECLARE
  v_rows integer;
  v_row public.ingredients;
BEGIN
  -- Ajout avec toutes les nouvelles colonnes
  INSERT INTO public.ingredients (id, user_id, name, expires_at, category, kind, storage_tip, barcode, added_via)
  VALUES ('00000000-0000-4000-b000-00000000001a', '00000000-0000-4000-a000-00000000001a', 'reste de riz',
          current_date + 2, 'grain', 'dish', 'Au frigo, dans une boîte fermée, 2 jours', NULL, 'camera');
  INSERT INTO public.ingredients (user_id, name, category, barcode, added_via)
  VALUES ('00000000-0000-4000-a000-00000000001a', 'yaourt nature', 'dairy', '3017620422003', 'barcode');
  RAISE NOTICE 'OK : A ajoute un reste (date, catégorie, conseil) et un produit avec code-barres';

  -- Valeur par défaut de kind
  INSERT INTO public.ingredients (user_id, name) VALUES ('00000000-0000-4000-a000-00000000001a', 'tomate')
  RETURNING * INTO v_row;
  IF v_row.kind <> 'ingredient' OR v_row.expires_at IS NOT NULL OR v_row.category IS NOT NULL THEN
    RAISE EXCEPTION 'ÉCHEC : valeurs par défaut inattendues (kind %, expires_at %, category %)', v_row.kind, v_row.expires_at, v_row.category;
  END IF;
  RAISE NOTICE 'OK : sans précision, kind = ingredient, sans date ni catégorie';

  -- Modification de la date par A
  UPDATE public.ingredients SET expires_at = current_date + 7 WHERE id = '00000000-0000-4000-b000-00000000001a';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'ÉCHEC : A ne peut pas changer la date de son ingrédient'; END IF;
  RAISE NOTICE 'OK : A change la date de péremption de son ingrédient';

  -- Valeurs refusées par les contraintes
  BEGIN
    INSERT INTO public.ingredients (user_id, name, kind) VALUES ('00000000-0000-4000-a000-00000000001a', 'x', 'plat');
    RAISE EXCEPTION 'ÉCHEC : kind inconnu accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ingredients (user_id, name, category) VALUES ('00000000-0000-4000-a000-00000000001a', 'x', 'légume');
    RAISE EXCEPTION 'ÉCHEC : catégorie inconnue acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ingredients (user_id, name, storage_tip) VALUES ('00000000-0000-4000-a000-00000000001a', 'x', repeat('a', 201));
    RAISE EXCEPTION 'ÉCHEC : conseil de conservation trop long accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ingredients (user_id, name, barcode) VALUES ('00000000-0000-4000-a000-00000000001a', 'x', 'abc123');
    RAISE EXCEPTION 'ÉCHEC : code-barres mal formé accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK : kind, catégorie, conseil trop long et code-barres mal formé refusés';

  -- Les règles du foyer s'appliquent aux nouvelles colonnes
  IF EXISTS (SELECT 1 FROM public.ingredients WHERE id = '00000000-0000-4000-b000-00000000001b') THEN
    RAISE EXCEPTION 'ÉCHEC : A voit un ingrédient de B';
  END IF;
  UPDATE public.ingredients SET expires_at = current_date WHERE id = '00000000-0000-4000-b000-00000000001b';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'ÉCHEC : A a changé la date d''un ingrédient de B'; END IF;
  RAISE NOTICE 'OK : A ne voit pas les dates de B et ne peut pas les changer';
END;
$$;

ROLLBACK;
