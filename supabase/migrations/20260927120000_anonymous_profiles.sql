/*
  # Essai sans compte (phase 6b)

  Un compte anonyme (connexion anonyme Supabase, is_anonymous dans le jeton) n'a pas d'adresse e-mail :
  `profiles.email` devient facultatif. Il utilise l'app comme un compte normal (garde-manger, foyer,
  recettes), avec des quotas réduits dans les fonctions. À la conversion en vrai compte, l'identifiant
  reste le même : toutes ses données sont conservées, et l'app enregistre l'adresse dans son profil.

  Nom affiché aux membres du foyer : display_name, sinon le début de l'adresse, sinon NULL (l'app
  affiche « Invité »).

  Aucune donnée existante n'est modifiée : contrainte NOT NULL retirée seulement.
*/

ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
