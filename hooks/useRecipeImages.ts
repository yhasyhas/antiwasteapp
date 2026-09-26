import { useSyncExternalStore } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  isPendingImage,
  isRecipeImageLoading,
  recipeImageUrl,
  recipeImagesVersion,
  requestRecipeImage,
  subscribeRecipeImages,
} from '@/lib/recipeImage';

type WithImage = { id?: string; image_url?: string | null };

// Images des recettes, lues dans l'état partagé de l'app (lib/recipeImage.ts) : l'écran se met à jour
// dès qu'une image arrive, même demandée ailleurs.
export function useRecipeImages() {
  const { language } = useLanguage();
  useSyncExternalStore(subscribeRecipeImages, recipeImagesVersion);

  // La recette avec son image, si elle est connue (base ou génération de cette session)
  const withImage = <T extends WithImage>(recipe: T): T => {
    const url = recipeImageUrl(recipe.id) ?? (isPendingImage(recipe.image_url) ? undefined : recipe.image_url ?? undefined);
    return url === recipe.image_url ? recipe : { ...recipe, image_url: url };
  };

  const request = (recipe: WithImage) => requestRecipeImage(recipe.id, language, recipe.image_url);
  const requestAll = (recipes: WithImage[]) => recipes.forEach(request);

  return { withImage, request, requestAll, isLoading: isRecipeImageLoading };
}
