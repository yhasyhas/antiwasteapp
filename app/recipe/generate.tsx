import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Soup, Sparkles } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useRecipeGeneration } from '@/hooks/useRecipeGeneration';
import { FilterSummary } from '@/components/recipe/FilterSummary';
import { FiltersModal } from '@/components/recipe/FiltersModal';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { PantryChips } from '@/components/recipe/PantryChips';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Illustrations';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton, SkeletonRecipeCard } from '@/components/ui/Skeleton';
import { colors, radius, sizes, spacing } from '@/constants/theme';

export default function GenerateRecipeScreen() {
  // priority : identifiants séparés par des virgules (accueil, fiche aliment, notification), présélectionnés
  const { priority } = useLocalSearchParams<{ priority?: string }>();
  const {
    ingredients,
    selectedIds,
    toggleSelected,
    clearSelection,
    hasLeftovers,
    recipes,
    loading,
    generating,
    generatingMode,
    selectedRecipe,
    setSelectedRecipe,
    isImageLoading,
    imageNotice,
    isFavorite,
    filters,
    setFilters,
    generateRecipes,
    openRecipe,
    toggleFavorite,
    toggleDietaryFilter,
  } = useRecipeGeneration(priority ? priority.split(',').filter(Boolean) : []);
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [showFilters, setShowFilters] = useState(false);

  const title = recipes.length > 0 ? t('generate.resultsTitle', { count: recipes.length }) : t('generate.screenTitle');

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} back />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.chipsSkeleton}>
            {[0, 1, 2, 3].map((chip) => (
              <Skeleton key={chip} width={sizes.illustration - spacing.xxxl} height={sizes.touch} rounded={radius.pill} />
            ))}
          </View>
        ) : (
          <PantryChips ingredients={ingredients} selectedIds={selectedIds} onToggle={toggleSelected} onClear={clearSelection} />
        )}

        <FilterSummary filters={filters} onOpen={() => setShowFilters(true)} />

        {generating ? (
          <View>
            <SkeletonRecipeCard />
            <SkeletonRecipeCard />
          </View>
        ) : recipes.length === 0 ? (
          <EmptyState kind="recipes" title={t('generate.emptyTitle')} text={t('generate.emptyText')} />
        ) : (
          <View>
            {recipes.map((recipe, index) => (
              <RecipeListCard
                key={recipe.id ?? index}
                recipe={recipe}
                imageLoading={isImageLoading(recipe.id)}
                onPress={() => openRecipe(recipe)}
                favorite={recipe.id ? { active: isFavorite(recipe), onToggle: () => toggleFavorite(recipe) } : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, safe.bottom(spacing.lg)]}>
        {hasLeftovers && (
          <Button
            label={t('generate.transformLeftovers')}
            icon={Soup}
            variant="accent"
            size="medium"
            onPress={() => generateRecipes('leftovers')}
            loading={generatingMode === 'leftovers'}
            disabled={generating}
          />
        )}
        <Button
          label={recipes.length > 0 ? t('generate.generateMore') : t('generate.generate')}
          icon={Sparkles}
          onPress={() => generateRecipes('standard')}
          loading={generatingMode === 'standard'}
          disabled={generating || ingredients.length === 0}
        />
      </View>

      <FiltersModal
        visible={showFilters}
        filters={filters}
        onChange={setFilters}
        onToggleDietary={toggleDietaryFilter}
        onClose={() => setShowFilters(false)}
      />

      {selectedRecipe && (
        <RecipeSheet
          recipe={selectedRecipe}
          imageLoading={isImageLoading(selectedRecipe.id)}
          imageNotice={imageNotice(selectedRecipe.id)}
          isFavorite={isFavorite(selectedRecipe)}
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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  chipsSkeleton: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
});
