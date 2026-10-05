-- Phase 10, partie A (premier contact) : premier lancement guidé, « Mes basiques », notes et signalements des
-- recettes, « Donner mon avis ».

-- ---------- Premier lancement guidé ----------
-- Affiché tant que onboarded_at est vide (une seule fois par compte, quel que soit le téléphone). Les comptes
-- existants l'ont déjà « passé » : ils ne le voient pas.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
UPDATE public.profiles SET onboarded_at = coalesce(created_at, now()) WHERE onboarded_at IS NULL;

-- ---------- Mes basiques ----------
-- Identifiants connus (salt, pepper, oil, water, garlic, onion, sugar, flour, butter, vinegar, mustard, stock, spices)
-- ou noms libres ; null : sel, poivre, huile, eau. Considérés comme disponibles, jamais comptés comme achats.
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS basics text[];
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_basics_check;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_basics_check
  CHECK (basics IS NULL OR (cardinality(basics) <= 30 AND char_length(array_to_string(basics, '|')) <= 1250));

-- ---------- Notes des recettes ----------
-- « On a aimé » / « Pas pour nous » ; les recettes « Pas pour nous » sont évitées par l'anti-répétition
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS rating text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS rated_at timestamptz;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_rating_check;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_rating_check CHECK (rating IS NULL OR rating IN ('liked', 'disliked'));
CREATE INDEX IF NOT EXISTS recipes_user_disliked_idx ON public.recipes (user_id, rated_at DESC) WHERE rating = 'disliked';

-- ---------- Limite d'envois (avis, signalements) ----------
-- 20 par jour et par utilisateur et par table : protège la base et la boîte mail des alertes
CREATE OR REPLACE FUNCTION public.limit_daily_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sent integer;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE user_id = $1 AND created_at > now() - interval ''1 day''', TG_TABLE_SCHEMA, TG_TABLE_NAME)
    INTO sent USING NEW.user_id;
  IF sent >= 20 THEN
    RAISE EXCEPTION 'daily_limit' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.limit_daily_reports() FROM PUBLIC;

-- ---------- Donner mon avis ----------
-- Sans donnée personnelle superflue : ni e-mail ni nom ; l'identifiant sert aux règles d'accès et à la limite
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('problem', 'idea', 'other')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  app_version text CHECK (char_length(app_version) <= 40),
  device text CHECK (char_length(device) <= 80),
  os text CHECK (char_length(os) <= 40),
  language text CHECK (char_length(language) <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS feedback_daily_limit ON public.feedback;
CREATE TRIGGER feedback_daily_limit BEFORE INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.limit_daily_reports();

-- ---------- Signaler un problème (recette) ----------
-- Copie de la recette au moment du signalement : elle reste lisible si la recette est supprimée
CREATE TABLE IF NOT EXISTS public.recipe_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  recipe_id uuid REFERENCES public.recipes (id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('dangerous', 'incorrect', 'bad', 'translation')),
  comment text CHECK (char_length(comment) <= 500),
  recipe_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text CHECK (char_length(language) <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipe_reports_user_created_idx ON public.recipe_reports (user_id, created_at DESC);
ALTER TABLE public.recipe_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.recipe_reports;
CREATE POLICY "Users can insert own reports" ON public.recipe_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (recipe_id IS NULL OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())));
DROP POLICY IF EXISTS "Users can view own reports" ON public.recipe_reports;
CREATE POLICY "Users can view own reports" ON public.recipe_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS recipe_reports_daily_limit ON public.recipe_reports;
CREATE TRIGGER recipe_reports_daily_limit BEFORE INSERT ON public.recipe_reports FOR EACH ROW EXECUTE FUNCTION public.limit_daily_reports();
