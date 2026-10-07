import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { NarrowPantryHint } from '@/components/recipe/NarrowPantryHint';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Illustrations';
import { ListItemMotion } from '@/components/ui/ListItemMotion';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton, SkeletonRecipeCard } from '@/components/ui/Skeleton';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

export default function GenerateRecipeScreen() {
  // priority : identifiants séparés par des virgules (accueil, fiche aliment, notification), présélectionnés
  const { priority } = useLocalSearchParams<{ priority?: string }>();
  const {
    ingredients,
    selectedIds,
    toggleSelected,
    clearSelection,
    hasLeftovers,
    resultNote,
    recipes,
    loading,
    generating,
    generatingMode,
    quotaReached,
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

      <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, safe.bottom(spacing.xxl)]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.chipsSkeleton}>
            {[0, 1, 2, 3].map((chip) => (
              <Skeleton key={chip} width={sizes.illustration - spacing.xxxl} height={sizes.touch} rounded={radius.pill} />
            ))}
          </View>
        ) : (
          <PantryChips ingredients={ingredients} selectedIds={selectedIds} onToggle={toggleSelected} onClear={clearSelection} />
        )}

        {/* Peu d'aliments disponibles ou choisis : en ajouter pour plus d'idées */}
        {!loading && !generating ? <NarrowPantryHint ingredients={ingredients} selectedIds={selectedIds} /> : null}

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
              <ListItemMotion key={recipe.id ?? index} index={index}>
                <RecipeListCard
                  recipe={recipe}
                  imageLoading={isImageLoading(recipe.id)}
                  onPress={() => openRecipe(recipe)}
                  favorite={recipe.id ? { active: isFavorite(recipe), onToggle: () => toggleFavorite(recipe) } : undefined}
                />
              </ListItemMotion>
            ))}
            {resultNote ? <Text style={styles.note}>{resultNote}</Text> : null}
          </View>
        )}

        {/* Actions à la fin de la liste : « D'autres recettes » (ou « Générer »), « Transformer mes restes »
            seulement avec des restes parmi les aliments choisis */}
        <View style={styles.actions}>
          <Button
            label={recipes.length > 0 ? t('generate.generateMore') : t('generate.generate')}
            icon={Sparkles}
            onPress={() => generateRecipes('standard')}
            loading={generatingMode === 'standard'}
            disabled={generating || quotaReached || ingredients.length === 0}
          />
          {hasLeftovers && (
            <Button
              label={t('generate.transformLeftovers')}
              icon={Soup}
              variant="soft"
              size="small"
              onPress={() => generateRecipes('leftovers')}
              loading={generatingMode === 'leftovers'}
              disabled={generating || quotaReached}
              style={styles.leftovers}
            />
          )}
          {/* Boutons grisés : toujours la raison */}
          {generating ? (
            <Text style={styles.note}>{t('generate.generatingNote')}</Text>
          ) : quotaReached ? (
            <Text style={styles.note}>{t('generate.quotaReachedNote')}</Text>
          ) : null}
        </View>
      </ScrollView>

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
  note: {
    ...typography.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.md,
  },
  leftovers: {
    alignSelf: 'center',
  },
});
