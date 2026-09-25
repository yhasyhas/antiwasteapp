import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, Heart } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import type { SavedRecipe } from '@/hooks/useSavedRecipes';

interface Props {
  recipe: SavedRecipe;
  // Section « favoris » (cœur rouge) ou « toutes les recettes » (cœur gris)
  inFavorites: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function SavedRecipeCard({ recipe, inFavorites, onPress, onToggleFavorite }: Props) {
  const { t } = useLanguage();

  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
    >
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <TouchableOpacity
          onPress={onToggleFavorite}
          style={styles.favoriteButton}
        >
          {inFavorites ? (
            <Heart
              size={24}
              color="#ef4444"
              fill={recipe.is_favorite ? '#ef4444' : 'transparent'}
            />
          ) : (
            <Heart
              size={24}
              color="#d1d5db"
              fill="transparent"
              strokeWidth={2}
            />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.recipeDescription} numberOfLines={2}>
        {recipe.description}
      </Text>
      <View style={styles.recipeFooter}>
        <View style={styles.recipeTime}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.recipeTimeText}>
            {t('common.minutes', { count: recipe.prep_time + recipe.cook_time })}
          </Text>
        </View>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>
            {difficultyLabel(t, recipe.difficulty)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  favoriteButton: {
    padding: 4,
    marginLeft: 8,
  },
  recipeDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeTimeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  difficultyBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
  },
  difficultyText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
