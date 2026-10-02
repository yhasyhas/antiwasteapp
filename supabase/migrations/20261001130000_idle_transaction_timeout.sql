/*
  # Délai des transactions inactives

  Une session du rôle `postgres` (CLI, migrations, tests SQL, éditeur SQL) restée « idle in transaction »
  plus de 5 minutes est fermée par la base : sa transaction est annulée et ses verrous libérés. Évite qu'une
  transaction de test abandonnée bloque la base (incident du 01/10/2026).

  Sans effet sur l'app : ses requêtes passent par PostgREST (rôles authenticator, anon, authenticated) en
  transactions courtes, déjà limitées par statement_timeout. Appliqué aux nouvelles sessions.

  Retour en arrière : ALTER ROLE postgres RESET idle_in_transaction_session_timeout;
*/

ALTER ROLE postgres SET idle_in_transaction_session_timeout = '5min';
