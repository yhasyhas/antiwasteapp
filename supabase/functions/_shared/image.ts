// Compression des images de recettes avant stockage : FLUX renvoie du 1024×1024 de 600 à 800 Ko,
// trop lourd pour les données mobiles. 800 px de large en JPEG qualité 75 : 100 à 150 Ko, sans perte
// visible sur un téléphone (essais du 25/09/2026, voir le journal de PLAN.md).
// Utilisé par generate-recipe-image et par scripts/recompress-recipe-images.ts.

import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

export const IMAGE_MAX_WIDTH = 800;
export const JPEG_QUALITY = 75;

export async function compressRecipeImage(bytes: Uint8Array): Promise<Uint8Array> {
  const image = await Image.decode(bytes);
  if (image.width > IMAGE_MAX_WIDTH) image.resize(IMAGE_MAX_WIDTH, Image.RESIZE_AUTO);
  return await image.encodeJPEG(JPEG_QUALITY);
}
