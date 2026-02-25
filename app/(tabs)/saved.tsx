import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Heart, Clock, ChefHat, X } from 'lucide-react-native';

interface Recipe {
  id: string;
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  difficulty: string;
  dietary_tags: string[];
  ingredients_used: any[];
  instructions: any[];
  is_favorite?: boolean;
}

export default function SavedScreen() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    if (!user) return;

    setLoading(true);

    const { data: allRecipes } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const { data: favorites } = await supabase
      .from('favorites')
      .select('recipe_id')
      .eq('user_id', user.id);

    if (allRecipes && favorites) {
      const favoriteIds = new Set(favorites.map((f) => f.recipe_id));
      const recipesWithFavorites = allRecipes.map((recipe) => ({
        ...recipe,
        is_favorite: favoriteIds.has(recipe.id),
      }));
      setRecipes(recipesWithFavorites);
    }

    setLoading(false);
  };

  const toggleFavorite = async (recipeId: string) => {
    if (!user) return;

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    if (recipe.is_favorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('recipe_id', recipeId);
    } else {
      await supabase.from('favorites').insert({
        user_id: user.id,
        recipe_id: recipeId,
      });
    }

    setRecipes(
      recipes.map((r) =>
        r.id === recipeId ? { ...r, is_favorite: !r.is_favorite } : r
      )
    );
  };

  const favoriteRecipes = recipes.filter((r) => r.is_favorite);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Recipes</Text>
        <Text style={styles.headerSubtitle}>
          {favoriteRecipes.length} favorite
          {favoriteRecipes.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {favoriteRecipes.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Heart size={64} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No Saved Recipes</Text>
          <Text style={styles.emptyText}>
            Generate recipes and save your favorites here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.recipeList}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Favorites</Text>
            {favoriteRecipes.map((recipe) => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => setSelectedRecipe(recipe)}
              >
                <View style={styles.recipeHeader}>
                  <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(recipe.id)}
                    style={styles.favoriteButton}
                  >
                    <Heart
                      size={24}
                      color="#ef4444"
                      fill={recipe.is_favorite ? '#ef4444' : 'transparent'}
                    />
                  </TouchableOpacity>
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
                  <View style={styles.difficultyBadge}>
                    <Text style={styles.difficultyText}>
                      {recipe.difficulty}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {recipes.filter((r) => !r.is_favorite).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Recipes</Text>
              {recipes
                .filter((r) => !r.is_favorite)
                .map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeCard}
                    onPress={() => setSelectedRecipe(recipe)}
                  >
                    <View style={styles.recipeHeader}>
                      <Text style={styles.recipeTitle}>{recipe.title}</Text>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(recipe.id)}
                        style={styles.favoriteButton}
                      >
                        <Heart
                          size={24}
                          color="#d1d5db"
                          fill="transparent"
                          strokeWidth={2}
                        />
                      </TouchableOpacity>
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
                      <View style={styles.difficultyBadge}>
                        <Text style={styles.difficultyText}>
                          {recipe.difficulty}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </ScrollView>
      )}

      {selectedRecipe && (
        <Modal
          visible={!!selectedRecipe}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedRecipe(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                <TouchableOpacity onPress={() => setSelectedRecipe(null)}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalDescription}>
                  {selectedRecipe.description}
                </Text>

                <View style={styles.modalMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Prep Time</Text>
                    <Text style={styles.metaValue}>
                      {selectedRecipe.prep_time} min
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Cook Time</Text>
                    <Text style={styles.metaValue}>
                      {selectedRecipe.cook_time} min
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Difficulty</Text>
                    <Text style={styles.metaValue}>
                      {selectedRecipe.difficulty}
                    </Text>
                  </View>
                </View>

                {selectedRecipe.dietary_tags.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Dietary Info</Text>
                    <View style={styles.tagContainer}>
                      {selectedRecipe.dietary_tags.map((tag, index) => (
                        <View key={index} style={styles.dietaryTag}>
                          <Text style={styles.dietaryTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {Array.isArray(selectedRecipe.ingredients_used) &&
                  selectedRecipe.ingredients_used.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingredients</Text>
                      {selectedRecipe.ingredients_used.map((ing, index) => (
                        <View key={index} style={styles.ingredientItem}>
                          <View style={styles.bullet} />
                          <Text style={styles.ingredientText}>
                            {typeof ing === 'string' ? ing : ing.name || ing}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {Array.isArray(selectedRecipe.instructions) &&
                  selectedRecipe.instructions.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Instructions</Text>
                      {selectedRecipe.instructions.map((step, index) => (
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
                  selectedRecipe.is_favorite &&
                    styles.favoriteModalButtonActive,
                ]}
                onPress={() => {
                  if (selectedRecipe) {
                    toggleFavorite(selectedRecipe.id);
                    setSelectedRecipe({
                      ...selectedRecipe,
                      is_favorite: !selectedRecipe.is_favorite,
                    });
                  }
                }}
              >
                <Heart
                  size={20}
                  color={selectedRecipe.is_favorite ? '#fff' : '#ef4444'}
                  fill={selectedRecipe.is_favorite ? '#fff' : 'transparent'}
                />
                <Text
                  style={[
                    styles.favoriteModalButtonText,
                    selectedRecipe.is_favorite &&
                      styles.favoriteModalButtonTextActive,
                  ]}
                >
                  {selectedRecipe.is_favorite
                    ? 'Remove from Favorites'
                    : 'Save to Favorites'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  recipeList: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
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
