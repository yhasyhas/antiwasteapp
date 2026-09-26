import { callEdgeFunction } from './callEdgeFunction';

// Images des recettes : un seul état partagé par toute l'app. Chaque carte et chaque fiche lit l'image
// ici, quel que soit l'écran qui l'a demandée ou reçue. Une recette n'est jamais redemandée tant que son
// image est en cours ou déjà obtenue ; après un échec, elle peut l'être à la prochaine ouverture.

type ImageState = { status: 'loading' } | { status: 'done'; url: string } | { status: 'failed' };

const states = new Map<string, ImageState>();
const listeners = new Set<() => void>();
let version = 0;

// Pendant qu'un autre appel génère l'image (autre écran, autre téléphone du foyer), le serveur répond
// « en cours » : on redemande toutes les 3 s, 20 fois au plus (la génération prend 2 à 6 s)
const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 20;

// Valeur de recipes.image_url pendant la génération (réservation par la fonction) : pas une image
export const isPendingImage = (url: string | null | undefined) => !!url && url.startsWith('pending:');

function setState(recipeId: string, state: ImageState) {
  states.set(recipeId, state);
  version++;
  listeners.forEach((listener) => listener());
}

export function subscribeRecipeImages(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const recipeImagesVersion = () => version;

export function recipeImageUrl(recipeId: string | undefined): string | undefined {
  const state = recipeId ? states.get(recipeId) : undefined;
  return state?.status === 'done' ? state.url : undefined;
}

export function isRecipeImageLoading(recipeId: string | undefined): boolean {
  return !!recipeId && states.get(recipeId)?.status === 'loading';
}

async function fetchImage(recipeId: string, language: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { response, data } = await callEdgeFunction('generate-recipe-image', { recipe_id: recipeId, language });
      if (response.ok && typeof data?.image_url === 'string') return data.image_url;
      if (response.status !== 202) {
        console.warn('[image] pas d\'image pour la recette', recipeId, response.status, data?.error, data?.details);
        return null;
      }
    } catch (error) {
      console.warn('[image] appel impossible', error);
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return null;
}

// Demande l'image d'une recette enregistrée (generate-recipe-image), sans attendre. La fonction
// enregistre l'URL sur la recette (historique) et renvoie l'image existante sans rien générer si elle a
// déjà été créée. L'image est facultative : en cas d'échec (quota, service indisponible), rien n'est
// signalé à l'utilisateur.
export function requestRecipeImage(recipeId: string | undefined, language: string, knownUrl?: string | null) {
  if (!recipeId) return;
  if (knownUrl && !isPendingImage(knownUrl)) {
    // Image déjà enregistrée (liste chargée depuis la base) : rien à demander
    if (states.get(recipeId)?.status !== 'done') setState(recipeId, { status: 'done', url: knownUrl });
    return;
  }
  const status = states.get(recipeId)?.status;
  if (status === 'loading' || status === 'done') return;

  setState(recipeId, { status: 'loading' });
  fetchImage(recipeId, language).then((url) => {
    setState(recipeId, url ? { status: 'done', url } : { status: 'failed' });
  });
}
