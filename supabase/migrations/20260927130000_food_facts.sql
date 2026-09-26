/*
  # Fiches aliments (phase 6b)

  - `ingredients.food_key` : identifiant standard de l'aliment (anglais, minuscules, singulier :
    banana, cherry_tomato), qui regroupe les variantes (« bananes mûres » → banana). Renvoyé par le scan,
    déterminé à l'ouverture de la fiche pour l'ajout manuel, le code-barres et les anciens ingrédients.
  - `food_facts` : une fiche par aliment, partagée par tous les utilisateurs, générée une seule fois avec
    les trois langues (fr, en, es) dans le même appel. `aliases` : noms normalisés (trois langues et
    variantes) pour retrouver la fiche à partir d'un nom. `status` : 'generating' pendant la génération
    (réservation, comme les images), 'ready' ensuite. `reviewed` : fiche relue.
  - `food_fact_reports` : signalements d'erreur (« Signaler une erreur »), chacun ne voit que les siens.
  - `usage_counters.facts` : quota de fiches générées par jour (lire une fiche existante est gratuit).
  - Écriture des fiches : fonctions réservées à la clé secrète (Edge Function food-fact).

  Ajouts uniquement : les données existantes ne sont pas modifiées (food_key vide, facts = 0).
*/

-- 1. Identifiant standard sur le garde-manger

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS food_key text
  CONSTRAINT ingredients_food_key_format CHECK (food_key IS NULL OR food_key ~ '^[a-z][a-z0-9_]{1,47}$');

-- 2. Fiches partagées

CREATE TABLE IF NOT EXISTS food_facts (
  food_key text PRIMARY KEY CHECK (food_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready')),
  -- { "fr": { name, description, origin, season, nutrition[], tips[] }, "en": {…}, "es": {…} }
  content jsonb,
  aliases text[] NOT NULL DEFAULT '{}',
  model text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  CHECK (status = 'generating' OR content IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_food_facts_aliases ON food_facts USING gin (aliases);

ALTER TABLE food_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read ready food facts"
  ON food_facts FOR SELECT TO authenticated
  USING (status = 'ready');

-- Réservation avant la génération : vraie si cet appel doit générer la fiche (absente, ou réservation
-- abandonnée depuis plus de 2 minutes). Fiche prête ou génération en cours ailleurs : faux.
CREATE OR REPLACE FUNCTION public.claim_food_fact(p_food_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  INSERT INTO public.food_facts (food_key, status, claimed_at)
  VALUES (p_food_key, 'generating', now())
  ON CONFLICT (food_key) DO UPDATE SET claimed_at = now()
    WHERE public.food_facts.status = 'generating' AND public.food_facts.claimed_at < now() - interval '2 minutes'
  RETURNING true INTO v_claimed;
  RETURN coalesce(v_claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_food_fact(p_food_key text, p_content jsonb, p_aliases text[], p_model text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.food_facts (food_key, status, content, aliases, model, generated_at)
  VALUES (p_food_key, 'ready', p_content, p_aliases, p_model, now())
  ON CONFLICT (food_key) DO UPDATE
    SET status = 'ready', content = EXCLUDED.content, aliases = EXCLUDED.aliases, model = EXCLUDED.model,
        generated_at = now(), reviewed = false, reviewed_at = NULL;
$$;

-- Génération échouée : la réservation est libérée (une fiche prête n'est jamais supprimée)
CREATE OR REPLACE FUNCTION public.release_food_fact(p_food_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM public.food_facts WHERE food_key = p_food_key AND status = 'generating';
$$;

-- Nouveau nom rencontré pour une fiche existante (« bananes mûres » → banana)
CREATE OR REPLACE FUNCTION public.add_food_fact_alias(p_food_key text, p_alias text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.food_facts SET aliases = array_append(aliases, left(p_alias, 80))
  WHERE food_key = p_food_key AND status = 'ready' AND NOT (left(p_alias, 80) = ANY(aliases)) AND cardinality(aliases) < 60;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_food_fact(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_food_fact(text, jsonb, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_food_fact(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_food_fact_alias(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_food_fact(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_food_fact(text, jsonb, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_food_fact(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_food_fact_alias(text, text) TO service_role;

-- 3. Signalements

CREATE TABLE IF NOT EXISTS food_fact_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  food_key text NOT NULL REFERENCES food_facts(food_key) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('fr', 'en', 'es')),
  message text CHECK (message IS NULL OR char_length(message) <= 500),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_fact_reports_food_key ON food_fact_reports(food_key);

ALTER TABLE food_fact_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report food facts"
  ON food_fact_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can view own food fact reports"
  ON food_fact_reports FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 4. Quota des fiches générées

ALTER TABLE usage_counters ADD COLUMN IF NOT EXISTS facts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consume_quota(p_user_id uuid, p_kind text, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_kind NOT IN ('scans', 'generations', 'images', 'facts') THEN
    RAISE EXCEPTION 'Type de quota inconnu : %', p_kind;
  END IF;

  INSERT INTO public.usage_counters (user_id, day)
  VALUES (p_user_id, v_day)
  ON CONFLICT (user_id, day) DO NOTHING;

  -- La condition est réévaluée après le verrou de ligne : pas de dépassement en cas d'appels simultanés
  UPDATE public.usage_counters
  SET scans = scans + (p_kind = 'scans')::int,
      generations = generations + (p_kind = 'generations')::int,
      images = images + (p_kind = 'images')::int,
      facts = facts + (p_kind = 'facts')::int
  WHERE user_id = p_user_id
    AND day = v_day
    AND CASE p_kind WHEN 'scans' THEN scans WHEN 'generations' THEN generations WHEN 'images' THEN images ELSE facts END < p_limit;

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
      images = greatest(images - (p_kind = 'images')::int, 0),
      facts = greatest(facts - (p_kind = 'facts')::int, 0)
  WHERE user_id = p_user_id
    AND day = (now() AT TIME ZONE 'UTC')::date;
$$;
