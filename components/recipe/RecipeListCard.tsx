import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ChefHat, Clock, Heart, Lightbulb } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { dietLabel, difficultyLabel } from '@/lib/labels';
import type { Recipe } from './types';

interface Props {
  recipe: Recipe;
  // Image en cours de génération : indicateur dans la vignette jusqu'à son arrivée
  imageLoading?: boolean;
  onPress: () => void;
  // Cœur de favori sur la carte (écran Favoris)
  favorite?: { active: boolean; onToggle: () => void };
}

// Carte de recette unique, pour toutes les listes (accueil, favoris, toutes les recettes, génération).
// Elle affiche l'image si elle existe, sans jamais la demander elle-même (voir useRecipeImages) ; la carte
// se met à jour à son arrivée (état partagé des images).
export function RecipeListCard({ recipe, imageLoading = false, onPress, favorite }: Props) {
  const { t } = useLanguage();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.thumbnail}>
        {recipe.image_url ? (
          // Cache sur disque : l'image n'est pas retéléchargée à chaque visite
          <Image
            source={{ uri: recipe.image_url }}
            style={styles.thumbnailImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={recipe.id}
            transition={150}
          />
        ) : imageLoading ? (
          <ActivityIndicator color="#10b981" />
        ) : (
          <ChefHat size={28} color="#a7f3d0" />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
          {favorite && (
            <TouchableOpacity onPress={favorite.onToggle} hitSlop={8} style={styles.favoriteButton}>
              <Heart size={22} color={favorite.active ? '#ef4444' : '#d1d5db'} fill={favorite.active ? '#ef4444' : 'transparent'} />
            </TouchableOpacity>
          )}
        </View>
        {recipe.description ? (
          <Text style={styles.description} numberOfLines={2}>{recipe.description}</Text>
        ) : null}
        {recipe.suggestion ? (
          <View style={styles.suggestion}>
            <Lightbulb size={12} color="#b45309" />
            <Text style={styles.suggestionText} numberOfLines={1}>{recipe.suggestion}</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.time}>
            <Clock size={14} color="#6b7280" />
            <Text style={styles.timeText}>{t('common.minutes', { count: recipe.total_time })}</Text>
          </View>
          {recipe.difficulty ? (
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>{difficultyLabel(t, recipe.difficulty)}</Text>
            </View>
          ) : null}
          {recipe.dietary_tags.slice(0, 1).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>{dietLabel(t, tag)}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ecfdf5',
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  favoriteButton: {
    marginLeft: 8,
  },
  description: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 6,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 6,
  },
  suggestionText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  difficultyBadge: {
    paddingVertical: 3,
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
  tag: {
    flexShrink: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280',
  },
});
