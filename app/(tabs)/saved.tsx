import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { SavedRecipeCard } from '@/components/saved/SavedRecipeCard';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';

export default function SavedScreen() {
  const { recipes, loading, selectedRecipe, setSelectedRecipe, isImageLoading, imageNotice, openRecipe, toggleFavorite } = useSavedRecipes();
  const { t } = useLanguage();

  const favoriteRecipes = recipes.filter((r) => r.is_favorite);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('saved.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('saved.favoritesCount', { count: favoriteRecipes.length })}
        </Text>
      </View>

      {favoriteRecipes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Heart size={64} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t('saved.emptyTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('saved.emptyText')}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.recipeList}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('saved.yourFavorites')}</Text>
            {favoriteRecipes.map((recipe) => (
              <SavedRecipeCard
                key={recipe.id}
                recipe={recipe}
                inFavorites
                onPress={() => openRecipe(recipe)}
                onToggleFavorite={() => toggleFavorite(recipe.id)}
              />
            ))}
          </View>

          {recipes.filter((r) => !r.is_favorite).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('saved.allRecipes')}</Text>
              {recipes
                .filter((r) => !r.is_favorite)
                .map((recipe) => (
                  <SavedRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    inFavorites={false}
                    onPress={() => openRecipe(recipe)}
                    onToggleFavorite={() => toggleFavorite(recipe.id)}
                  />
                ))}
            </View>
          )}
        </ScrollView>
      )}

      {selectedRecipe && (
        <RecipeSheet
          recipe={selectedRecipe}
          imageLoading={isImageLoading(selectedRecipe.id)}
          imageNotice={imageNotice(selectedRecipe.id)}
          isFavorite={selectedRecipe.is_favorite}
          onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  recipeList: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
});
