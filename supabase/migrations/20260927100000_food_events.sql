/*
  # Compteur anti-gaspi (phase 6b)

  - `food_events` : un événement par aliment qui quitte le garde-manger du foyer :
    « saved » (sauvé) quand il part avec « J'ai cuisiné ça » (fonction cook_ingredients),
    « wasted » (gaspillé) quand il est supprimé alors que sa date de péremption est passée.
    Une suppression avant la date (erreur de saisie, aliment donné…) ne compte pas.
  - Déclencheur après suppression d'un ingrédient ; « J'ai cuisiné ça » le signale par un réglage local à
    la transaction (app.food_event = 'saved'). Foyer supprimé (compte supprimé) : rien n'est compté.
  - `food_stats` : ce mois-ci (mois UTC), aliments sauvés et gaspillés pour le foyer actif et pour moi.
  - Lecture des événements par les membres du foyer ; écriture seulement par le déclencheur.

  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

CREATE TABLE IF NOT EXISTS food_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  -- Qui l'a cuisiné ou retiré (null : compte supprimé)
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('saved', 'wasted')),
  ingredient_name text NOT NULL,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_events_household ON food_events(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_food_events_user ON food_events(user_id, created_at);

ALTER TABLE food_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household food events"
  ON food_events FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

CREATE OR REPLACE FUNCTION public.log_food_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
BEGIN
  -- Foyer en cours de suppression (compte supprimé, dernier membre parti) : rien à compter
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = OLD.household_id) THEN
    RETURN NULL;
  END IF;
  IF current_setting('app.food_event', true) = 'saved' THEN
    v_kind := 'saved';
  ELSIF OLD.expires_at IS NOT NULL AND OLD.expires_at < (now() AT TIME ZONE 'utc')::date THEN
    v_kind := 'wasted';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.food_events (household_id, user_id, kind, ingredient_name, expires_at)
  VALUES (OLD.household_id, auth.uid(), v_kind, left(OLD.name, 120), OLD.expires_at);
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_food_event() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER log_food_event
  AFTER DELETE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.log_food_event();

-- « J'ai cuisiné ça » : retire les ingrédients (règles de sécurité du garde-manger) et les compte sauvés
CREATE OR REPLACE FUNCTION public.cook_ingredients(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('app.food_event', 'saved', true);
  DELETE FROM public.ingredients WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.food_event', '', true);
  RETURN v_count;
END;
$$;

-- Compteur du mois : foyer actif et moi
CREATE OR REPLACE FUNCTION public.food_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
  v_since timestamptz := date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_household := public.active_household_of(v_user);
  RETURN jsonb_build_object(
    'household', jsonb_build_object(
      'saved', (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'saved' AND created_at >= v_since),
      'wasted', (SELECT count(*) FROM public.food_events WHERE household_id = v_household AND kind = 'wasted' AND created_at >= v_since)
    ),
    'me', jsonb_build_object(
      'saved', (SELECT count(*) FROM public.food_events WHERE user_id = v_user AND kind = 'saved' AND created_at >= v_since),
      'wasted', (SELECT count(*) FROM public.food_events WHERE user_id = v_user AND kind = 'wasted' AND created_at >= v_since)
    ),
    'shared', NOT (SELECT is_personal FROM public.households WHERE id = v_household)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cook_ingredients(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.food_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cook_ingredients(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.food_stats() TO authenticated;
