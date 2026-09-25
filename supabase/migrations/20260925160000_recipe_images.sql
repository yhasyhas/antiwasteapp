/*
  # Images des recettes (Cloudflare Workers AI, stockées dans Supabase Storage)

  - `recipes.image_prompt` : description de la photo écrite par le modèle lors de la génération,
    utilisée par generate-recipe-image. NULL pour les recettes déjà enregistrées (la fonction
    se rabat alors sur le titre et la description).
  - Bucket `recipe-images` :
    - public en lecture : l'URL enregistrée dans recipes.image_url s'affiche directement dans l'app.
      Les noms de fichiers contiennent un identifiant aléatoire (impossibles à deviner), et aucune
      politique ne permet de lister le bucket.
    - aucune politique d'écriture : seule la fonction generate-recipe-image, avec la clé secrète,
      y dépose des images. L'app ne peut ni ajouter, ni modifier, ni supprimer de fichier.
    - 2 Mo au plus par image, formats d'image uniquement.
  Ajouts uniquement : aucune donnée existante n'est modifiée.
*/

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_prompt text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recipe-images', 'recipe-images', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
