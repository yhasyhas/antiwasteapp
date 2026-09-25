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
  Image
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction } from '@/lib/callEdgeFunction';
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
  Coffee,
  Sun,
  Moon,
  Cookie,
  Globe,
  Lightbulb,
} from 'lucide-react-native';

interface Recipe {
  // Identifiant de la ligne dans la table recipes, une fois la recette enregistrée dans l'historique
  id?: string;
  title: string;
  description: string;
  ingredients_used: Array<{name: string; quantity: string; unit: string}>;
  ingredients_from_list: string[];
  missing_ingredients?: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  difficulty: string;
  meal_type: string;
  dietary_tags: string[];
  tips: string[];
  suggestion?: string;
  image_url?: string;
}

interface Filters {
  dietary: string[];
  difficulty: 'easy' | 'medium' | 'expert';
  maxCookTime: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  language: string;
}

// Types de repas avec icônes et labels
const mealTypes = [
  { value: 'breakfast', label: 'Petit-déjeuner', icon: Coffee, color: '#f59e0b' },
  { value: 'lunch', label: 'Déjeuner', icon: Sun, color: '#10b981' },
  { value: 'dinner', label: 'Dîner', icon: Moon, color: '#6366f1' },
  { value: 'snack', label: 'Goûter', icon: Cookie, color: '#ec4899' },
];

// Langues disponibles
const languages = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
];

const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Low-Carb',
];

const difficultyOptions = ['easy', 'medium', 'expert'];

export default function GenerateRecipeScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
    mealType: 'lunch',
    language: 'fr',
  });

  useEffect(() => {
    loadIngredients();
    loadUserPreferences();
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

  const loadUserPreferences = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setFilters({
        dietary: data.dietary_preferences || [],
        difficulty: data.default_difficulty || 'easy',
        maxCookTime: data.max_cook_time || 60,
        mealType: data.default_meal_type || 'lunch',
        language: data.default_language || 'fr',
      });
    }
  };

  const generateRecipes = async () => {
    if (ingredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add ingredients first');
      return;
    }

    setGenerating(true);

    try {
      const { data } = await callEdgeFunction('generate-recipes', {
        ingredients: ingredients.map((i) => i.name),
        preferences: {
          dietary: filters.dietary,
          difficulty: filters.difficulty,
          maxCookTime: filters.maxCookTime,
          mealType: filters.mealType,
          language: filters.language,
        },
        generateImage: true,
      });

      if (data?.recipes) {
        // Enregistrées dans l'historique avant l'affichage, pour que chaque recette ait déjà son id
        // quand l'utilisateur la sauvegarde (sinon elle serait insérée une seconde fois)
        setRecipes(await saveRecipesToHistory(data.recipes));
      } else if (data?.error) {
        Alert.alert(data.error === 'quota_exceeded' ? t('dailyLimitTitle') : 'Error', data.message || 'Failed to generate recipes');
      } else {
        Alert.alert('Error', 'Failed to generate recipes');
      }
    } catch (error) {
      console.error('Error generating recipes:', error);
      Alert.alert('Error', 'Failed to generate recipes. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Ligne de la table recipes correspondant à une recette générée
  const toRecipeRow = (recipe: Recipe) => ({
    user_id: user!.id,
    title: recipe.title,
    description: recipe.description,
    ingredients_used: recipe.ingredients_used,
    ingredients_from_list: recipe.ingredients_from_list,
    missing_ingredients: recipe.missing_ingredients || [],
    instructions: recipe.instructions,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    total_time: recipe.total_time,
    difficulty: recipe.difficulty,
    meal_type: recipe.meal_type,
    dietary_tags: recipe.dietary_tags,
    servings: recipe.servings,
    tips: recipe.tips || [],
    suggestion: recipe.suggestion ?? null,
    image_url: recipe.image_url,
    language: filters.language,
  });

  // Enregistre les recettes générées dans l'historique et renvoie les recettes avec leur id.
  // En cas d'échec, les recettes sont renvoyées sans id (saveRecipe les insérera à la sauvegarde).
  const saveRecipesToHistory = async (newRecipes: Recipe[]): Promise<Recipe[]> => {
    if (!user) return newRecipes;

    const { data, error } = await supabase
      .from('recipes')
      .insert(newRecipes.map(toRecipeRow))
      .select('id, title');

    if (error || !data || data.length !== newRecipes.length) {
      alertWriteError(t, 'saving recipes to history', error);
      return newRecipes;
    }

    // Correspondance par titre (l'ordre des lignes renvoyées n'est pas garanti) ; chaque id n'est utilisé qu'une fois
    const unused = [...data];
    return newRecipes.map((recipe) => {
      const index = unused.findIndex((row) => row.title === recipe.title);
      return index === -1 ? recipe : { ...recipe, id: unused.splice(index, 1)[0].id as string };
    });
  };

  // Sauvegarder = ajouter aux favoris la recette déjà présente dans l'historique
  const saveRecipe = async (recipe: Recipe) => {
    if (!user) return;

    let recipeId = recipe.id;
    if (!recipeId) {
      // L'enregistrement dans l'historique avait échoué : on insère la recette maintenant
      const { data, error } = await supabase
        .from('recipes')
        .insert(toRecipeRow(recipe))
        .select('id')
        .single();

      if (error || !data) {
        alertWriteError(t, 'saving recipe', error);
        return;
      }
      recipeId = data.id as string;
      setRecipes((current) => current.map((r) => (r === recipe ? { ...r, id: recipeId } : r)));
    }

    const { error: favoriteError } = await supabase.from('favorites').insert({
      user_id: user.id,
      recipe_id: recipeId,
    });
    // 23505 : déjà en favori (contrainte unique user_id + recipe_id), la sauvegarde est donc acquise
    if (favoriteError && favoriteError.code !== '23505') {
      alertWriteError(t, 'adding recipe to favorites', favoriteError);
      return;
    }

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
  };

  const toggleDietaryFilter = (option: string) => {
    setFilters({
      ...filters,
      dietary: filters.dietary.includes(option)
        ? filters.dietary.filter((d) => d !== option)
        : [...filters.dietary, option],
    });
  };

  const getMealTypeLabel = (value: string) => {
    return mealTypes.find(m => m.value === value)?.label || value;
  };

  const getMealTypeIcon = (value: string) => {
    return mealTypes.find(m => m.value === value)?.icon || Sun;
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
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {filters.dietary.length + 2} {/* +2 pour mealType et difficulty */}
                </Text>
              </View>
            </TouchableOpacity>
            
            {/* Affichage rapide des filtres actifs */}
            <View style={styles.activeFilters}>
              <View style={[styles.activeFilterChip, { backgroundColor: mealTypes.find(m => m.value === filters.mealType)?.color || '#10b981' }]}>
                {React.createElement(getMealTypeIcon(filters.mealType), { size: 14, color: '#fff' })}
                <Text style={styles.activeFilterText}>{getMealTypeLabel(filters.mealType)}</Text>
              </View>
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>{filters.difficulty}</Text>
              </View>
              <View style={styles.activeFilterChip}>
                <Globe size={14} color="#fff" />
                <Text style={styles.activeFilterText}>{filters.language.toUpperCase()}</Text>
              </View>
            </View>
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
                  {recipe.image_url && (
                    <View style={styles.recipeImageContainer}>
                      <Image 
                        source={{ uri: recipe.image_url }} 
                        style={styles.recipeThumbnail}
                        resizeMode="cover"
                      />
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
                          {recipe.difficulty}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recipeDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                    {recipe.suggestion && (
                      <View style={styles.suggestionBox}>
                        <Lightbulb size={14} color="#b45309" />
                        <Text style={styles.suggestionText}>{recipe.suggestion}</Text>
                      </View>
                    )}
                    <View style={styles.recipeFooter}>
                      <View style={styles.recipeTime}>
                        <Clock size={16} color="#6b7280" />
                        <Text style={styles.recipeTimeText}>
                          {recipe.total_time} min
                        </Text>
                      </View>
                      <View style={styles.recipeMeta}>
                        {React.createElement(getMealTypeIcon(recipe.meal_type), { size: 14, color: '#6b7280' })}
                        <Text style={styles.recipeMetaText}>
                          {recipe.ingredients_from_list?.length || 0} ingr.
                        </Text>
                      </View>
                    </View>
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

        {/* Modal Filtres */}
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
                {/* Type de repas - NOUVEAU */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupTitle}>Type de repas</Text>
                  <View style={styles.mealTypeGrid}>
                    {mealTypes.map((meal) => (
                      <TouchableOpacity
                        key={meal.value}
                        style={[
                          styles.mealTypeCard,
                          filters.mealType === meal.value && styles.mealTypeCardSelected,
                          { borderColor: meal.color }
                        ]}
                        onPress={() => setFilters({ ...filters, mealType: meal.value as any })}
                      >
                        <View style={[styles.mealTypeIcon, { backgroundColor: meal.color + '20' }]}>
                          <meal.icon size={24} color={meal.color} />
                        </View>
                        <Text style={[
                          styles.mealTypeLabel,
                          filters.mealType === meal.value && styles.mealTypeLabelSelected
                        ]}>
                          {meal.label}
                        </Text>
                        {filters.mealType === meal.value && (
                          <View style={[styles.checkBadge, { backgroundColor: meal.color }]}>
                            <Check size={12} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Langue - NOUVEAU */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupTitle}>Langue / Language</Text>
                  <View style={styles.languageRow}>
                    {languages.map((lang) => (
                      <TouchableOpacity
                        key={lang.value}
                        style={[
                          styles.languageChip,
                          filters.language === lang.value && styles.languageChipSelected,
                        ]}
                        onPress={() => setFilters({ ...filters, language: lang.value })}
                      >
                        <Text style={styles.languageFlag}>{lang.flag}</Text>
                        <Text style={[
                          styles.languageText,
                          filters.language === lang.value && styles.languageTextSelected
                        ]}>
                          {lang.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Préférences diététiques */}
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

                {/* Difficulté */}
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
                          setFilters({ ...filters, difficulty: option as any })
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

        {/* Modal Détail Recette */}
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
                  {selectedRecipe.image_url && (
                    <View style={styles.imageContainer}>
                      <Image 
                        source={{ uri: selectedRecipe.image_url }} 
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.imageCaption}>Voici à quoi votre plat devrait ressembler</Text>
                    </View>
                  )}

                  <Text style={styles.modalDescription}>
                    {selectedRecipe.description}
                  </Text>

                  {selectedRecipe.suggestion && (
                    <View style={styles.suggestionBox}>
                      <Lightbulb size={16} color="#b45309" />
                      <Text style={styles.suggestionText}>{selectedRecipe.suggestion}</Text>
                    </View>
                  )}

                  <View style={styles.modalMeta}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Prep</Text>
                      <Text style={styles.metaValue}>{selectedRecipe.prep_time} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Cook</Text>
                      <Text style={styles.metaValue}>{selectedRecipe.cook_time} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Total</Text>
                      <Text style={styles.metaValue}>{selectedRecipe.total_time} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Servings</Text>
                      <Text style={styles.metaValue}>{selectedRecipe.servings}</Text>
                    </View>
                  </View>

                  {/* Ingrédients utilisés de la liste */}
                  {selectedRecipe.ingredients_from_list && selectedRecipe.ingredients_from_list.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingrédients de votre liste utilisés</Text>
                      <View style={styles.tagContainer}>
                        {selectedRecipe.ingredients_from_list.map((ing, index) => (
                          <View key={index} style={styles.ingredientTag}>
                            <Text style={styles.ingredientTagText}>✓ {ing}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Ingrédients manquants suggérés */}
                  {selectedRecipe.missing_ingredients && selectedRecipe.missing_ingredients.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingrédients suggérés (non dans votre liste)</Text>
                      <View style={styles.tagContainer}>
                        {selectedRecipe.missing_ingredients.map((ing, index) => (
                          <View key={index} style={styles.missingIngredientTag}>
                            <Text style={styles.missingIngredientText}>+ {ing}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Tous les ingrédients avec quantités */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Ingrédients complets</Text>
                    {selectedRecipe.ingredients_used.map((ing, index) => (
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

                  {/* Conseils */}
                  {selectedRecipe.tips.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Astuces du chef</Text>
                      {selectedRecipe.tips.map((tip, index) => (
                        <View key={index} style={styles.tipItem}>
                          <Text style={styles.tipText}>💡 {tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}
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

// Styles complétés avec les nouveaux éléments
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ingredientChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  filterBadge: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  recipesSection: {
    marginBottom: 24,
  },
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
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
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
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  generateButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    maxHeight: '90%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
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
  // Nouveaux styles pour les types de repas
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealTypeCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 8,
  },
  mealTypeCardSelected: {
    backgroundColor: '#fff',
    borderWidth: 3,
  },
  mealTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  mealTypeLabelSelected: {
    color: '#111827',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Nouveaux styles pour les langues
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  languageChipSelected: {
    backgroundColor: '#10b981',
  },
  languageFlag: {
    fontSize: 20,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  languageTextSelected: {
    color: '#fff',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  optionChipSelected: {
    backgroundColor: '#10b981',
  },
  optionChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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