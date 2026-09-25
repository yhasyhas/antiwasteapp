import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { ensureRecipeImage } from '@/lib/recipeImage';
import { supabase } from '@/lib/supabase';

// Recette de l'historique, avec son état de favori
export interface SavedRecipe {
  id: string;
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  difficulty: string;
  dietary_tags: string[];
  ingredients_used: any[];
  instructions: any[];
  image_url?: string | null;
  is_favorite?: boolean;
}

// Historique des recettes et favoris ; image générée à l'ouverture d'une recette
export function useSavedRecipes() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const [imageLoading, setImageLoading] = useState<string | null>(null);

  // Image générée seulement à l'ouverture d'une recette qui n'en a pas encore (quota images côté serveur)
  const openRecipe = async (recipe: SavedRecipe) => {
    setSelectedRecipe(recipe);
    if (recipe.image_url) return;
    setImageLoading(recipe.id);
    const url = await ensureRecipeImage(recipe.id, language);
    setImageLoading((current) => (current === recipe.id ? null : current));
    if (!url) return;
    setRecipes((current) => current.map((r) => (r.id === recipe.id ? { ...r, image_url: url } : r)));
    setSelectedRecipe((current) => (current?.id === recipe.id ? { ...current, image_url: url } : current));
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

    const { data: favorites } = await supabase
      .from('favorites')
      .select('recipe_id')
      .eq('user_id', user.id);

    if (allRecipes && favorites) {
      const favoriteIds = new Set(favorites.map((f) => f.recipe_id));
      const recipesWithFavorites = allRecipes.map((recipe) => ({
        ...recipe,
        is_favorite: favoriteIds.has(recipe.id),
      }));
      setRecipes(recipesWithFavorites);
    }

    setLoading(false);
  };

  const toggleFavorite = async (recipeId: string) => {
    if (!user) return;

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const { error } = recipe.is_favorite
      ? await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('recipe_id', recipeId)
      : await supabase.from('favorites').insert({
          user_id: user.id,
          recipe_id: recipeId,
        });

    // Le cœur ne change d'état que si l'écriture a réussi
    if (error) {
      alertWriteError(t, 'toggling favorite', error);
      return;
    }

    setRecipes(
      recipes.map((r) =>
        r.id === recipeId ? { ...r, is_favorite: !r.is_favorite } : r
      )
    );
  };

  return { recipes, loading, selectedRecipe, setSelectedRecipe, imageLoading, openRecipe, toggleFavorite };
}
