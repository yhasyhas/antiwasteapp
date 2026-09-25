import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { Heart, Lightbulb, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { modalStyles, suggestionStyles } from './modalStyles';
import { CookedButton } from './CookedButton';
import type { Recipe } from './types';

interface Props {
  recipe: Recipe;
  // Image en cours de génération
  imageLoading: boolean;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
}

// Détail d'une recette générée, avec le bouton de sauvegarde
export function RecipeDetailModal({ recipe, imageLoading, onClose, onSave }: Props) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={!!recipe}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>{recipe.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!recipe.image_url && imageLoading && (
              <View style={[styles.imageContainer, styles.imagePlaceholder]}>
                <ActivityIndicator color="#10b981" />
              </View>
            )}
            {recipe.image_url && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: recipe.image_url }}
                  style={styles.recipeImage}
                  resizeMode="cover"
                />
                <Text style={styles.imageCaption}>{t('recipe.imageCaption')}</Text>
              </View>
            )}

            <Text style={styles.modalDescription}>
              {recipe.description}
            </Text>

            {recipe.suggestion && (
              <View style={suggestionStyles.suggestionBox}>
                <Lightbulb size={16} color="#b45309" />
                <Text style={suggestionStyles.suggestionText}>{recipe.suggestion}</Text>
              </View>
            )}

            <View style={styles.modalMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.prepTime')}</Text>
                <Text style={styles.metaValue}>{t('common.minutes', { count: recipe.prep_time })}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.cookTime')}</Text>
                <Text style={styles.metaValue}>{t('common.minutes', { count: recipe.cook_time })}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.totalTime')}</Text>
                <Text style={styles.metaValue}>{t('common.minutes', { count: recipe.total_time })}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>{t('recipe.servings')}</Text>
                <Text style={styles.metaValue}>{recipe.servings}</Text>
              </View>
            </View>

            {/* Ingrédients utilisés de la liste */}
            {recipe.ingredients_from_list && recipe.ingredients_from_list.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t('recipe.fromPantry')}</Text>
                <View style={styles.tagContainer}>
                  {recipe.ingredients_from_list.map((ing, index) => (
                    <View key={index} style={styles.ingredientTag}>
                      <Text style={styles.ingredientTagText}>✓ {ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Ingrédients manquants suggérés */}
            {recipe.missing_ingredients && recipe.missing_ingredients.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t('recipe.missing')}</Text>
                <View style={styles.tagContainer}>
                  {recipe.missing_ingredients.map((ing, index) => (
                    <View key={index} style={styles.missingIngredientTag}>
                      <Text style={styles.missingIngredientText}>+ {ing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Tous les ingrédients avec quantités */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>{t('recipe.allIngredients')}</Text>
              {recipe.ingredients_used.map((ing, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <View style={styles.bullet} />
                  <Text style={styles.ingredientText}>
                    {ing.name}: {ing.quantity} {ing.unit}
                  </Text>
                </View>
              ))}
            </View>

            {/* Instructions */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>{t('recipe.instructions')}</Text>
              {recipe.instructions.map((step, index) => (
                <View key={index} style={styles.instructionItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Conseils */}
            {recipe.tips.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{t('recipe.tips')}</Text>
                {recipe.tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipText}>💡 {tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.saveRecipeButton}
            onPress={() => onSave(recipe)}
          >
            <Heart size={20} color="#fff" />
            <Text style={styles.saveRecipeButtonText}>
              {t('recipe.saveToFavorites')}
            </Text>
          </TouchableOpacity>
          <CookedButton ingredientsUsed={recipe.ingredients_used} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 24,
  },
  modalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  metaItem: {
    flex: 1,
    minWidth: '40%',
  },
  metaLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  recipeImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
  },
  imageCaption: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientTag: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ingredientTagText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
  missingIngredientTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  missingIngredientText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 10,
  },
  ingredientText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  instructionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },
  tipItem: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  saveRecipeButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveRecipeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
