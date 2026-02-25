import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { router, Stack } from 'expo-router';
import {
  ChefHat,
  Clock,
  Heart,
  X,
  Filter,
  Check,
  Sparkles,
} from 'lucide-react-native';

interface Recipe {
  title: string;
  description: string;
  ingredients_used: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  difficulty: string;
  dietary_tags: string[];
}

interface Filters {
  dietary: string[];
  difficulty: string;
  maxCookTime: number;
}

const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Low-Carb',
];

const difficultyOptions = ['easy', 'medium', 'hard'];

export default function GenerateRecipeScreen() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    dietary: [],
    difficulty: 'easy',
    maxCookTime: 60,
  });

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      setIngredients(data);
    }
    setLoading(false);
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add ingredients first');
      return;
    }

    setGenerating(true);

    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-recipes`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ingredients: ingredients.map((i) => i.name),
          preferences: filters,
        }),
      });

      const data = await response.json();

      if (data.recipes) {
        setRecipes(data.recipes);
      } else {
        Alert.alert('Error', 'Failed to generate recipes');
      }
    } catch (error) {
      console.error('Error generating recipes:', error);
      Alert.alert('Error', 'Failed to generate recipes');
    } finally {
      setGenerating(false);
    }
  };

  const saveRecipe = async (recipe: Recipe) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        ingredients_used: recipe.ingredients_used,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        difficulty: recipe.difficulty,
        dietary_tags: recipe.dietary_tags,
      })
      .select()
      .single();

    if (data) {
      await supabase.from('favorites').insert({
        user_id: user.id,
        recipe_id: data.id,
      });

      Alert.alert(
        'Recipe Saved!',
        'Your recipe has been saved to favorites.',
        [
          {
            text: 'View Saved',
            onPress: () => router.push('/(tabs)/saved'),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  };

  const toggleDietaryFilter = (option: string) => {
    setFilters({
      ...filters,
      dietary: filters.dietary.includes(option)
        ? filters.dietary.filter((d) => d !== option)
        : [...filters.dietary, option],
    });
  };

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
          title: 'Generate Recipes',
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#111827',
        }}
      />
      <View style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Ingredients</Text>
            <View style={styles.ingredientGrid}>
              {ingredients.slice(0, 6).map((ingredient) => (
                <View key={ingredient.id} style={styles.ingredientChip}>
                  <Text style={styles.ingredientChipText}>
                    {ingredient.name}
                  </Text>
                </View>
              ))}
              {ingredients.length > 6 && (
                <View style={styles.ingredientChip}>
                  <Text style={styles.ingredientChipText}>
                    +{ingredients.length - 6} more
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Filter size={20} color="#10b981" />
              <Text style={styles.filterButtonText}>Preferences</Text>
              {(filters.dietary.length > 0 || filters.difficulty !== 'easy') && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {filters.dietary.length > 0
                      ? filters.dietary.length
                      : '1'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {recipes.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <ChefHat size={64} color="#d1d5db" strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>Ready to Cook?</Text>
              <Text style={styles.emptyText}>
                Generate personalized recipes based on your ingredients
              </Text>
            </View>
          ) : (
            <View style={styles.recipesSection}>
              <Text style={styles.sectionTitle}>Generated Recipes</Text>
              {recipes.map((recipe, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recipeCard}
                  onPress={() => setSelectedRecipe(recipe)}
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
                        {recipe.dietary_tags.slice(0, 2).map((tag, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.generateButton,
              generating && styles.generateButtonDisabled,
            ]}
            onPress={generateRecipes}
            disabled={generating || ingredients.length === 0}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Sparkles size={20} color="#fff" />
                <Text style={styles.generateButtonText}>
                  {recipes.length > 0 ? 'Generate More' : 'Generate Recipes'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={showFilters}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFilters(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Recipe Preferences</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupTitle}>Dietary Preferences</Text>
                  <View style={styles.optionGrid}>
                    {dietaryOptions.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionChip,
                          filters.dietary.includes(option) &&
                            styles.optionChipSelected,
                        ]}
                        onPress={() => toggleDietaryFilter(option)}
                      >
                        {filters.dietary.includes(option) && (
                          <Check size={16} color="#fff" />
                        )}
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.dietary.includes(option) &&
                              styles.optionChipTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupTitle}>Difficulty Level</Text>
                  <View style={styles.optionGrid}>
                    {difficultyOptions.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionChip,
                          filters.difficulty === option &&
                            styles.optionChipSelected,
                        ]}
                        onPress={() =>
                          setFilters({ ...filters, difficulty: option })
                        }
                      >
                        {filters.difficulty === option && (
                          <Check size={16} color="#fff" />
                        )}
                        <Text
                          style={[
                            styles.optionChipText,
                            filters.difficulty === option &&
                              styles.optionChipTextSelected,
                          ]}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Ingredients</Text>
                    {selectedRecipe.ingredients_used.map((ing, index) => (
                      <View key={index} style={styles.ingredientItem}>
                        <View style={styles.bullet} />
                        <Text style={styles.ingredientText}>{ing}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Instructions</Text>
                    {selectedRecipe.instructions.map((step, index) => (
                      <View key={index} style={styles.instructionItem}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={styles.saveRecipeButton}
                  onPress={() => {
                    if (selectedRecipe) {
                      saveRecipe(selectedRecipe);
                      setSelectedRecipe(null);
                    }
                  }}
                >
                  <Heart size={20} color="#fff" />
                  <Text style={styles.saveRecipeButtonText}>
                    Save to Favorites
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </>
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
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  ingredientChipText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  filterBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  recipesSection: {
    padding: 20,
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
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  generateButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  optionChipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  saveRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveRecipeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
