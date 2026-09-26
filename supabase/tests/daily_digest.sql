-- Tests du résumé quotidien : jetons des appareils, heure locale, contenu (foyer actif), aucun doublon,
-- droits, tâche planifiée.
--
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/daily_digest.sql
--
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;

INSERT INTO auth.users (id, email)
SELECT ('00000000-0000-4000-a000-0000000007' || lpad(n::text, 2, '0'))::uuid, 'digest-test-' || n || '@example.com'
FROM generate_series(1, 3) AS n;
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users WHERE email LIKE 'digest-test-%@example.com';

CREATE FUNCTION pg_temp.u(n integer) RETURNS uuid LANGUAGE sql AS
  $$ SELECT ('00000000-0000-4000-a000-0000000007' || lpad(n::text, 2, '0'))::uuid $$;
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
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon, service_role;

-- Garde-manger de 1 : deux aliments qui expirent aujourd'hui (heure de Paris), un demain, un plus tard
INSERT INTO public.ingredients (user_id, name, expires_at) VALUES
  (pg_temp.u(1), 'crème', (now() AT TIME ZONE 'Europe/Paris')::date),
  (pg_temp.u(1), 'tomates', (now() AT TIME ZONE 'Europe/Paris')::date),
  (pg_temp.u(1), 'reste de riz', (now() AT TIME ZONE 'Europe/Paris')::date + 1),
  (pg_temp.u(1), 'pâtes', (now() AT TIME ZONE 'Europe/Paris')::date + 30);
-- 2 : rien qui expire bientôt
INSERT INTO public.ingredients (user_id, name, expires_at) VALUES (pg_temp.u(2), 'riz', NULL);

-- 1. Jetons : enregistrement, validation, changement de propriétaire, lecture de ses seuls jetons
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM pg_temp.login(1);
  PERFORM public.register_push_token('ExponentPushToken[digest-test-token-1]', 'android', 'Europe/Paris', 'fr');
  PERFORM public.register_push_token('ExponentPushToken[digest-test-token-2]', 'android', 'Mars/Olympus', 'de');
  IF (SELECT timezone || '/' || language FROM public.push_tokens WHERE token = 'ExponentPushToken[digest-test-token-2]') <> 'UTC/fr' THEN
    RAISE EXCEPTION 'ÉCHEC : fuseau ou langue inconnus non remplacés par UTC et fr';
  END IF;
  IF pg_temp.error_of('SELECT public.register_push_token(''pas-un-jeton'', ''android'', ''UTC'', ''fr'')') !~ 'push_tokens_token_check' THEN
    RAISE EXCEPTION 'ÉCHEC : jeton mal formé accepté';
  END IF;
  IF pg_temp.error_of('INSERT INTO public.push_tokens (token, user_id, platform) VALUES (''ExponentPushToken[direct-insert-xyz]'', ''' || pg_temp.u(1) || ''', ''android'')') = 'ok' THEN
    RAISE EXCEPTION 'ÉCHEC : écriture directe d''un jeton';
  END IF;

  -- Même téléphone, autre compte : le jeton 2 passe à l'utilisateur 3
  PERFORM pg_temp.login(3);
  PERFORM public.register_push_token('ExponentPushToken[digest-test-token-2]', 'android', 'Europe/Paris', 'en');
  IF (SELECT count(*) FROM public.push_tokens) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : 3 voit d''autres jetons que le sien';
  END IF;
  PERFORM public.unregister_push_token('ExponentPushToken[digest-test-token-1]');
  PERFORM pg_temp.login(1);
  IF (SELECT count(*) FROM public.push_tokens) <> 1 THEN
    RAISE EXCEPTION 'ÉCHEC : jeton de 1 supprimé par un autre utilisateur, ou jeton 2 pas transféré';
  END IF;
  PERFORM pg_temp.login(2);
  PERFORM public.register_push_token('ExponentPushToken[digest-test-token-3]', 'android', 'Europe/Paris', 'fr');
  IF pg_temp.error_of('SELECT * FROM public.claim_daily_digests(9, NULL, true)') !~ 'permission denied' THEN
    RAISE EXCEPTION 'ÉCHEC : claim_daily_digests appelable depuis l''app';
  END IF;
  IF pg_temp.error_of('SELECT count(*) FROM public.daily_digests') <> 'ok' OR (SELECT count(*) FROM public.daily_digests) <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC : résumés lisibles par l''app';
  END IF;
  RAISE NOTICE 'OK : jetons validés, transférés au nouveau compte, lus et supprimés par leur seul propriétaire ; claim interdit à l''app';
END;
$$;

-- 2. Résumés (fonctions, clé secrète)
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_row record;
  v_hour integer := extract(hour FROM now() AT TIME ZONE 'Europe/Paris');
BEGIN
  -- Hors de la plage de 9 h (heure locale) : rien
  IF EXISTS (SELECT 1 FROM public.claim_daily_digests((v_hour + 12) % 24, pg_temp.u(1))) THEN
    RAISE EXCEPTION 'ÉCHEC : résumé envoyé hors de l''heure locale prévue';
  END IF;
  -- À l'heure locale prévue : le résumé de 1 (2 aujourd'hui, 1 demain, 4 aliments)
  SELECT * INTO v_row FROM public.claim_daily_digests(v_hour, pg_temp.u(1));
  IF v_row.user_id IS NULL OR jsonb_array_length(v_row.today) <> 2 OR jsonb_array_length(v_row.tomorrow) <> 1
     OR v_row.pantry_size <> 4 OR v_row.tokens <> ARRAY['ExponentPushToken[digest-test-token-1]'] OR v_row.language <> 'fr'
     OR v_row.local_date <> (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'ÉCHEC : contenu du résumé : %', row_to_json(v_row);
  END IF;
  -- Aucun doublon, même forcé
  IF EXISTS (SELECT 1 FROM public.claim_daily_digests(v_hour, pg_temp.u(1), true)) THEN
    RAISE EXCEPTION 'ÉCHEC : deuxième résumé le même jour';
  END IF;
  -- Rien qui expire : jour marqué « nothing », aucune notification
  IF EXISTS (SELECT 1 FROM public.claim_daily_digests(v_hour, pg_temp.u(2), true)) THEN
    RAISE EXCEPTION 'ÉCHEC : notification sans aliment qui expire';
  END IF;
  IF (SELECT status FROM public.daily_digests WHERE user_id = pg_temp.u(2)) <> 'nothing' THEN
    RAISE EXCEPTION 'ÉCHEC : jour sans aliment non enregistré';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_digests WHERE user_id = pg_temp.u(1) AND status = 'sending' AND items_count = 3) THEN
    RAISE EXCEPTION 'ÉCHEC : résumé de 1 non réservé';
  END IF;
  IF NOT public.record_provider_quota('expo_push', 'daily-digest', 'test', true) THEN
    RAISE EXCEPTION 'ÉCHEC : échec d''envoi non enregistré pour l''alerte';
  END IF;
  RAISE NOTICE 'OK : heure locale respectée, contenu du foyer (aujourd''hui, demain), aucun doublon, rien à signaler sans aliment, alerte expo_push';
END;
$$;

-- 3. Tâche planifiée
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-digest' AND schedule = '*/15 * * * *' AND active) THEN
    RAISE EXCEPTION 'ÉCHEC : tâche daily-digest absente';
  END IF;
  RAISE NOTICE 'OK : tâche daily-digest planifiée toutes les 15 minutes';
END;
$$;

ROLLBACK;
