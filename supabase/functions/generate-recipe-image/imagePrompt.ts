// Consigne envoyée à FLUX pour l'image d'une recette, en anglais (FLUX comprend mieux l'anglais).
// Version réglable par le secret IMAGE_PROMPT_VERSION, sans redéployer ; elle s'applique aussi aux recettes
// déjà enregistrées, puisque la consigne est construite à la génération de l'image :
//   v1 (par défaut) : la description écrite par generate-recipes (image_prompt), telle quelle : photo
//                     culinaire « professionnelle » ;
//   v1.1            : la v1, avec une seule règle en plus pour les poissons et les volailles entières (souvent
//                     d'anatomie bizarre chez FLUX : tête de poisson vue de près) : morceaux ou filets, en partie
//                     dans la sauce ; « whole » retiré devant le poisson ou la volaille ;
//   v2              : photo de cuisine maison : description du plat seule (mots de style professionnel
//                     retirés), lumière naturelle, présentation simple, rendu pas trop parfait.

export type ImagePromptVersion = 'v1' | 'v1.1' | 'v2';

export const DEFAULT_IMAGE_PROMPT_VERSION: ImagePromptVersion = 'v1';

export function imagePromptVersion(value: string | undefined | null): ImagePromptVersion {
  return value === 'v1.1' || value === 'v2' ? value : DEFAULT_IMAGE_PROMPT_VERSION;
}

// Poissons (descriptions en anglais écrites par generate-recipes) et volailles servies entières
const FISH = String.raw`(?:fish|sea ?bream|bream|dorade|tilapia|salmon|cod|trout|mackerel|sardines?|snapper|sea ?bass|bass|hake|tuna|catfish|carp|mullet|grouper|thiof|whiting|pollock|haddock|herring|swordfish|monkfish|plaice|sole|barramundi|capitaine|captain fish)`;
const POULTRY = String.raw`(?:chicken|duck|turkey|guinea ?fowl|hen|quail|poussin|pigeon)`;
const COOKED = String.raw`(?:(?:roast(?:ed)?|grilled|fried|baked|braised|stuffed|steamed|golden|crispy|spicy|marinated|smoked)\s+)*`;
const FISH_WORD = new RegExp(String.raw`\b${FISH}\b`, 'i');
const WHOLE_FISH = new RegExp(String.raw`\bwhole\s+(${COOKED}${FISH})\b`, 'gi');
const WHOLE_POULTRY = new RegExp(String.raw`\bwhole\s+(${COOKED}${POULTRY})\b`, 'gi');
const HEAD = /,?\s*\b(?:head[- ]on|with (?:its |the )?head(?: and tail)?)\b/gi;

// La règle de la v1.1, ajoutée seulement aux plats concernés ; formulée sans négation (FLUX montre souvent ce qu'on
// lui demande d'éviter)
export function withFishPoultryRule(prompt: string): string {
  const hasFish = FISH_WORD.test(prompt);
  const hasWholePoultry = new RegExp(WHOLE_POULTRY.source, 'i').test(prompt);
  if (!hasFish && !hasWholePoultry) return prompt;
  const dish = prompt.replace(WHOLE_FISH, '$1').replace(WHOLE_POULTRY, '$1').replace(HEAD, '').replace(/\s{2,}/g, ' ').trim().replace(/[.\s]+$/, '');
  const rules = [
    hasFish ? 'The fish is served as fillets or chunks, partly covered by the sauce, seen from a normal table distance' : '',
    hasWholePoultry ? 'The poultry is carved into pieces, partly in the sauce' : '',
  ].filter(Boolean).join('. ');
  return `${dish}. ${rules}.`;
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
  if (version === 'v1' || version === 'v1.1') {
    const v1 = written !== ''
      ? written
      : `Professional food photography of ${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}. Appetizing, natural light, served on a plate.`;
    return (version === 'v1.1' ? withFishPoultryRule(v1) : v1).slice(0, MAX_LENGTH);
  }
  const dish = dishDescription(written) || `${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}`;
  // Le style vient en dernier : la description du plat garde la priorité si la consigne est coupée
  // « Homemade rustic bowl of… » : minuscule initiale, sauf sigle ou nom propre en capitales (« BBQ… »)
  const start = /^[A-Z][a-z]/.test(dish) ? dish[0].toLowerCase() + dish.slice(1) : dish;
  return `Homemade ${start}. ${HOME_STYLE}`.slice(0, MAX_LENGTH);
}
