import { callEdgeFunction } from './callEdgeFunction';
import { failureReasonOf, type FailureReason } from './quotaReason';

// Images des recettes : un seul état partagé par toute l'app. Chaque carte et chaque fiche lit l'image
// ici, quel que soit l'écran qui l'a demandée ou reçue. Une recette n'est jamais redemandée tant que son
// image est en cours ou déjà obtenue. Après une panne, elle peut l'être à la prochaine ouverture ; après
// un quota épuisé (personnel ou Cloudflare), pas avant le lendemain (UTC, comme les quotas).

type ImageState =
  | { status: 'loading' }
  | { status: 'done'; url: string }
  | { status: 'failed'; reason: FailureReason; day: string };

const utcDay = () => new Date().toISOString().slice(0, 10);

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

// Raison de l'échec de l'image (affichée discrètement à son emplacement), ou null
export function recipeImageFailure(recipeId: string | undefined): FailureReason | null {
  const state = recipeId ? states.get(recipeId) : undefined;
  return state?.status === 'failed' ? state.reason : null;
}

async function fetchImage(recipeId: string, language: string): Promise<{ url: string } | { reason: FailureReason }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { response, data } = await callEdgeFunction('generate-recipe-image', { recipe_id: recipeId, language });
      if (response.ok && typeof data?.image_url === 'string') return { url: data.image_url };
      if (response.status !== 202) {
        const reason = failureReasonOf(data) ?? 'provider_error';
        console.warn(`[image] pas d'image pour la recette ${recipeId} (${reason})`, response.status, data?.error, data?.details);
        return { reason };
      }
    } catch (error) {
      console.warn('[image] appel impossible', error);
      return { reason: 'provider_error' };
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return { reason: 'provider_error' };
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
  const state = states.get(recipeId);
  if (state?.status === 'loading' || state?.status === 'done') return;
  // Quota épuisé aujourd'hui : inutile de redemander avant demain
  if (state?.status === 'failed' && state.reason !== 'provider_error' && state.day === utcDay()) return;

  setState(recipeId, { status: 'loading' });
  fetchImage(recipeId, language).then((result) => {
    setState(recipeId, 'url' in result ? { status: 'done', url: result.url } : { status: 'failed', reason: result.reason, day: utcDay() });
  });
}
