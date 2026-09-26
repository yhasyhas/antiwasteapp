/*
  # Quotas des fournisseurs d'IA épuisés (Gemini, Groq, Cloudflare)

  - `provider_quota_events` : une ligne par fournisseur et par jour (UTC) où son quota a été épuisé,
    avec la fonction concernée, le nombre d'occurrences et la dernière erreur. Sert à n'envoyer qu'une
    alerte Sentry par jour et par fournisseur, et à l'écran « État des services » (développement).
    `simulated` sépare les essais (erreurs simulées) des vrais épuisements.
  - `record_provider_quota` : enregistre un épuisement et renvoie vrai s'il est le premier du jour pour ce
    fournisseur (alerte à envoyer). Réservée aux fonctions (clé secrète).
  - Lecture : utilisateurs connectés (aucune donnée personnelle : noms des fournisseurs et messages
    d'erreur des fournisseurs). Écriture : jamais depuis l'app.

  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

CREATE TABLE IF NOT EXISTS provider_quota_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('gemini', 'groq', 'cloudflare')),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  simulated boolean NOT NULL DEFAULT false,
  function_name text NOT NULL CHECK (char_length(function_name) <= 60),
  occurrences integer NOT NULL DEFAULT 1,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  UNIQUE (provider, day, simulated)
);

ALTER TABLE provider_quota_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read provider quota events"
  ON provider_quota_events FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION record_provider_quota(
  p_provider text,
  p_function text,
  p_error text,
  p_simulated boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first boolean;
BEGIN
  INSERT INTO provider_quota_events (provider, simulated, function_name, last_error)
  VALUES (p_provider, p_simulated, left(p_function, 60), left(p_error, 500))
  ON CONFLICT (provider, day, simulated) DO UPDATE
    SET occurrences = provider_quota_events.occurrences + 1,
        last_at = now(),
        function_name = EXCLUDED.function_name,
        last_error = EXCLUDED.last_error
  RETURNING (xmax = 0) INTO v_first;
  RETURN v_first;
END;
$$;

REVOKE ALL ON FUNCTION record_provider_quota(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_provider_quota(text, text, text, boolean) TO service_role;
