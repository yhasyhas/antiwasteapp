/*
  # Foyers : préparation du garde-manger partagé (aucun changement visible dans l'app)

  - `households` : un foyer. Chaque utilisateur a un foyer personnel (`is_personal`), créé
    automatiquement à l'inscription (trigger sur auth.users) et, ici, pour les comptes existants.
  - `household_members` : appartenance à un foyer, avec un rôle (owner / member) et une date d'arrivée.
  - `ingredients.household_id` : le garde-manger appartient au foyer. `user_id` est conservé
    (qui a ajouté l'ingrédient). Les ingrédients existants passent dans le foyer personnel de leur auteur.
    Si l'app n'envoie pas de household_id, le foyer personnel de l'auteur est utilisé.
  - Règles de sécurité des ingrédients : basées sur l'appartenance au foyer, à la place de
    `auth.uid() = user_id`. Seul le garde-manger est partagé : recettes, favoris et préférences
    restent par utilisateur.
  - Pour l'instant, foyers et membres sont en lecture seule pour l'app (invitations : phase 6).
*/

-- 1. Tables

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_personal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un seul foyer personnel par utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS households_one_personal_per_user
  ON households(created_by) WHERE is_personal;

CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);

-- 2. Appartenance au foyer, utilisée par les règles de sécurité.
-- SECURITY DEFINER : lit household_members sans repasser par sa propre RLS (évite la récursion).

CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = (SELECT auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_household_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid) TO authenticated;

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their households"
  ON households FOR SELECT
  TO authenticated
  USING (public.is_household_member(id));

CREATE POLICY "Members can view members of their households"
  ON household_members FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id));

-- 3. Foyer personnel : créé à l'inscription, et pour les comptes existants

CREATE OR REPLACE FUNCTION public.create_personal_household(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id uuid;
BEGIN
  SELECT id INTO v_household_id
  FROM public.households
  WHERE created_by = p_user_id AND is_personal;

  IF v_household_id IS NULL THEN
    INSERT INTO public.households (created_by, is_personal)
    VALUES (p_user_id, true)
    RETURNING id INTO v_household_id;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_household_id, p_user_id, 'owner');
  END IF;

  RETURN v_household_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_personal_household(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.create_personal_household(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_household() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_household
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_household();

DO $$
BEGIN
  PERFORM public.create_personal_household(id) FROM auth.users;
END;
$$;

-- 4. Ingrédients rattachés au foyer

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE CASCADE;

UPDATE ingredients i
SET household_id = h.id
FROM households h
WHERE h.created_by = i.user_id
  AND h.is_personal
  AND i.household_id IS NULL;

ALTER TABLE ingredients ALTER COLUMN household_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingredients_household_id ON ingredients(household_id);

-- L'app n'envoie pas encore de household_id : on prend le foyer personnel de l'auteur.
-- Déclenché avant l'insert, donc avant la vérification des règles de sécurité.
CREATE OR REPLACE FUNCTION public.set_ingredient_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    SELECT id INTO NEW.household_id
    FROM public.households
    WHERE created_by = NEW.user_id AND is_personal;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_ingredient_household() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_ingredient_household
  BEFORE INSERT ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_ingredient_household();

-- 5. Règles de sécurité des ingrédients : appartenance au foyer

DROP POLICY IF EXISTS "Users can view own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can insert own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can update own ingredients" ON ingredients;
DROP POLICY IF EXISTS "Users can delete own ingredients" ON ingredients;

CREATE POLICY "Members can view household ingredients"
  ON ingredients FOR SELECT
  TO authenticated
  USING (public.is_household_member(household_id));

-- On ajoute en son propre nom, dans un foyer dont on est membre
CREATE POLICY "Members can add household ingredients"
  ON ingredients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_household_member(household_id));

-- USING : on ne modifie que les ingrédients de ses foyers ; WITH CHECK : on ne peut pas les déplacer ailleurs
CREATE POLICY "Members can update household ingredients"
  ON ingredients FOR UPDATE
  TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY "Members can delete household ingredients"
  ON ingredients FOR DELETE
  TO authenticated
  USING (public.is_household_member(household_id));
