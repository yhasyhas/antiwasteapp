import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { Heart, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import type { SavedRecipe } from '@/hooks/useSavedRecipes';
import { CookedButton } from '@/components/recipe/CookedButton';

interface Props {
  recipe: SavedRecipe;
  // Image en cours de génération
  imageLoading: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
}

// Détail d'une recette de l'historique, avec le bouton favori
export function SavedRecipeDetailModal({ recipe, imageLoading, onClose, onToggleFavorite }: Props) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={!!recipe}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{recipe.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {recipe.image_url ? (
              <Image source={{ uri: recipe.image_url }} style={styles.recipeImage} resizeMode="cover" />
            ) : imageLoading ? (
              <View style={[styles.recipeImage, styles.imagePlaceholder]}>
                <ActivityIndicator color="#10b981" />
              </View>
            ) : null}
            <Text style={styles.modalDescription}>
              {recipe.description}
            </Text>

            <View style={styles.modalMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.prepTime')}</Text>
                <Text style={styles.metaValue}>
                  {t('common.minutes', { count: recipe.prep_time })}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.cookTime')}</Text>
                <Text style={styles.metaValue}>
                  {t('common.minutes', { count: recipe.cook_time })}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.difficulty')}</Text>
                <Text style={styles.metaValue}>
                  {difficultyLabel(t, recipe.difficulty)}
                </Text>
              </View>
            </View>

            {recipe.dietary_tags.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t('recipe.dietaryInfo')}</Text>
                <View style={styles.tagContainer}>
                  {recipe.dietary_tags.map((tag, index) => (
                    <View key={index} style={styles.dietaryTag}>
                      <Text style={styles.dietaryTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {Array.isArray(recipe.ingredients_used) &&
              recipe.ingredients_used.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t('recipe.ingredients')}</Text>
                  {recipe.ingredients_used.map((ing, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.bullet} />
                      <Text style={styles.ingredientText}>
                        {typeof ing === 'string' ? ing : ing.name || ing}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            {Array.isArray(recipe.instructions) &&
              recipe.instructions.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t('recipe.instructions')}</Text>
                  {recipe.instructions.map((step, index) => (
                    <View key={index} style={styles.instructionItem}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.instructionText}>
                        {typeof step === 'string' ? step : step.text || step}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.favoriteModalButton,
              recipe.is_favorite &&
                styles.favoriteModalButtonActive,
            ]}
            onPress={onToggleFavorite}
          >
            <Heart
              size={20}
              color={recipe.is_favorite ? '#fff' : '#ef4444'}
              fill={recipe.is_favorite ? '#fff' : 'transparent'}
            />
            <Text
              style={[
                styles.favoriteModalButtonText,
                recipe.is_favorite &&
                  styles.favoriteModalButtonTextActive,
              ]}
            >
              {recipe.is_favorite
                ? t('saved.removeFavorite')
                : t('recipe.saveToFavorites')}
            </Text>
          </TouchableOpacity>
          <CookedButton ingredientsUsed={recipe.ingredients_used} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 20,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'capitalize',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietaryTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ede9fe',
  },
  dietaryTagText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginTop: 8,
    marginRight: 12,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  favoriteModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    marginTop: 8,
  },
  favoriteModalButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  favoriteModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  favoriteModalButtonTextActive: {
    color: '#fff',
  },
});
