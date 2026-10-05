// Consigne envoyée à FLUX pour l'image d'une recette, en anglais (FLUX comprend mieux l'anglais).
// Version réglable par le secret IMAGE_PROMPT_VERSION, sans redéployer ; elle s'applique aussi aux recettes
// déjà enregistrées, puisque la consigne est construite à la génération de l'image :
//   v1 (par défaut) : la description écrite par generate-recipes (image_prompt), telle quelle : photo
//                     culinaire « professionnelle » ;
//   v2              : photo de cuisine maison : description du plat seule (mots de style professionnel
//                     retirés), lumière naturelle, présentation simple, rendu pas trop parfait.

export type ImagePromptVersion = 'v1' | 'v2';

export const DEFAULT_IMAGE_PROMPT_VERSION: ImagePromptVersion = 'v1';

export function imagePromptVersion(value: string | undefined | null): ImagePromptVersion {
  return value === 'v2' ? 'v2' : DEFAULT_IMAGE_PROMPT_VERSION;
}

export interface ImagePromptRecipe {
  title: string;
  description: string | null;
  image_prompt: string | null;
}

const MAX_LENGTH = 1000;

// Mots qui poussent FLUX vers une photo de studio ou de magazine, retirés de la description en v2
const STUDIO_WORDS = [
  /\b(?:professional|editorial|commercial|studio|magazine|award[- ]winning|high[- ]end|gourmet|michelin[- ]star(?:red)?|fine[- ]dining)\b(?:\s+(?:food\s+)?(?:photography|photo|shot|style|lighting|quality))?/gi,
  /\bfood\s+(?:photography|photo|styling)\b/gi,
  /\b(?:hyper[- ]?realistic|photorealistic|ultra[- ]detailed|highly detailed|high resolution|8k|4k|hdr|bokeh|shallow depth of field|cinematic(?:\s+lighting)?|dramatic lighting|perfectly (?:plated|arranged)|elegant(?:ly)? plated|beautifully plated|minimalist(?:\s+style)?)\b/gi,
];

// Description du plat sans les mots de style professionnel, ni les virgules laissées vides
export function dishDescription(text: string): string {
  let result = text;
  for (const pattern of STUDIO_WORDS) result = result.replace(pattern, '');
  return result
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part !== '' && !/^(?:of|with|and|in|on)$/i.test(part))
    .join(', ')
    .replace(/^(?:of|with)\s+/i, '')
    .replace(/[\s.,;:]+$/, '');
}

const HOME_STYLE = 'Casual photo of home cooking, taken in an ordinary home kitchen with a phone, soft natural daylight from a window. '
  + 'Served simply on an everyday plate, in a bowl or straight in the pot or pan it was cooked in, on a plain kitchen table. '
  + 'Real, slightly imperfect homemade look: uneven portions, a few drips and crumbs, no garnish styling, no props, no studio lighting. '
  + 'Realistic colors and textures.';

export function buildImagePrompt(recipe: ImagePromptRecipe, version: ImagePromptVersion): string {
  const written = recipe.image_prompt?.trim() ?? '';
  if (version === 'v1') {
    if (written !== '') return written.slice(0, MAX_LENGTH);
    return `Professional food photography of ${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}. Appetizing, natural light, served on a plate.`.slice(0, MAX_LENGTH);
  }
  const dish = dishDescription(written) || `${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}`;
  // Le style vient en dernier : la description du plat garde la priorité si la consigne est coupée
  // « Homemade rustic bowl of… » : minuscule initiale, sauf sigle ou nom propre en capitales (« BBQ… »)
  const start = /^[A-Z][a-z]/.test(dish) ? dish[0].toLowerCase() + dish.slice(1) : dish;
  return `Homemade ${start}. ${HOME_STYLE}`.slice(0, MAX_LENGTH);
}
