/*
  # Recongélation d'un aliment décongelé (phase 8)

  Règle par catégorie, la même que l'app (lib/storage.ts, refreezeRule) :
    - viande, poisson et fruits de mer, surgelés (crus) : `cook_first`, à cuisiner avant de le recongeler ;
    - plat cuisiné ou reste : `eat`, à consommer sans le recongeler ;
    - le reste (pain, fruits, légumes, laitages…) : `warn`, recongélation possible, avec un avertissement.

  Garde-fou : un lot décongelé (thawed_at renseigné, hors congélateur) des deux premières sortes ne peut pas
  retourner au congélateur tel quel (erreur `refreeze_forbidden`), quel que soit le chemin (autre membre du
  foyer, version précédente de l'app). Les restes du plat cuisiné sont un nouveau lot : ils se congèlent.

  Ajout uniquement : une fonction et un déclencheur, aucune donnée modifiée.
*/

CREATE OR REPLACE FUNCTION public.refreeze_rule(p_category text, p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_kind = 'dish' THEN 'eat'
    WHEN p_category IN ('meat', 'fish', 'frozen') THEN 'cook_first'
    ELSE 'warn'
  END;
$$;

CREATE OR REPLACE FUNCTION public.guard_refreeze()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.location = 'freezer' AND OLD.location IS DISTINCT FROM 'freezer' AND OLD.thawed_at IS NOT NULL
     AND public.refreeze_rule(NEW.category, NEW.kind) <> 'warn' THEN
    RAISE EXCEPTION 'refreeze_forbidden' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refreeze_rule(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refreeze_rule(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_refreeze() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_refreeze
  BEFORE UPDATE OF location ON ingredients
  FOR EACH ROW EXECUTE FUNCTION public.guard_refreeze();
