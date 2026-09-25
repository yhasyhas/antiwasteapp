/*
  # Quotas : compteurs d'utilisation par jour et par utilisateur

  - `usage_counters` : une ligne par utilisateur et par jour (UTC), avec le nombre de scans,
    de générations de recettes et d'images (images : pour la phase 3).
  - Lecture de ses propres compteurs autorisée (pour afficher le reste du jour plus tard) ;
    aucune écriture par l'app : seules les Edge Functions, avec la clé secrète, les modifient.
  - `consume_quota` : incrémente le compteur si la limite n'est pas atteinte, en une seule
    requête (deux appels simultanés ne peuvent pas dépasser la limite). Renvoie false sinon.
  - `refund_quota` : rend une unité quand l'IA a échoué sans rien renvoyer à l'utilisateur.
  - Les deux fonctions ne sont exécutables que par service_role (clé secrète).
*/

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  scans integer NOT NULL DEFAULT 0,
  generations integer NOT NULL DEFAULT 0,
  images integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_counters FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.consume_quota(p_user_id uuid, p_kind text, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_kind NOT IN ('scans', 'generations', 'images') THEN
    RAISE EXCEPTION 'Type de quota inconnu : %', p_kind;
  END IF;

  INSERT INTO public.usage_counters (user_id, day)
  VALUES (p_user_id, v_day)
  ON CONFLICT (user_id, day) DO NOTHING;

  -- La condition est réévaluée après le verrou de ligne : pas de dépassement en cas d'appels simultanés
  UPDATE public.usage_counters
  SET scans = scans + (p_kind = 'scans')::int,
      generations = generations + (p_kind = 'generations')::int,
      images = images + (p_kind = 'images')::int
  WHERE user_id = p_user_id
    AND day = v_day
    AND CASE p_kind WHEN 'scans' THEN scans WHEN 'generations' THEN generations ELSE images END < p_limit;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_quota(p_user_id uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.usage_counters
  SET scans = greatest(scans - (p_kind = 'scans')::int, 0),
      generations = greatest(generations - (p_kind = 'generations')::int, 0),
      images = greatest(images - (p_kind = 'images')::int, 0)
  WHERE user_id = p_user_id
    AND day = (now() AT TIME ZONE 'UTC')::date;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_quota(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quota(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_quota(uuid, text) TO service_role;
