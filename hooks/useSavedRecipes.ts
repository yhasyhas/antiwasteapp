import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { loadFavoriteIds, setFavorite } from '@/lib/favorites';
import { supabase } from '@/lib/supabase';
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { recipeFromRow } from '@/components/recipe/types';
import type { SavedRecipe } from '@/lib/savedRecipes';

export type { SavedRecipe };

// Historique des recettes, favoris et signets « Pour plus tard » ; image générée à l'ouverture d'une recette qui n'en a pas
export function useSavedRecipes() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const images = useRecipeImages();

  const openRecipe = (recipe: SavedRecipe) => {
    setSelectedRecipe(recipe);
    images.request(recipe);
  };

  // Rechargé à chaque retour sur l'onglet (recettes sauvegardées depuis l'écran de génération)
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [user])
  );

  const loadRecipes = async () => {
    if (!user) return;

    // Pas de setLoading(true) : le spinner plein écran ne s'affiche qu'au premier chargement
    const { data: allRecipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const favoriteIds = await loadFavoriteIds(user.id);

    if (allRecipes) {
      setRecipes(allRecipes.map((row) => ({ ...recipeFromRow(row), is_favorite: favoriteIds.has(row.id) })));
    }

    setLoading(false);
  };

  const toggleFavorite = async (recipeId: string) => {
    if (!user) return;

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const error = await setFavorite(user.id, recipeId, !recipe.is_favorite);

    // Le cœur ne change d'état que si l'écriture a réussi
    if (error) {
      alertWriteError(t, 'toggling favorite', error);
      return;
    }

    setRecipes((current) => current.map((r) => (r.id === recipeId ? { ...r, is_favorite: !r.is_favorite } : r)));
    setSelectedRecipe((current) => (current?.id === recipeId ? { ...current, is_favorite: !current.is_favorite } : current));
  };

  // « Pour plus tard » : signet indépendant du cœur (recipes.later_at) ; l'état ne change que si l'écriture réussit
  const toggleLater = async (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!user || !recipe) return;
    const laterAt = recipe.later_at ? null : new Date().toISOString();
    const { error } = await supabase.from('recipes').update({ later_at: laterAt }).eq('id', recipeId);
    if (error) {
      alertWriteError(t, 'saving recipe for later', error);
      return;
    }
    setRecipes((current) => current.map((r) => (r.id === recipeId ? { ...r, later_at: laterAt } : r)));
    setSelectedRecipe((current) => (current?.id === recipeId ? { ...current, later_at: laterAt } : current));
  };

  return {
    // Avec leur image, dès qu'elle est connue (demandée ici ou sur un autre écran)
    recipes: recipes.map(images.withImage),
    loading,
    selectedRecipe: selectedRecipe && images.withImage(selectedRecipe),
    setSelectedRecipe,
    isImageLoading: images.isLoading,
    imageNotice: images.notice,
    openRecipe,
    toggleFavorite,
    toggleLater,
  };
}
