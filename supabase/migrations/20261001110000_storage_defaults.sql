/*
  # Emplacement et type de date par défaut à chaque ajout (phase 8)

  Tout nouveau lot sans emplacement ou sans type de date (liste de courses rangée au garde-manger, versions
  précédentes de l'app, lot rétabli par l'annulation d'une action d'avant la phase 8) reçoit les valeurs par
  défaut de l'aliment (default_location, default_date_kind) ; un lot ajouté au congélateur reçoit sa date de
  congélation.

  Ajout uniquement : un déclencheur, aucune donnée existante modifiée.
*/

CREATE OR REPLACE FUNCTION public.fill_storage_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.location := coalesce(NEW.location, public.default_location(NEW.category, NEW.kind, NEW.food_key));
  NEW.date_kind := coalesce(NEW.date_kind, public.default_date_kind(NEW.category, NEW.kind));
  IF NEW.location = 'freezer' AND NEW.frozen_at IS NULL THEN
    NEW.frozen_at := current_date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fill_storage_defaults() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fill_storage_defaults
  BEFORE INSERT ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.fill_storage_defaults();
