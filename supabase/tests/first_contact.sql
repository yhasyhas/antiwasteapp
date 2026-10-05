-- Tests de la phase 10 (partie A) : premier lancement (onboarded_at), « Mes basiques », notes des recettes, avis et
-- signalements (règles d'accès, valeurs refusées, limite de 20 par jour).
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/first_contact.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-a000-0000000010aa', 'contact-a@example.com'),
  ('00000000-0000-4000-a000-0000000010bb', 'contact-b@example.com');
INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-4000-a000-0000000010aa', 'contact-a@example.com'),
  ('00000000-0000-4000-a000-0000000010bb', 'contact-b@example.com') ON CONFLICT DO NOTHING;
INSERT INTO public.recipes (id, user_id, title) VALUES
  ('00000000-0000-4000-a000-0000000010a1', '00000000-0000-4000-a000-0000000010aa', 'Recette de A'),
  ('00000000-0000-4000-a000-0000000010b1', '00000000-0000-4000-a000-0000000010bb', 'Recette de B');

CREATE FUNCTION pg_temp.login(p_user text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

SET LOCAL ROLE authenticated;
SELECT pg_temp.login('00000000-0000-4000-a000-0000000010aa');

DO $$
DECLARE
  n integer;
  i integer;
BEGIN
  -- 1. Premier lancement : vide pour un nouveau compte, puis noté une fois passé
  SELECT count(*) INTO n FROM profiles WHERE id = '00000000-0000-4000-a000-0000000010aa' AND onboarded_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'nouveau compte déjà marqué « premier lancement passé »'; END IF;
  UPDATE profiles SET onboarded_at = now() WHERE id = '00000000-0000-4000-a000-0000000010aa';
  RAISE NOTICE 'OK 1 : premier lancement noté';

  -- 2. Mes basiques : liste acceptée, liste trop longue refusée
  INSERT INTO user_preferences (user_id, basics) VALUES ('00000000-0000-4000-a000-0000000010aa', ARRAY['salt', 'pepper', 'garlic', 'spices', 'sauce soja'])
    ON CONFLICT (user_id) DO UPDATE SET basics = EXCLUDED.basics;
  BEGIN
    UPDATE user_preferences SET basics = array_fill('x'::text, ARRAY[31]) WHERE user_id = '00000000-0000-4000-a000-0000000010aa';
    RAISE EXCEPTION '31 basiques acceptés';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK 2 : basiques';

  -- 3. Notes : valeurs connues seulement ; la recette d'un autre n'est pas touchée
  UPDATE recipes SET rating = 'disliked', rated_at = now() WHERE id = '00000000-0000-4000-a000-0000000010a1';
  BEGIN
    UPDATE recipes SET rating = 'meh' WHERE id = '00000000-0000-4000-a000-0000000010a1';
    RAISE EXCEPTION 'note inconnue acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE recipes SET rating = 'liked' WHERE id = '00000000-0000-4000-a000-0000000010b1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'recette d''un autre utilisateur notée'; END IF;
  RAISE NOTICE 'OK 3 : notes';

  -- 4. Avis : enregistré pour soi seulement ; type inconnu et texte vide refusés
  INSERT INTO feedback (user_id, kind, message, app_version, device, os, language)
    VALUES ('00000000-0000-4000-a000-0000000010aa', 'idea', 'Une idée', '1.0.0', 'samsung SM-A305F', 'android 11', 'fr');
  BEGIN
    INSERT INTO feedback (user_id, kind, message) VALUES ('00000000-0000-4000-a000-0000000010bb', 'idea', 'Au nom d''un autre');
    RAISE EXCEPTION 'avis au nom d''un autre accepté';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO feedback (user_id, kind, message) VALUES ('00000000-0000-4000-a000-0000000010aa', 'spam', 'x');
    RAISE EXCEPTION 'type inconnu accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO feedback (user_id, kind, message) VALUES ('00000000-0000-4000-a000-0000000010aa', 'other', '   ');
    RAISE EXCEPTION 'avis vide accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK 4 : avis';

  -- 5. Signalements : sa propre recette seulement, raison connue
  INSERT INTO recipe_reports (user_id, recipe_id, reason, recipe_snapshot)
    VALUES ('00000000-0000-4000-a000-0000000010aa', '00000000-0000-4000-a000-0000000010a1', 'dangerous', '{"title": "Recette de A"}');
  BEGIN
    INSERT INTO recipe_reports (user_id, recipe_id, reason) VALUES ('00000000-0000-4000-a000-0000000010aa', '00000000-0000-4000-a000-0000000010b1', 'bad');
    RAISE EXCEPTION 'signalement de la recette d''un autre accepté';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO recipe_reports (user_id, recipe_id, reason) VALUES ('00000000-0000-4000-a000-0000000010aa', '00000000-0000-4000-a000-0000000010a1', 'boring');
    RAISE EXCEPTION 'raison inconnue acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'OK 5 : signalements';

  -- 6. Limite : 20 avis par jour (1 déjà envoyé), le 21e refusé
  FOR i IN 1..19 LOOP
    INSERT INTO feedback (user_id, kind, message) VALUES ('00000000-0000-4000-a000-0000000010aa', 'other', 'Avis ' || i);
  END LOOP;
  BEGIN
    INSERT INTO feedback (user_id, kind, message) VALUES ('00000000-0000-4000-a000-0000000010aa', 'other', 'Avis de trop');
    RAISE EXCEPTION '21e avis du jour accepté';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'daily_limit' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK 6 : limite de 20 par jour';
END;
$$;

-- 7. Un autre utilisateur ne voit ni les avis ni les signalements de A
SELECT pg_temp.login('00000000-0000-4000-a000-0000000010bb');
DO $$
DECLARE
  n integer;
BEGIN
  SELECT (SELECT count(*) FROM feedback) + (SELECT count(*) FROM recipe_reports) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'avis ou signalements d''un autre utilisateur visibles (%)', n; END IF;
  RAISE NOTICE 'OK 7 : avis et signalements privés';
END;
$$;

ROLLBACK;
