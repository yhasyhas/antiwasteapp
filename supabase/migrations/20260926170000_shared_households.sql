/*
  # Garde-manger partagé (phase 6a)

  - Un seul foyer actif par utilisateur : son foyer partagé s'il en a un (au plus un), sinon son foyer
    personnel, qu'il garde toujours et retrouve en quittant le foyer partagé.
  - Invitation par code de 6 caractères (sans 0, O, 1, I), valable 48 h, un code actif par foyer.
    Inviter depuis son foyer personnel : au premier membre qui rejoint, ce foyer devient le foyer partagé
    (avec son garde-manger) et l'invitant reçoit un nouveau foyer personnel, vide.
    Rejoindre propose de transférer son garde-manger personnel dans le foyer partagé.
  - 8 membres au plus. Le propriétaire peut retirer un membre. Si le propriétaire part (ou supprime son
    compte), le membre le plus ancien devient propriétaire ; le foyer est supprimé quand le dernier membre
    part (en partant, le dernier membre récupère le garde-manger dans son foyer personnel).
  - Supprimer un compte ne supprime plus le foyer partagé ni les ingrédients qu'il y a ajoutés
    (« ajouté par » devient vide) ; son foyer personnel est supprimé.
  - L'auteur d'un ingrédient (`user_id`) ne peut plus être modifié.
  - `profiles.display_name` : nom affiché aux membres du foyer (sinon, début de l'adresse e-mail).
  - Temps réel : chaque changement du garde-manger ou des membres est diffusé sur le canal privé
    `household:<id>` (Supabase Realtime, broadcast), reçu seulement par les membres du foyer.
  - Toutes les écritures sur les foyers, membres et invitations passent par les fonctions ci-dessous.

  Aucune donnée existante n'est modifiée : contraintes de clés étrangères et fonctions seulement.
*/

-- 1. Nom affiché aux membres du foyer

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text
  CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) <= 40);

-- 2. Supprimer un compte ne supprime plus le foyer partagé ni ses ingrédients

ALTER TABLE households ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE households DROP CONSTRAINT households_created_by_fkey;
ALTER TABLE households ADD CONSTRAINT households_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ingredients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE ingredients DROP CONSTRAINT ingredients_user_id_fkey;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Foyer actif : le foyer partagé s'il y en a un, sinon le foyer personnel

CREATE OR REPLACE FUNCTION public.active_household_of(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT m.household_id FROM public.household_members m
       JOIN public.households h ON h.id = m.household_id
      WHERE m.user_id = p_user_id AND NOT h.is_personal
      ORDER BY m.joined_at LIMIT 1),
    (SELECT id FROM public.households WHERE created_by = p_user_id AND is_personal)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.active_household_of(uuid) FROM PUBLIC, anon, authenticated;

-- Au plus un foyer partagé par utilisateur
CREATE OR REPLACE FUNCTION public.check_single_shared_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT is_personal FROM public.households WHERE id = NEW.household_id) AND EXISTS (
    SELECT 1 FROM public.household_members m JOIN public.households h ON h.id = m.household_id
    WHERE m.user_id = NEW.user_id AND NOT h.is_personal AND m.household_id <> NEW.household_id
  ) THEN
    RAISE EXCEPTION 'already_in_household';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_single_shared_household() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER check_single_shared_household
  BEFORE INSERT ON household_members
  FOR EACH ROW EXECUTE FUNCTION public.check_single_shared_household();

-- Nouvel ingrédient sans household_id (l'app n'en envoie pas) : foyer actif de son auteur
CREATE OR REPLACE FUNCTION public.set_ingredient_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    NEW.household_id := public.active_household_of(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 4. L'auteur d'un ingrédient ne change pas (seule exception : compte supprimé, auteur vidé)

CREATE OR REPLACE FUNCTION public.keep_ingredient_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT (NEW.user_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id)) THEN
    RAISE EXCEPTION 'ingredient_author_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.keep_ingredient_author() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER keep_ingredient_author
  BEFORE UPDATE OF user_id ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.keep_ingredient_author();

-- 5. Départ d'un membre (départ, retrait, compte supprimé) : dernier membre → foyer supprimé ;
--    plus de propriétaire → le membre le plus ancien le devient

CREATE OR REPLACE FUNCTION public.handle_member_left()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = OLD.household_id) THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = OLD.household_id) THEN
    DELETE FROM public.households WHERE id = OLD.household_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = OLD.household_id AND role = 'owner') THEN
    UPDATE public.household_members SET role = 'owner'
    WHERE household_id = OLD.household_id
      AND user_id = (SELECT user_id FROM public.household_members
                     WHERE household_id = OLD.household_id
                     ORDER BY joined_at, user_id LIMIT 1);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_member_left() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER handle_member_left
  AFTER DELETE ON household_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_left();

-- 6. Invitations (lues et écrites seulement par les fonctions)

CREATE TABLE IF NOT EXISTS household_invites (
  code text PRIMARY KEY CHECK (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours'
);

CREATE INDEX IF NOT EXISTS idx_household_invites_household_id ON household_invites(household_id);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

-- 7. Fonctions appelées par l'app (utilisateur connecté). Erreurs : le message est un code traduit par l'app.

CREATE OR REPLACE FUNCTION public.household_max_members()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 8 $$;

-- Nom affiché d'un membre
CREATE OR REPLACE FUNCTION public.member_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(NULLIF(btrim(display_name), ''), split_part(email, '@', 1))
  FROM public.profiles WHERE id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.member_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- Foyer actif de l'utilisateur : membres, rôle, code d'invitation en cours
CREATE OR REPLACE FUNCTION public.my_household()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_household := public.active_household_of(v_user);
  IF v_household IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', v_household,
    'shared', NOT (SELECT is_personal FROM public.households WHERE id = v_household),
    'role', (SELECT role FROM public.household_members WHERE household_id = v_household AND user_id = v_user),
    'max_members', public.household_max_members(),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', public.member_display_name(m.user_id),
        'role', m.role,
        'joined_at', m.joined_at,
        'is_me', m.user_id = v_user
      ) ORDER BY m.joined_at, m.user_id)
      FROM public.household_members m WHERE m.household_id = v_household
    ), '[]'::jsonb),
    'invite', (
      SELECT jsonb_build_object('code', code, 'expires_at', expires_at)
      FROM public.household_invites
      WHERE household_id = v_household AND expires_at > now()
      ORDER BY created_at DESC LIMIT 1
    )
  );
END;
$$;

-- Nouveau code d'invitation pour le foyer actif (remplace le précédent)
CREATE OR REPLACE FUNCTION public.create_household_invite()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
  v_code text;
  v_expires timestamptz;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_household := public.active_household_of(v_user);
  IF (SELECT count(*) FROM public.household_members WHERE household_id = v_household) >= public.household_max_members() THEN
    RAISE EXCEPTION 'household_full';
  END IF;

  DELETE FROM public.household_invites WHERE household_id = v_household OR expires_at < now() - interval '7 days';
  LOOP
    SELECT string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      INTO v_code FROM generate_series(1, 6);
    BEGIN
      INSERT INTO public.household_invites (code, household_id, created_by)
      VALUES (v_code, v_household, v_user)
      RETURNING expires_at INTO v_expires;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Code déjà pris : on en tire un autre
    END;
  END LOOP;
  RETURN jsonb_build_object('code', v_code, 'expires_at', v_expires);
END;
$$;

-- Invitation valide pour cet utilisateur, verrouillée ; sinon erreur
CREATE OR REPLACE FUNCTION public.check_household_invite(p_code text, p_user uuid)
RETURNS public.household_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.household_invites;
BEGIN
  SELECT * INTO v_invite FROM public.household_invites WHERE code = upper(btrim(p_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF v_invite.expires_at <= now() THEN RAISE EXCEPTION 'expired_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.household_members WHERE household_id = v_invite.household_id AND user_id = p_user) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  IF EXISTS (SELECT 1 FROM public.household_members m JOIN public.households h ON h.id = m.household_id
             WHERE m.user_id = p_user AND NOT h.is_personal) THEN
    RAISE EXCEPTION 'already_in_household';
  END IF;
  IF (SELECT count(*) FROM public.household_members WHERE household_id = v_invite.household_id) >= public.household_max_members() THEN
    RAISE EXCEPTION 'household_full';
  END IF;
  RETURN v_invite;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_household_invite(text, uuid) FROM PUBLIC, anon, authenticated;

-- Avant de rejoindre : qui invite, combien de membres (pour la confirmation dans l'app)
CREATE OR REPLACE FUNCTION public.preview_household_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.household_invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  v_invite := public.check_household_invite(p_code, auth.uid());
  RETURN jsonb_build_object(
    'invited_by', public.member_display_name(v_invite.created_by),
    'member_count', (SELECT count(*) FROM public.household_members WHERE household_id = v_invite.household_id)
  );
END;
$$;

-- Rejoindre un foyer ; p_transfer : garde-manger personnel déplacé dans le foyer rejoint
CREATE OR REPLACE FUNCTION public.join_household(p_code text, p_transfer boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite public.household_invites;
  v_household public.households;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  -- Verrou sur le foyer : deux arrivées simultanées ne dépassent pas la limite
  SELECT h.* INTO v_household FROM public.households h
    JOIN public.household_invites i ON i.household_id = h.id
   WHERE i.code = upper(btrim(p_code))
   FOR UPDATE OF h;
  v_invite := public.check_household_invite(p_code, v_user);

  -- Invitation envoyée depuis un foyer personnel : il devient le foyer partagé, l'invitant reçoit un
  -- nouveau foyer personnel (sauf s'il a rejoint un autre foyer partagé entre-temps)
  IF v_household.is_personal THEN
    IF EXISTS (SELECT 1 FROM public.household_members m JOIN public.households h ON h.id = m.household_id
               WHERE m.user_id = v_household.created_by AND NOT h.is_personal) THEN
      RAISE EXCEPTION 'invalid_code';
    END IF;
    UPDATE public.households SET is_personal = false WHERE id = v_household.id;
    PERFORM public.create_personal_household(v_household.created_by);
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_household.id, v_user, 'member');

  IF p_transfer THEN
    UPDATE public.ingredients SET household_id = v_household.id
    WHERE household_id = (SELECT id FROM public.households WHERE created_by = v_user AND is_personal);
  END IF;
  RETURN v_household.id;
END;
$$;

-- Quitter le foyer partagé : retour au foyer personnel. Le dernier membre y récupère le garde-manger.
CREATE OR REPLACE FUNCTION public.leave_household()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT m.household_id INTO v_household FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
   WHERE m.user_id = v_user AND NOT h.is_personal
   FOR UPDATE OF h;
  IF v_household IS NULL THEN RAISE EXCEPTION 'not_in_shared_household'; END IF;

  IF (SELECT count(*) FROM public.household_members WHERE household_id = v_household) = 1 THEN
    UPDATE public.ingredients SET household_id = public.create_personal_household(v_user)
    WHERE household_id = v_household;
  END IF;
  DELETE FROM public.household_members WHERE household_id = v_household AND user_id = v_user;
END;
$$;

-- Le propriétaire retire un membre du foyer partagé
CREATE OR REPLACE FUNCTION public.remove_household_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_household uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  SELECT m.household_id INTO v_household FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
   WHERE m.user_id = v_user AND m.role = 'owner' AND NOT h.is_personal;
  IF v_household IS NULL THEN RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501'; END IF;
  IF p_user_id = v_user THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;
  DELETE FROM public.household_members WHERE household_id = v_household AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_member'; END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_household() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_household_invite() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_household_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_household(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_household() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_household_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_household() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_household_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_household_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_household() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_household_member(uuid) TO authenticated;

-- 8. Temps réel : un message par changement (une instruction = un message par foyer), sur le canal privé
--    household:<id>. Un échec de diffusion ne fait jamais échouer l'écriture.

-- Les tables de transition ne peuvent pas être partagées entre plusieurs événements : un déclencheur
-- par événement (insertion, modification, suppression)
CREATE OR REPLACE FUNCTION public.broadcast_household_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT DISTINCT household_id FROM new_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'insert'),
        CASE WHEN TG_TABLE_NAME = 'ingredients' THEN 'pantry' ELSE 'members' END, 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_household_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT household_id FROM new_rows UNION SELECT household_id FROM old_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'update'),
        CASE WHEN TG_TABLE_NAME = 'ingredients' THEN 'pantry' ELSE 'members' END, 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_household_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_household uuid;
BEGIN
  FOR v_household IN SELECT DISTINCT household_id FROM old_rows LOOP
    BEGIN
      PERFORM realtime.send(jsonb_build_object('op', 'delete'),
        CASE WHEN TG_TABLE_NAME = 'ingredients' THEN 'pantry' ELSE 'members' END, 'household:' || v_household::text, true);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'diffusion temps réel impossible : %', SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_household_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_household_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_household_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER broadcast_ingredients_insert AFTER INSERT ON ingredients
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_insert();
CREATE TRIGGER broadcast_ingredients_update AFTER UPDATE ON ingredients
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_update();
CREATE TRIGGER broadcast_ingredients_delete AFTER DELETE ON ingredients
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_delete();

CREATE TRIGGER broadcast_members_insert AFTER INSERT ON household_members
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_insert();
CREATE TRIGGER broadcast_members_update AFTER UPDATE ON household_members
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_update();
CREATE TRIGGER broadcast_members_delete AFTER DELETE ON household_members
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.broadcast_household_delete();

-- Réception des messages du canal household:<id> : membres du foyer seulement
CREATE POLICY "Household members receive household broadcasts"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND EXISTS (
      SELECT 1 FROM public.household_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND 'household:' || m.household_id::text = (SELECT realtime.topic())
    )
  );
