import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { EmptyState } from '@/components/ui/Illustrations';
import { ListItemMotion } from '@/components/ui/ListItemMotion';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRecipeCard } from '@/components/ui/Skeleton';
import { colors, spacing, typography } from '@/constants/theme';

export default function SavedScreen() {
  const { recipes, loading, selectedRecipe, setSelectedRecipe, isImageLoading, imageNotice, openRecipe, toggleFavorite } = useSavedRecipes();
  const { t } = useLanguage();

  const favoriteRecipes = recipes.filter((r) => r.is_favorite);
  const otherRecipes = recipes.filter((r) => !r.is_favorite);

  return (
    <View style={styles.container}>
      <ScreenHeader back title={t('saved.title')} subtitle={loading ? undefined : t('saved.favoritesCount', { count: favoriteRecipes.length })} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonRecipeCard />
        </View>
      ) : favoriteRecipes.length === 0 ? (
        <EmptyState kind="recipes" title={t('saved.emptyTitle')} text={t('saved.emptyText')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{t('saved.yourFavorites')}</Text>
          {favoriteRecipes.map((recipe, index) => (
            <ListItemMotion key={recipe.id} index={index}>
              <RecipeListCard
                recipe={recipe}
                imageLoading={isImageLoading(recipe.id)}
                onPress={() => openRecipe(recipe)}
                favorite={{ active: true, onToggle: () => toggleFavorite(recipe.id) }}
                showCooked
              />
            </ListItemMotion>
          ))}

          {otherRecipes.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('saved.allRecipes')}</Text>
              {otherRecipes.map((recipe) => (
                <RecipeListCard
                  key={recipe.id}
                  recipe={recipe}
                  imageLoading={isImageLoading(recipe.id)}
                  onPress={() => openRecipe(recipe)}
                  favorite={{ active: false, onToggle: () => toggleFavorite(recipe.id) }}
                  showCooked
                />
              ))}
            </>
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
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
});
