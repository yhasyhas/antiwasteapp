import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Clock, ImageOff } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import type { Recipe } from '@/components/recipe/types';

interface Props {
  recipe: Recipe;
  imageLoading: boolean;
  onPress: () => void;
}

// Carte d'une recette récente (accueil), avec son image
export function RecentRecipeCard({ recipe, imageLoading, onPress }: Props) {
  const { t } = useLanguage();

  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
    >
      <View style={styles.thumbnail}>
        {recipe.image_url ? (
          <Image source={{ uri: recipe.image_url }} style={styles.thumbnailImage} resizeMode="cover" />
        ) : imageLoading ? (
          <ActivityIndicator color="#10b981" />
        ) : (
          <ImageOff size={22} color="#d1d5db" />
        )}
      </View>
      <View style={styles.body}>
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>
            {difficultyLabel(t, recipe.difficulty)}
          </Text>
        </View>
      </View>
      <Text style={styles.recipeDescription} numberOfLines={2}>
        {recipe.description}
      </Text>
      <View style={styles.recipeFooter}>
        <View style={styles.recipeTime}>
          <Clock size={16} color="#6b7280" />
          <Text style={styles.recipeTimeText}>
            {t('common.minutes', { count: recipe.total_time })}
          </Text>
        </View>
        {recipe.dietary_tags.length > 0 && (
          <View style={styles.recipeTags}>
            {recipe.dietary_tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
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
  difficultyBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    marginLeft: 8,
  },
  difficultyText: {
    fontSize: 12,
    color: '#10b981',
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
  recipeTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280',
  },
});
