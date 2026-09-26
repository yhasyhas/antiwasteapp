import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Heart, ImageOff, Lightbulb, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { modalStyles, suggestionStyles } from './modalStyles';
import { CookedButton } from './CookedButton';
import type { Recipe } from './types';

interface Props {
  recipe: Recipe;
  // Image en cours de génération : l'emplacement affiche un indicateur, puis l'image à son arrivée
  imageLoading: boolean;
  // Image impossible (quota du jour, panne) : message discret à son emplacement
  imageNotice?: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

// Fiche recette unique (génération, recettes récentes, favoris) : image, temps, ingrédients du
// garde-manger et à acheter, quantités, étapes, conseils, suggestion, favori et « J'ai cuisiné ça »
export function RecipeSheet({ recipe, imageLoading, imageNotice, isFavorite, onToggleFavorite, onClose }: Props) {
  const { t } = useLanguage();
  const missing = recipe.missing_ingredients ?? [];

  return (
    <Modal visible animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>{recipe.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Emplacement réservé : la fiche s'affiche tout de suite, l'image s'y place à son arrivée */}
            <View style={styles.imageSlot}>
              {recipe.image_url ? (
                <Image source={{ uri: recipe.image_url }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={150} />
              ) : imageLoading ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <>
                  <ImageOff size={32} color="#d1d5db" />
                  {imageNotice ? <Text style={styles.imageNotice}>{imageNotice}</Text> : null}
                </>
              )}
            </View>
            {recipe.image_url ? <Text style={styles.imageCaption}>{t('recipe.imageCaption')}</Text> : null}

            {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

            {recipe.suggestion ? (
              <View style={suggestionStyles.suggestionBox}>
                <Lightbulb size={16} color="#b45309" />
                <Text style={suggestionStyles.suggestionText}>{recipe.suggestion}</Text>
              </View>
            ) : null}

            <View style={styles.meta}>
              <Meta label={t('recipe.prepTime')} value={t('common.minutes', { count: recipe.prep_time })} />
              <Meta label={t('recipe.cookTime')} value={t('common.minutes', { count: recipe.cook_time })} />
              <Meta label={t('recipe.totalTime')} value={t('common.minutes', { count: recipe.total_time })} />
              {recipe.servings > 0 && <Meta label={t('recipe.servings')} value={String(recipe.servings)} />}
              {recipe.difficulty ? <Meta label={t('recipe.difficulty')} value={difficultyLabel(t, recipe.difficulty)} /> : null}
            </View>

            {recipe.dietary_tags.length > 0 && (
              <Section title={t('recipe.dietaryInfo')}>
                <View style={styles.tags}>
                  {recipe.dietary_tags.map((tag, index) => (
                    <View key={index} style={styles.dietTag}>
                      <Text style={styles.dietTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {recipe.ingredients_from_list.length > 0 && (
              <Section title={t('recipe.fromPantry')}>
                <View style={styles.tags}>
                  {recipe.ingredients_from_list.map((name, index) => (
                    <View key={index} style={styles.pantryTag}>
                      <Text style={styles.pantryTagText}>✓ {name}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {missing.length > 0 && (
              <Section title={t('recipe.missing')}>
                <View style={styles.tags}>
                  {missing.map((name, index) => (
                    <View key={index} style={styles.missingTag}>
                      <Text style={styles.missingTagText}>+ {name}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {recipe.ingredients_used.length > 0 && (
              <Section title={t('recipe.allIngredients')}>
                {recipe.ingredients_used.map((ingredient, index) => {
                  const amount = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ');
                  return (
                    <View key={index} style={styles.ingredientRow}>
                      <View style={styles.bullet} />
                      <Text style={styles.ingredientText}>{amount ? `${ingredient.name} : ${amount}` : ingredient.name}</Text>
                    </View>
                  );
                })}
              </Section>
            )}

            {recipe.instructions.length > 0 && (
              <Section title={t('recipe.instructions')}>
                {recipe.instructions.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </Section>
            )}

            {recipe.tips.length > 0 && (
              <Section title={t('recipe.tips')}>
                {recipe.tips.map((tip, index) => (
                  <View key={index} style={styles.tip}>
                    <Text style={styles.tipText}>💡 {tip}</Text>
                  </View>
                ))}
              </Section>
            )}
          </ScrollView>

          <TouchableOpacity style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]} onPress={onToggleFavorite}>
            <Heart size={20} color={isFavorite ? '#ef4444' : '#fff'} fill={isFavorite ? '#ef4444' : 'transparent'} />
            <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
              {isFavorite ? t('saved.removeFavorite') : t('recipe.saveToFavorites')}
            </Text>
          </TouchableOpacity>
          <CookedButton ingredientsUsed={recipe.ingredients_used} />
        </View>
      </View>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  imageSlot: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageNotice: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  imageCaption: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 24,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  metaItem: {
    minWidth: '40%',
    flex: 1,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietTag: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dietTagText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '600',
  },
  pantryTag: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pantryTagText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
  missingTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  missingTagText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  ingredientRow: {
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
  stepRow: {
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
  stepText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },
  tip: {
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
  favoriteButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  favoriteButtonActive: {
    backgroundColor: '#fef2f2',
  },
  favoriteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#ef4444',
  },
});
