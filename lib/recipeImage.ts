import { callEdgeFunction } from './callEdgeFunction';

// Appels en cours, par recette : une recette ne lance qu'une génération, même demandée par plusieurs écrans
const pending = new Map<string, Promise<string | null>>();

// Prévient les écrans qui affichent la recette (cartes, fiche) quand son image arrive
type ImageListener = (recipeId: string, imageUrl: string) => void;
const listeners = new Set<ImageListener>();

export function onRecipeImage(listener: ImageListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Demande l'image d'une recette enregistrée (generate-recipe-image). La fonction enregistre l'URL sur la
// recette (historique) et renvoie l'image existante sans rien générer si elle a déjà été créée. L'image
// est facultative : en cas d'échec (quota, service indisponible, image non configurée), on renvoie null
// sans prévenir l'utilisateur.
export function ensureRecipeImage(recipeId: string, language: string): Promise<string | null> {
  const existing = pending.get(recipeId);
  if (existing) return existing;

  const request = callEdgeFunction('generate-recipe-image', { recipe_id: recipeId, language })
    .then(({ response, data }) => {
      if (response.ok && typeof data?.image_url === 'string') {
        listeners.forEach((listener) => listener(recipeId, data.image_url));
        return data.image_url as string;
      }
      console.warn('[image] pas d\'image pour la recette', recipeId, response.status, data?.error, data?.details);
      return null;
    })
    .catch((error) => {
      console.warn('[image] appel impossible', error);
      return null;
    })
    .finally(() => pending.delete(recipeId));

  pending.set(recipeId, request);
  return request;
}
