-- Langue des e-mails d'authentification (phase 10) : les modèles d'e-mail de Supabase (réinitialisation du mot de
-- passe, confirmation d'inscription) ne lisent que les métadonnées du compte (`.Data` = auth.users.raw_user_meta_data).
-- La langue choisie dans l'app (user_preferences.default_language) y est copiée dans le champ `lang`.
-- Les modèles sont dans supabase/templates/ (scripts/email-templates/push.mjs) ; sans `lang`, ils sont en français.

CREATE OR REPLACE FUNCTION public.sync_email_language()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.default_language IN ('fr', 'en', 'es') THEN
    UPDATE auth.users
       SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('lang', NEW.default_language)
     WHERE id = NEW.user_id
       AND raw_user_meta_data->>'lang' IS DISTINCT FROM NEW.default_language;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_email_language() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_preferences_email_language ON public.user_preferences;
CREATE TRIGGER user_preferences_email_language
  AFTER INSERT OR UPDATE OF default_language ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.sync_email_language();

-- Comptes existants
UPDATE auth.users u
   SET raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('lang', p.default_language)
  FROM public.user_preferences p
 WHERE p.user_id = u.id
   AND p.default_language IN ('fr', 'en', 'es')
   AND u.raw_user_meta_data->>'lang' IS DISTINCT FROM p.default_language;
