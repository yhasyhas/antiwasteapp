/*
  # « Mon impact » (phase 10, partie B)

  - `food_events.food_key` : fiche de l'aliment au moment où il quitte le garde-manger (ingredients.food_key), pour
    regrouper les aliments les plus gaspillés et en tirer un conseil. Événements existants : identifiant retrouvé par
    les alias des fiches (même normalisation que la fonction food-fact : normalizeAlias).
  - `food_impact(p_language)` : 6 derniers mois (mois UTC), aliments sauvés et gaspillés pour le foyer actif et pour
    moi ; les 3 aliments les plus gaspillés par le foyer sur cette période, avec le nom et le premier conseil de leur
    fiche dans la langue demandée. En nombre d'aliments, sans kilos ni euros.

  Ajouts, et identifiant de fiche ajouté aux événements existants (sauvegarde avant application).
*/

ALTER TABLE public.food_events ADD COLUMN IF NOT EXISTS food_key text;

-- Nom ramené à la forme des alias des fiches : minuscules, sans accents, lettres et chiffres séparés par une espace
CREATE OR REPLACE FUNCTION public.food_alias(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT left(btrim(regexp_replace(
    translate(lower(coalesce(p_name, '')), 'àáâãäåāçćčèéêëēěìíîïīñńòóôõöōùúûüūýÿž', 'aaaaaaaccceeeeeeiiiiinnoooooouuuuuyyz'),
    '[^a-z0-9]+', ' ', 'g')), 80)
$$;

-- Même déclencheur que la phase 8, avec l'identifiant de la fiche
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
  IF current_setting('app.pantry_reason', true) = 'merge' THEN
    RETURN NULL;
  END IF;
  IF current_setting('app.food_event', true) = 'saved' THEN
    v_kind := 'saved';
  ELSIF OLD.expires_at IS NOT NULL AND OLD.expires_at < (now() AT TIME ZONE 'utc')::date
        AND coalesce(OLD.date_kind, 'use_by') = 'use_by'
        AND OLD.location IS DISTINCT FROM 'freezer' THEN
    v_kind := 'wasted';
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.food_events (household_id, user_id, kind, ingredient_name, expires_at, ingredient_id, food_key)
  VALUES (OLD.household_id, auth.uid(), v_kind, left(OLD.name, 120), OLD.expires_at, OLD.id, OLD.food_key);
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_food_event() FROM PUBLIC, anon, authenticated;

-- Événements existants : fiche retrouvée par ses alias
UPDATE public.food_events e
   SET food_key = f.food_key
  FROM public.food_facts f
 WHERE e.food_key IS NULL
   AND f.status = 'ready'
   AND public.food_alias(e.ingredient_name) = ANY(f.aliases);

CREATE OR REPLACE FUNCTION public.food_impact(p_language text DEFAULT 'fr')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
  v_lang text := CASE WHEN p_language IN ('fr', 'en', 'es') THEN p_language ELSE 'fr' END;
  v_month timestamp := date_trunc('month', now() AT TIME ZONE 'utc');
  v_since timestamptz := (date_trunc('month', now() AT TIME ZONE 'utc') - interval '5 months') AT TIME ZONE 'utc';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_household := public.active_household_of(v_user);
  RETURN jsonb_build_object(
    'shared', NOT coalesce((SELECT is_personal FROM public.households WHERE id = v_household), true),
    -- Du plus récent au plus ancien
    'months', (
      SELECT jsonb_agg(jsonb_build_object(
        'month', to_char(m.start, 'YYYY-MM'),
        'household', jsonb_build_object('saved', h.saved, 'wasted', h.wasted),
        'me', jsonb_build_object('saved', u.saved, 'wasted', u.wasted)
      ) ORDER BY m.start DESC)
      FROM generate_series(v_month - interval '5 months', v_month, interval '1 month') AS m(start)
      CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE e.kind = 'saved') AS saved, count(*) FILTER (WHERE e.kind = 'wasted') AS wasted
        FROM public.food_events e
        WHERE e.household_id = v_household
          AND e.created_at >= m.start AT TIME ZONE 'utc' AND e.created_at < (m.start + interval '1 month') AT TIME ZONE 'utc'
      ) h
      CROSS JOIN LATERAL (
        SELECT count(*) FILTER (WHERE e.kind = 'saved') AS saved, count(*) FILTER (WHERE e.kind = 'wasted') AS wasted
        FROM public.food_events e
        WHERE e.user_id = v_user
          AND e.created_at >= m.start AT TIME ZONE 'utc' AND e.created_at < (m.start + interval '1 month') AT TIME ZONE 'utc'
      ) u
    ),
    -- Les plus gaspillés par le foyer sur les 6 mois : regroupés par fiche, sinon par nom ; conseil de la fiche
    'top_wasted', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name', coalesce(f.content -> v_lang ->> 'name', t.name),
        'count', t.count,
        'food_key', t.food_key,
        'tip', f.content -> v_lang -> 'tips' ->> 0
      ) ORDER BY t.count DESC, t.last DESC)
      FROM (
        SELECT g.food_key, count(*) AS count, max(e.created_at) AS last,
               (array_agg(e.ingredient_name ORDER BY e.created_at DESC))[1] AS name
        FROM public.food_events e
        CROSS JOIN LATERAL (
          SELECT coalesce(e.food_key, (
            SELECT ff.food_key FROM public.food_facts ff
            WHERE ff.status = 'ready' AND public.food_alias(e.ingredient_name) = ANY(ff.aliases)
            LIMIT 1
          )) AS food_key
        ) g
        WHERE e.household_id = v_household AND e.kind = 'wasted' AND e.created_at >= v_since
        GROUP BY g.food_key, CASE WHEN g.food_key IS NULL THEN public.food_alias(e.ingredient_name) END
        ORDER BY count(*) DESC, max(e.created_at) DESC
        LIMIT 3
      ) t
      LEFT JOIN public.food_facts f ON f.food_key = t.food_key AND f.status = 'ready'
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.food_impact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.food_impact(text) TO authenticated;
