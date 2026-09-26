import { useSyncExternalStore } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  isPendingImage,
  isRecipeImageLoading,
  recipeImageFailure,
  recipeImageUrl,
  recipeImagesVersion,
  requestRecipeImage,
  subscribeRecipeImages,
} from '@/lib/recipeImage';

type WithImage = { id?: string; image_url?: string | null };

// Images des recettes, lues dans l'état partagé de l'app (lib/recipeImage.ts) : l'écran se met à jour
// dès qu'une image arrive, même demandée ailleurs. Une image est demandée à l'ouverture d'une fiche
// (request) et, pour les seules recettes d'une nouvelle génération, dès l'affichage des résultats
// (requestAll) ; jamais pour afficher les autres listes (accueil, favoris, toutes les recettes).
export function useRecipeImages() {
  const { language, t } = useLanguage();
  useSyncExternalStore(subscribeRecipeImages, recipeImagesVersion);

  // La recette avec son image, si elle est connue (base ou génération de cette session)
  const withImage = <T extends WithImage>(recipe: T): T => {
    const url = recipeImageUrl(recipe.id) ?? (isPendingImage(recipe.image_url) ? undefined : recipe.image_url ?? undefined);
    return url === recipe.image_url ? recipe : { ...recipe, image_url: url };
  };

  const request = (recipe: WithImage) => requestRecipeImage(recipe.id, language, recipe.image_url);
  // Réservé aux recettes d'une nouvelle génération
  const requestAll = (recipes: WithImage[]) => recipes.forEach(request);

  // Message discret à l'emplacement de l'image quand elle n'a pas pu être générée
  const notice = (recipeId: string | undefined): string | null => {
    const reason = recipeImageFailure(recipeId);
    if (reason === 'user_quota') return t('recipe.imageUserQuota');
    if (reason === 'provider_quota') return t('recipe.imageProviderQuota');
    if (reason === 'provider_error') return t('recipe.imageUnavailable');
    return null;
  };

  return { withImage, request, requestAll, isLoading: isRecipeImageLoading, notice };
}
