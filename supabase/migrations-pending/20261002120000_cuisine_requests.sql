-- « Autre cuisine… » (phase 9, découpage des cuisines) : demandes enregistrées sans donnée personnelle, pour
-- repérer les cuisines à ajouter. EN ATTENTE : à déplacer dans supabase/migrations/ à l'intégration, après la
-- validation de la phase 8 et de la bibliothèque (docs/cuisines-proposition.md).
-- Ni utilisateur ni foyer : seulement le texte nettoyé par le serveur, la langue et la date. Écrite par
-- generate-recipes avec la clé secrète ; aucune lecture ni écriture depuis l'app (RLS sans politique).

CREATE TABLE IF NOT EXISTS cuisine_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cuisine text NOT NULL CHECK (char_length(cuisine) BETWEEN 2 AND 40),
  language text NOT NULL CHECK (language IN ('fr', 'en', 'es')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cuisine_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cuisine_requests FROM anon, authenticated;

-- Cuisines les plus demandées (relecture par l'équipe, depuis le Dashboard ou la clé secrète)
CREATE OR REPLACE VIEW cuisine_requests_summary WITH (security_invoker = true) AS
SELECT lower(cuisine) AS cuisine, count(*) AS requests, max(created_at) AS last_requested
FROM cuisine_requests
GROUP BY lower(cuisine)
ORDER BY requests DESC;

REVOKE ALL ON cuisine_requests_summary FROM anon, authenticated;
