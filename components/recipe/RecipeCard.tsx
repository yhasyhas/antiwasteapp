import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Clock, Lightbulb } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { getMealTypeIcon } from './options';
import { suggestionStyles } from './modalStyles';
import type { Recipe } from './types';

// Carte d'une recette générée (liste de l'écran de génération)
// imageLoading : image demandée en arrière-plan, emplacement avec indicateur jusqu'à son arrivée
export function RecipeCard({ recipe, imageLoading, onPress }: { recipe: Recipe; imageLoading: boolean; onPress: () => void }) {
  const { t } = useLanguage();

  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
    >
      {(recipe.image_url || imageLoading) && (
        <View style={styles.recipeImageContainer}>
          {recipe.image_url ? (
            <Image
              source={{ uri: recipe.image_url }}
              style={styles.recipeThumbnail}
              resizeMode="cover"
            />
          ) : (
            <ActivityIndicator color="#10b981" />
          )}
        </View>
      )}
      <View style={styles.recipeContent}>
        <View style={styles.recipeHeader}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <View style={[styles.difficultyBadge,
            recipe.difficulty === 'easy' ? styles.easyBadge :
            recipe.difficulty === 'medium' ? styles.mediumBadge :
            styles.expertBadge
          ]}>
            <Text style={styles.difficultyText}>
              {difficultyLabel(t, recipe.difficulty)}
            </Text>
          </View>
        </View>
        <Text style={styles.recipeDescription} numberOfLines={2}>
          {recipe.description}
        </Text>
        {recipe.suggestion && (
          <View style={suggestionStyles.suggestionBox}>
            <Lightbulb size={14} color="#b45309" />
            <Text style={suggestionStyles.suggestionText}>{recipe.suggestion}</Text>
          </View>
        )}
        <View style={styles.recipeFooter}>
          <View style={styles.recipeTime}>
            <Clock size={16} color="#6b7280" />
            <Text style={styles.recipeTimeText}>
              {t('common.minutes', { count: recipe.total_time })}
            </Text>
          </View>
          <View style={styles.recipeMeta}>
            {React.createElement(getMealTypeIcon(recipe.meal_type), { size: 14, color: '#6b7280' })}
            <Text style={styles.recipeMetaText}>
              {t('recipe.ingredientsShort', { count: recipe.ingredients_from_list?.length || 0 })}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  recipeImageContainer: {
    height: 150,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeThumbnail: {
    width: '100%',
    height: '100%',
  },
  recipeContent: {
    padding: 16,
  },
  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  easyBadge: {
    backgroundColor: '#10b981',
  },
  mediumBadge: {
    backgroundColor: '#f59e0b',
  },
  expertBadge: {
    backgroundColor: '#ef4444',
  },
  difficultyText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeMetaText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
