import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChefHat, Soup, Sparkles } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRecipeGeneration } from '@/hooks/useRecipeGeneration';
import { FilterSummary } from '@/components/recipe/FilterSummary';
import { FiltersModal } from '@/components/recipe/FiltersModal';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { PantryChips } from '@/components/recipe/PantryChips';

export default function GenerateRecipeScreen() {
  // priority : identifiants séparés par des virgules (notification des aliments qui expirent), présélectionnés
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
  const [showFilters, setShowFilters] = useState(false);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('generate.screenTitle'),
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#111827',
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('generate.yourIngredients')}</Text>
            <PantryChips ingredients={ingredients} selectedIds={selectedIds} onToggle={toggleSelected} onClear={clearSelection} />
          </View>

          <FilterSummary filters={filters} onOpen={() => setShowFilters(true)} />

          {recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <ChefHat size={64} color="#d1d5db" strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>{t('generate.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('generate.emptyText')}
              </Text>
            </View>
          ) : (
            <View style={styles.recipesSection}>
              <Text style={styles.sectionTitle}>{t('generate.generatedRecipes')}</Text>
              {recipes.map((recipe, index) => (
                <RecipeListCard key={recipe.id ?? index} recipe={recipe} imageLoading={isImageLoading(recipe.id)} onPress={() => openRecipe(recipe)} />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {hasLeftovers && (
            <TouchableOpacity
              style={[styles.leftoversButton, generating && styles.generateButtonDisabled]}
              onPress={() => generateRecipes('leftovers')}
              disabled={generating}
            >
              {generatingMode === 'leftovers' ? (
                <ActivityIndicator color="#b45309" />
              ) : (
                <>
                  <Soup size={20} color="#b45309" />
                  <Text style={styles.leftoversButtonText}>{t('generate.transformLeftovers')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.generateButton,
              generating && styles.generateButtonDisabled,
            ]}
            onPress={() => generateRecipes('standard')}
            disabled={generating || ingredients.length === 0}
          >
            {generatingMode === 'standard' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Sparkles size={20} color="#fff" />
                <Text style={styles.generateButtonText}>
                  {recipes.length > 0 ? t('generate.generateMore') : t('generate.generate')}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  recipesSection: {
    marginBottom: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  generateButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  leftoversButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    marginBottom: 10,
  },
  leftoversButtonText: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '700',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
