import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction } from '@/lib/callEdgeFunction';
import { ensureRecipeImage } from '@/lib/recipeImage';
import { supabase } from '@/lib/supabase';
import type { Filters, Recipe } from '@/components/recipe/types';

// État et actions de l'écran de génération : garde-manger, filtres, génération, historique, favoris, images
export function useRecipeGeneration() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // Recettes dont l'image est en cours de génération
  const [imageLoading, setImageLoading] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>({
    dietary: [],
    difficulty: 'easy',
    maxCookTime: 60,
    mealType: 'lunch',
    cuisine: 'any',
    language: 'fr',
  });

  useEffect(() => {
    loadIngredients();
    loadUserPreferences();
  }, []);

  const loadIngredients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      setIngredients(data);
    }
    setLoading(false);
  };

  const loadUserPreferences = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setFilters((current) => ({
        ...current,
        dietary: data.dietary_preferences || [],
        difficulty: data.default_difficulty || 'easy',
        maxCookTime: data.max_cook_time || 60,
        mealType: data.default_meal_type || 'lunch',
        language: data.default_language || 'fr',
      }));
    }
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add ingredients first');
      return;
    }

    setGenerating(true);

    try {
      const { data } = await callEdgeFunction('generate-recipes', {
        // Avec leur identifiant : le modèle indique quel ingrédient du garde-manger chaque recette utilise
        ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity || '' })),
        preferences: {
          dietary: filters.dietary,
          difficulty: filters.difficulty,
          maxCookTime: filters.maxCookTime,
          mealType: filters.mealType,
          cuisine: filters.cuisine,
          language: filters.language,
        },
      });

      if (data?.recipes) {
        // Enregistrées dans l'historique avant l'affichage, pour que chaque recette ait déjà son id
        // quand l'utilisateur la sauvegarde (sinon elle serait insérée une seconde fois)
        setRecipes(await saveRecipesToHistory(data.recipes));
      } else if (data?.error) {
        Alert.alert(data.error === 'quota_exceeded' ? t('dailyLimitTitle') : 'Error', data.message || 'Failed to generate recipes');
      } else {
        Alert.alert('Error', 'Failed to generate recipes');
      }
    } catch (error) {
      console.error('Error generating recipes:', error);
      Alert.alert('Error', 'Failed to generate recipes. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Ligne de la table recipes correspondant à une recette générée
  const toRecipeRow = (recipe: Recipe) => ({
    user_id: user!.id,
    title: recipe.title,
    description: recipe.description,
    ingredients_used: recipe.ingredients_used,
    ingredients_from_list: recipe.ingredients_from_list,
    missing_ingredients: recipe.missing_ingredients || [],
    instructions: recipe.instructions,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    total_time: recipe.total_time,
    difficulty: recipe.difficulty,
    meal_type: recipe.meal_type,
    dietary_tags: recipe.dietary_tags,
    servings: recipe.servings,
    tips: recipe.tips || [],
    suggestion: recipe.suggestion ?? null,
    image_prompt: recipe.image_prompt ?? null,
    image_url: recipe.image_url,
    language: filters.language,
  });

  // Enregistre les recettes générées dans l'historique et renvoie les recettes avec leur id.
  // En cas d'échec, les recettes sont renvoyées sans id (saveRecipe les insérera à la sauvegarde).
  const saveRecipesToHistory = async (newRecipes: Recipe[]): Promise<Recipe[]> => {
    if (!user) return newRecipes;

    const { data, error } = await supabase
      .from('recipes')
      .insert(newRecipes.map(toRecipeRow))
      .select('id, title');

    if (error || !data || data.length !== newRecipes.length) {
      alertWriteError(t, 'saving recipes to history', error);
      return newRecipes;
    }

    // Correspondance par titre (l'ordre des lignes renvoyées n'est pas garanti) ; chaque id n'est utilisé qu'une fois
    const unused = [...data];
    return newRecipes.map((recipe) => {
      const index = unused.findIndex((row) => row.title === recipe.title);
      return index === -1 ? recipe : { ...recipe, id: unused.splice(index, 1)[0].id as string };
    });
  };

  // Image générée seulement à l'ouverture ou à la sauvegarde d'une recette (quota images côté serveur)
  const requestImage = async (recipeId: string | undefined, imageUrl?: string) => {
    if (!recipeId || imageUrl) return;
    setImageLoading((current) => [...current, recipeId]);
    const url = await ensureRecipeImage(recipeId, filters.language);
    setImageLoading((current) => current.filter((id) => id !== recipeId));
    if (!url) return;
    setRecipes((current) => current.map((r) => (r.id === recipeId ? { ...r, image_url: url } : r)));
    setSelectedRecipe((current) => (current?.id === recipeId ? { ...current, image_url: url } : current));
  };

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    requestImage(recipe.id, recipe.image_url);
  };

  // Sauvegarder = ajouter aux favoris la recette déjà présente dans l'historique
  const saveRecipe = async (recipe: Recipe) => {
    if (!user) return;

    let recipeId = recipe.id;
    if (!recipeId) {
      // L'enregistrement dans l'historique avait échoué : on insère la recette maintenant
      const { data, error } = await supabase
        .from('recipes')
        .insert(toRecipeRow(recipe))
        .select('id')
        .single();

      if (error || !data) {
        alertWriteError(t, 'saving recipe', error);
        return;
      }
      recipeId = data.id as string;
      setRecipes((current) => current.map((r) => (r === recipe ? { ...r, id: recipeId } : r)));
    }

    const { error: favoriteError } = await supabase.from('favorites').insert({
      user_id: user.id,
      recipe_id: recipeId,
    });
    // 23505 : déjà en favori (contrainte unique user_id + recipe_id), la sauvegarde est donc acquise
    if (favoriteError && favoriteError.code !== '23505') {
      alertWriteError(t, 'adding recipe to favorites', favoriteError);
      return;
    }
    requestImage(recipeId, recipe.image_url);

    Alert.alert(
      'Recipe Saved!',
      'Your recipe has been saved to favorites.',
      [
        {
          text: 'View Saved',
          onPress: () => router.push('/(tabs)/saved'),
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const toggleDietaryFilter = (option: string) => {
    setFilters({
      ...filters,
      dietary: filters.dietary.includes(option)
        ? filters.dietary.filter((d) => d !== option)
        : [...filters.dietary, option],
    });
  };

  return {
    ingredients,
    recipes,
    loading,
    generating,
    selectedRecipe,
    setSelectedRecipe,
    imageLoading,
    filters,
    setFilters,
    generateRecipes,
    openRecipe,
    saveRecipe,
    toggleDietaryFilter,
  };
}
