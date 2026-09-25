import { callEdgeFunction } from './callEdgeFunction';

// Appels en cours, par recette : ouvrir puis sauvegarder une recette ne lance qu'une génération
const pending = new Map<string, Promise<string | null>>();

// Demande l'image d'une recette enregistrée (generate-recipe-image). La fonction renvoie l'image existante
// sans rien générer si elle a déjà été créée. L'image est facultative : en cas d'échec (quota, service
// indisponible, image non configurée), on renvoie null sans prévenir l'utilisateur.
export function ensureRecipeImage(recipeId: string, language: string): Promise<string | null> {
  const existing = pending.get(recipeId);
  if (existing) return existing;

  const request = callEdgeFunction('generate-recipe-image', { recipe_id: recipeId, language })
    .then(({ response, data }) => {
      if (response.ok && typeof data?.image_url === 'string') return data.image_url as string;
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
