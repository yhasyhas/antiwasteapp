import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { loadFavoriteIds, setFavorite } from '@/lib/favorites';
import { activeHouseholdId } from '@/lib/household';
import { onPantryChanged } from '@/lib/pantryEvents';
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { recipeFromRow, type Recipe } from '@/components/recipe/types';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { ChefHat, Sparkles, TrendingUp } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';

type RecentRecipe = Recipe & { id: string };

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<RecentRecipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<RecentRecipe | null>(null);
  // Images lues dans l'état partagé : une image générée sur un autre écran apparaît ici aussi
  const images = useRecipeImages();

  // Rechargé à chaque retour sur l'onglet : ingrédients scannés, recettes générées entre-temps
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
      loadRecipes();
    }, [user])
  );

  // Garde-manger du foyer actif ; rechargé quand un membre le modifie (temps réel)
  useEffect(() => onPantryChanged(loadIngredients), [user]);

  const loadIngredients = async () => {
    if (!user) return;
    const householdId = await activeHouseholdId();
    if (!householdId) return;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (data) {
      setIngredients(data);
    }
  };

  const loadRecipes = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setRecipes(data.map(recipeFromRow));
    }
    setFavoriteIds(await loadFavoriteIds(user.id));
  };

  const openRecipe = (recipe: RecentRecipe) => {
    setSelectedRecipe(recipe);
    images.request(recipe);
  };

  const toggleFavorite = async (recipe: RecentRecipe) => {
    if (!user) return;
    const favorite = !favoriteIds.has(recipe.id);
    const error = await setFavorite(user.id, recipe.id, favorite);
    if (error) {
      alertWriteError(t, 'toggling favorite', error);
      return;
    }
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(recipe.id);
      else next.delete(recipe.id);
      return next;
    });
  };

  const handleGenerateRecipes = () => {
    if (ingredients.length === 0) {
      return;
    }
    router.push('/recipe/generate');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, safe.top(20)]}>
        <View>
          <Text style={styles.greeting}>{t('home.welcomeBack')}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>{t('home.signOut')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <ChefHat size={40} color="#10b981" strokeWidth={2} />
          </View>
          <Text style={styles.heroTitle}>{t('home.readyToCook')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('home.ingredientsReady', { count: ingredients.length })}
          </Text>
          <TouchableOpacity
            style={[
              styles.generateButton,
              ingredients.length === 0 && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerateRecipes}
            disabled={ingredients.length === 0}
          >
            <Sparkles size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.generateButtonText}>{t('home.generateRecipes')}</Text>
          </TouchableOpacity>
          {ingredients.length === 0 && (
            <Text style={styles.helpText}>
              {t('home.addIngredientsFirst')}
            </Text>
          )}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <View style={styles.actionIconContainer}>
              <ChefHat size={24} color="#10b981" />
            </View>
            <Text style={styles.actionTitle}>{t('home.scanFood')}</Text>
            <Text style={styles.actionSubtitle}>{t('home.takePhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/ingredients')}
          >
            <View style={styles.actionIconContainer}>
              <TrendingUp size={24} color="#10b981" />
            </View>
            <Text style={styles.actionTitle}>{t('home.myPantry')}</Text>
            <Text style={styles.actionSubtitle}>{t('ingredientCount', { count: ingredients.length })}</Text>
          </TouchableOpacity>
        </View>

        {recipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.recentRecipes')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/saved')}>
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {recipes.map((recipe) => (
              <RecipeListCard key={recipe.id} recipe={images.withImage(recipe)} imageLoading={images.isLoading(recipe.id)} onPress={() => openRecipe(recipe)} />
            ))}
          </View>
        )}
      </ScrollView>

      {selectedRecipe && (
        <RecipeSheet
          recipe={images.withImage(selectedRecipe)}
          imageLoading={images.isLoading(selectedRecipe.id)}
          imageNotice={images.notice(selectedRecipe.id)}
          isFavorite={favoriteIds.has(selectedRecipe.id)}
          onToggleFavorite={() => toggleFavorite(selectedRecipe)}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  logoutText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
});