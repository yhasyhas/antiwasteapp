import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';

export interface RecentRecipe {
  id: string;
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  difficulty: string;
  dietary_tags: string[];
  ingredients_used: any[];
}

// Carte d'une recette récente (accueil)
export function RecentRecipeCard({ recipe, onPress }: { recipe: RecentRecipe; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={onPress}
    >
      <View style={styles.recipeHeader}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>
            {recipe.difficulty}
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
            {recipe.prep_time + recipe.cook_time} min
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recipeCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
