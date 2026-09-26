import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ensureRecipeImage, onRecipeImage } from '@/lib/recipeImage';

// Images des recettes d'un écran : demande en arrière-plan, recettes en cours (emplacement avec
// indicateur), et onImage appelé à chaque image arrivée, y compris celles demandées par un autre écran
export function useRecipeImages(onImage: (recipeId: string, imageUrl: string) => void) {
  const { language } = useLanguage();
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const onImageRef = useRef(onImage);
  onImageRef.current = onImage;

  useEffect(() => onRecipeImage((id, url) => onImageRef.current(id, url)), []);

  const request = (recipeId: string | undefined, imageUrl?: string | null) => {
    if (!recipeId || imageUrl) return;
    setLoadingIds((current) => (current.includes(recipeId) ? current : [...current, recipeId]));
    ensureRecipeImage(recipeId, language).finally(() => {
      setLoadingIds((current) => current.filter((id) => id !== recipeId));
    });
  };

  const requestAll = (recipes: Array<{ id?: string; image_url?: string | null }>) => {
    recipes.forEach((recipe) => request(recipe.id, recipe.image_url));
  };

  const isLoading = (recipeId: string | undefined) => !!recipeId && loadingIds.includes(recipeId);

  return { request, requestAll, isLoading };
}
