/*
  # Résumé quotidien envoyé par le serveur (notifications push, phase 6a)

  - `push_tokens` : jeton Expo Push de chaque appareil, avec le fuseau horaire et la langue de l'app.
    Un jeton n'appartient qu'à un utilisateur (reconnexion avec un autre compte sur le même téléphone :
    le jeton change de propriétaire). Écriture par les fonctions register / unregister seulement.
  - `daily_digests` : un résumé par utilisateur et par jour local au plus (clé primaire) : jamais de
    notification en double, même si deux exécutions se chevauchent. Suivi des reçus d'Expo Push.
  - `claim_daily_digests` : utilisateurs dont il est 9 h (9 h à 11 h 59 en rattrapage) dans leur fuseau,
    résumé du jour réservé, aliments du foyer actif qui expirent aujourd'hui ou demain. Rien à signaler :
    jour marqué « nothing », aucune notification.
  - Tâche pg_cron toutes les 15 minutes (fuseaux à la demi-heure et au quart d'heure compris) qui appelle
    l'Edge Function daily-digest, avec un secret lu dans Vault (créé hors migration).
  - `provider_quota_events` accepte `expo_push` : une alerte Sentry par jour en cas d'échec d'envoi.

  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. Jetons des appareils

CREATE TABLE IF NOT EXISTS push_tokens (
  token text PRIMARY KEY CHECK (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  timezone text NOT NULL DEFAULT 'UTC',
  language text NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'es')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text, p_timezone text, p_language text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.push_tokens (token, user_id, platform, timezone, language, updated_at)
  VALUES (
    p_token, v_user, p_platform,
    -- Fuseau inconnu de PostgreSQL : UTC
    CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = p_timezone) THEN p_timezone ELSE 'UTC' END,
    CASE WHEN p_language IN ('fr', 'en', 'es') THEN p_language ELSE 'fr' END,
    now()
  )
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, timezone = EXCLUDED.timezone,
        language = EXCLUDED.language, updated_at = now();
END;
$$;

-- Déconnexion : l'appareil ne reçoit plus les résumés de ce compte
CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.push_tokens WHERE token = p_token AND user_id = (SELECT auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.register_push_token(text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unregister_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(text) TO authenticated;

-- 2. Résumés envoyés (un par utilisateur et par jour local)

CREATE TABLE IF NOT EXISTS daily_digests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'nothing', 'failed')),
  items_count integer NOT NULL DEFAULT 0,
  ticket_ids text[] NOT NULL DEFAULT '{}',
  receipts_checked boolean NOT NULL DEFAULT false,
  error text CHECK (error IS NULL OR char_length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (user_id, local_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_digests_receipts ON daily_digests(sent_at) WHERE status = 'sent' AND NOT receipts_checked;

ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- 3. Résumés à envoyer maintenant (réservés : une seule exécution les obtient). Réservé aux fonctions.
--    p_only_user : un seul utilisateur ; p_force : quelle que soit l'heure (essais)

CREATE OR REPLACE FUNCTION public.claim_daily_digests(p_hour integer DEFAULT 9, p_only_user uuid DEFAULT NULL, p_force boolean DEFAULT false)
RETURNS TABLE (
  user_id uuid,
  local_date date,
  language text,
  tokens text[],
  today jsonb,
  tomorrow jsonb,
  pantry_size integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH devices AS (
    -- Fuseau et langue de l'appareil utilisé le plus récemment
    SELECT DISTINCT ON (t.user_id) t.user_id, t.timezone, t.language
    FROM public.push_tokens t
    WHERE p_only_user IS NULL OR t.user_id = p_only_user
    ORDER BY t.user_id, t.updated_at DESC
  ),
  due AS (
    SELECT d.user_id, (now() AT TIME ZONE d.timezone)::date AS local_date, d.language,
           public.active_household_of(d.user_id) AS household_id
    FROM devices d
    WHERE p_force
       OR extract(hour FROM now() AT TIME ZONE d.timezone) BETWEEN p_hour AND p_hour + 2
  ),
  contents AS (
    SELECT due.*,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                FROM public.ingredients i WHERE i.household_id = due.household_id AND i.expires_at = due.local_date), '[]') AS today,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) ORDER BY i.name)
                FROM public.ingredients i WHERE i.household_id = due.household_id AND i.expires_at = due.local_date + 1), '[]') AS tomorrow,
      (SELECT count(*)::integer FROM public.ingredients i WHERE i.household_id = due.household_id) AS pantry_size
    FROM due
  ),
  claimed AS (
    INSERT INTO public.daily_digests AS dd (user_id, local_date, status, items_count)
    SELECT c.user_id, c.local_date,
           CASE WHEN jsonb_array_length(c.today) + jsonb_array_length(c.tomorrow) = 0 THEN 'nothing' ELSE 'sending' END,
           jsonb_array_length(c.today) + jsonb_array_length(c.tomorrow)
    FROM contents c
    ON CONFLICT ON CONSTRAINT daily_digests_pkey DO NOTHING
    RETURNING dd.user_id, dd.local_date, dd.status
  )
  SELECT c.user_id, c.local_date, c.language,
         ARRAY(SELECT t.token FROM public.push_tokens t WHERE t.user_id = c.user_id ORDER BY t.token),
         c.today, c.tomorrow, c.pantry_size
  FROM contents c
  JOIN claimed cl ON cl.user_id = c.user_id AND cl.local_date = c.local_date
  WHERE cl.status = 'sending';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_digests(integer, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_digests(integer, uuid, boolean) TO service_role;

-- 4. Échecs d'envoi : une alerte Sentry par jour, comme les quotas des fournisseurs

ALTER TABLE provider_quota_events DROP CONSTRAINT provider_quota_events_provider_check;
ALTER TABLE provider_quota_events ADD CONSTRAINT provider_quota_events_provider_check
  CHECK (provider IN ('gemini', 'groq', 'cloudflare', 'expo_push'));

-- 5. Tâche planifiée : toutes les 15 minutes, appel de daily-digest avec le secret gardé dans Vault
--    (secret « daily_digest_cron_secret », égal au secret CRON_SECRET de la fonction)

SELECT cron.schedule(
  'daily-digest',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://iqzjonmjlscuckdmiehk.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'daily_digest_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
