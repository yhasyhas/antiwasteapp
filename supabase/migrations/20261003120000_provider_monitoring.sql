/*
  # Surveillance du secours des fournisseurs d'IA

  1. `provider_quota_events.alert` : type d'incident (`provider_quota` quota épuisé, `push_failure` échec
     d'envoi des notifications, `provider_failure` dysfonctionnement : réponse refusée, schéma invalide,
     réponse illisible). Une ligne par fournisseur, jour et type : une alerte Sentry au plus par jour pour
     chacun. Les lignes existantes d'expo_push passent en `push_failure` (seule donnée modifiée).
  2. `record_provider_quota` prend le type d'incident (`p_alert`, `provider_quota` par défaut).
  3. `provider_usage_daily` : nombre de générations et de recettes servies, par jour, fonction et
     fournisseur, en distinguant le secours (`fallback`). Sert à « État des services » (part des recettes
     servies par le secours sur 7 jours). Aucune donnée personnelle. Lecture : utilisateurs connectés ;
     écriture : fonctions seulement (`record_provider_usage`, clé secrète).
*/

-- 1. Type d'incident

ALTER TABLE provider_quota_events
  ADD COLUMN IF NOT EXISTS alert text NOT NULL DEFAULT 'provider_quota'
  CHECK (alert IN ('provider_quota', 'push_failure', 'provider_failure'));

UPDATE provider_quota_events SET alert = 'push_failure' WHERE provider = 'expo_push' AND alert <> 'push_failure';

ALTER TABLE provider_quota_events DROP CONSTRAINT IF EXISTS provider_quota_events_provider_day_simulated_key;
ALTER TABLE provider_quota_events ADD CONSTRAINT provider_quota_events_provider_day_simulated_alert_key
  UNIQUE (provider, day, simulated, alert);

-- 2. Enregistrement avec le type d'incident ; vrai si c'est le premier du jour (alerte à envoyer)

DROP FUNCTION IF EXISTS record_provider_quota(text, text, text, boolean);

CREATE FUNCTION record_provider_quota(
  p_provider text,
  p_function text,
  p_error text,
  p_simulated boolean DEFAULT false,
  p_alert text DEFAULT 'provider_quota'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first boolean;
BEGIN
  INSERT INTO provider_quota_events (provider, simulated, function_name, last_error, alert)
  VALUES (p_provider, p_simulated, left(p_function, 60), left(p_error, 500), p_alert)
  ON CONFLICT (provider, day, simulated, alert) DO UPDATE
    SET occurrences = provider_quota_events.occurrences + 1,
        last_at = now(),
        function_name = EXCLUDED.function_name,
        last_error = EXCLUDED.last_error
  RETURNING (xmax = 0) INTO v_first;
  RETURN v_first;
END;
$$;

REVOKE ALL ON FUNCTION record_provider_quota(text, text, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_provider_quota(text, text, text, boolean, text) TO service_role;

-- 3. Générations servies, par fournisseur

CREATE TABLE IF NOT EXISTS provider_usage_daily (
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  function_name text NOT NULL CHECK (char_length(function_name) <= 60),
  provider text NOT NULL CHECK (char_length(provider) <= 30),
  fallback boolean NOT NULL,
  simulated boolean NOT NULL DEFAULT false,
  generations integer NOT NULL DEFAULT 0,
  recipes integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, function_name, provider, fallback, simulated)
);

ALTER TABLE provider_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read provider usage"
  ON provider_usage_daily FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION record_provider_usage(
  p_function text,
  p_provider text,
  p_fallback boolean,
  p_recipes integer,
  p_simulated boolean DEFAULT false
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO provider_usage_daily (function_name, provider, fallback, simulated, generations, recipes)
  VALUES (left(p_function, 60), left(p_provider, 30), p_fallback, p_simulated, 1, greatest(p_recipes, 0))
  ON CONFLICT (day, function_name, provider, fallback, simulated) DO UPDATE
    SET generations = provider_usage_daily.generations + 1,
        recipes = provider_usage_daily.recipes + EXCLUDED.recipes;
$$;

REVOKE ALL ON FUNCTION record_provider_usage(text, text, boolean, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_provider_usage(text, text, boolean, integer, boolean) TO service_role;
