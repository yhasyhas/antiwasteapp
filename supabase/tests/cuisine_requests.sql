-- Tests des demandes « Autre cuisine… » (cuisine_requests) : contraintes, résumé, aucun accès depuis l'app.
-- Lancement (base liée, mot de passe dans SUPABASE_DB_PASSWORD) :
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/cuisine_requests.sql
-- Tout se passe dans une transaction annulée à la fin : aucune donnée ne reste en base.

BEGIN;
INSERT INTO cuisine_requests (cuisine, language) VALUES ('géorgienne', 'fr'), ('Géorgienne', 'fr'), ('Peruvian', 'en');
DO $$ BEGIN
  IF (SELECT requests FROM cuisine_requests_summary WHERE cuisine = 'géorgienne') <> 2 THEN RAISE EXCEPTION 'résumé faux'; END IF;
  BEGIN INSERT INTO cuisine_requests (cuisine, language) VALUES (repeat('x', 41), 'fr'); RAISE EXCEPTION 'texte trop long accepté';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO cuisine_requests (cuisine, language) VALUES ('thaï', 'de'); RAISE EXCEPTION 'langue acceptée';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'OK 1 : contraintes et résumé';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM cuisine_requests; RAISE EXCEPTION 'lecture permise à l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO cuisine_requests (cuisine, language) VALUES ('test', 'fr'); RAISE EXCEPTION 'écriture permise à l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM cuisine_requests_summary; RAISE EXCEPTION 'résumé lisible par l''app';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'OK 2 : aucun accès depuis l''app';
END $$;
ROLLBACK;
