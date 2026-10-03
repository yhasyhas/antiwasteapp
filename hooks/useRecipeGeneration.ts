import { useState, useEffect } from 'react';

import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction } from '@/lib/callEdgeFunction';
import { loadFavoriteIds, setFavorite } from '@/lib/favorites';
import { failureReasonOf, failureTitle } from '@/lib/quotaReason';
import { supabase } from '@/lib/supabase';
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { daysUntil, sortByUrgency } from '@/lib/expiry';
import { daysLeftForRecipes } from '@/lib/storage';
import { onPantryChanged } from '@/lib/pantryEvents';
import { activeHouseholdId } from '@/lib/household';
import { loadPreferences } from '@/lib/preferences';
import { groupLots, totalLabel } from '@/lib/pantryLots';
import { useFoodNaming } from '@/lib/foodNames';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import type { Filters, Recipe } from '@/components/recipe/types';
import { showDialog } from '@/lib/dialog';

// standard : toutes les recettes ; leftovers : « Transformer mes restes » (plats cuisinés du garde-manger)
export type GenerationMode = 'standard' | 'leftovers';

// Délai maximum d'une génération côté app (le serveur sert ses recettes en 45 s au plus)
const GENERATION_TIMEOUT_MS = 75_000;

// État et actions de l'écran de génération : garde-manger, filtres, génération, historique, favoris, images.
// Sélection : si l'utilisateur choisit des ingrédients (ou en reçoit d'une notification), seuls ceux-là sont
// envoyés au modèle ; sans sélection, tout le garde-manger, avec la priorité aux dates les plus proches.
export function useRecipeGeneration(initialSelectedIds: string[] = []) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [ingredients, setIngredients] = useState<PantryIngredient[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  // Mode de la génération en cours (le bouton correspondant affiche l'attente)
  const [generatingMode, setGeneratingMode] = useState<GenerationMode | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  // Explication affichée sous les résultats quand il y a moins de 3 recettes
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // Limite du jour atteinte (réponse du serveur) : les boutons restent grisés avec la raison affichée
  const [quotaReached, setQuotaReached] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // Images générées en arrière-plan dès l'affichage des recettes : cartes et fiche se remplissent à leur arrivée
  const images = useRecipeImages();
  const [filters, setFilters] = useState<Filters>({
    dietary: [],
    difficulty: 'easy',
    maxCookTime: 60,
    mealType: 'lunch',
    cuisine: 'any',
    // Recettes dans la langue de l'app, sauf préférence enregistrée
    language,
    servings: null,
    excluded: [],
  });

  useEffect(() => {
    loadIngredients();
    loadUserPreferences();
    if (user) loadFavoriteIds(user.id).then(setFavoriteIds);
    // « J'ai cuisiné ça » depuis cet écran : les ingrédients retirés disparaissent de la liste
    return onPantryChanged(loadIngredients);
  }, []);

  // Nouvelle notification touchée alors que l'écran est déjà ouvert
  const initialKey = initialSelectedIds.join(',');
  useEffect(() => {
    if (initialKey) setSelectedIds(initialKey.split(','));
  }, [initialKey]);

  // Un aliment par ligne (ses lots regroupés), représenté par son lot le plus ancien : quantité totale et
  // date la plus proche. Une sélection reçue avec l'identifiant de n'importe quel lot choisit l'aliment.
  const groups = groupLots(ingredients);
  const foods = groups.map((group) => ({ ...group.first, quantity: totalLabel(group.lots, language) }));
  const isSelected = (index: number) => groups[index].lots.some((lot) => selectedIds.includes(lot.id));
  // Nom envoyé au modèle : un produit scanné garde son nom, suivi de son nom générique (« Palmito L'original
  // (Biscuits feuilletés) »)
  const naming = useFoodNaming(ingredients);
  // Nom envoyé au modèle : celui de la fiche dans la langue de la recette (« eggs » pour « œufs » dans une recette en
  // anglais), le nom du produit pour un code-barres (avec son nom générique) ; la recette le garde tel quel
  const modelName = (food: PantryIngredient) => {
    const name = naming.nameIn(food, filters.language);
    const generic = naming.generic(food);
    return generic ? `${name} (${generic})` : name;
  };

  const toggleSelected = (id: string) => {
    const group = groups.find((candidate) => candidate.first.id === id);
    const lotIds = group ? group.lots.map((lot) => lot.id) : [id];
    setSelectedIds((current) => current.some((x) => lotIds.includes(x)) ? current.filter((x) => !lotIds.includes(x)) : [...current, id]);
  };

  // Aliments envoyés au modèle : la sélection, ou tout le garde-manger
  const selected = foods.filter((_, index) => isSelected(index));
  const cookingWith = selected.length > 0 ? selected : foods;

  const loadIngredients = async () => {
    if (!user) return;
    const householdId = await activeHouseholdId();
    if (!householdId) return;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId);

    if (data) {
      setIngredients(sortByUrgency(data as PantryIngredient[]));
    }
    setLoading(false);
  };

  const loadUserPreferences = async () => {
    if (!user) return;

    // Préférences enregistrées (écran « Préférences ») : valeurs par défaut des filtres
    const preferences = await loadPreferences(user.id);
    if (preferences) {
      setFilters((current) => ({
        ...current,
        dietary: preferences.dietary,
        excluded: preferences.excluded,
        maxCookTime: preferences.maxCookTime,
        cuisine: preferences.cuisine,
        servings: preferences.servings,
        difficulty: (preferences.difficulty as Filters['difficulty']) || current.difficulty,
        mealType: (preferences.mealType as Filters['mealType']) || current.mealType,
        language: preferences.language || current.language,
      }));
    }
  };

  const generateRecipes = async (mode: GenerationMode = 'standard') => {
    if (ingredients.length === 0) {
      showDialog(t('generate.noIngredientsTitle'), t('generate.noIngredientsText'));
      return;
    }

    setGenerating(true);
    setGeneratingMode(mode);

    try {
      // Le serveur sert ses recettes en 45 s au plus : au-delà de 75 s, la requête est abandonnée
      const { data } = await callEdgeFunction('generate-recipes', {
        // Avec leur identifiant : le modèle indique quel ingrédient du garde-manger chaque recette utilise.
        // days_left (fuseau du téléphone) et kind : les plus urgents passent en premier.
        ingredients: cookingWith.map((i) => ({
          id: i.id,
          name: modelName(i),
          quantity: i.quantity || '',
          // Hors congélateur seulement ; date indicative dépassée : aucune (l'aliment n'est pas urgent)
          days_left: daysLeftForRecipes(i),
          kind: i.kind,
        })),
        // Avec une sélection : le reste du garde-manger, que les recettes ne doivent pas utiliser
        ...(selected.length > 0 && {
          selection: true,
          other_pantry: foods.filter((_, index) => !isSelected(index)).map(modelName),
        }),
        mode,
        preferences: {
          dietary: filters.dietary,
          difficulty: filters.difficulty,
          maxCookTime: filters.maxCookTime,
          mealType: filters.mealType,
          cuisine: filters.cuisine,
          language: filters.language,
          excluded: filters.excluded,
          ...(filters.servings && { servings: filters.servings }),
        },
      }, GENERATION_TIMEOUT_MS);

      if (data?.recipes) {
        // Enregistrées dans l'historique avant l'affichage, pour que chaque recette ait déjà son id
        // quand l'utilisateur la sauvegarde (sinon elle serait insérée une seconde fois)
        const saved = await saveRecipesToHistory(data.recipes);
        setRecipes(saved);
        // Moins de recettes que d'habitude : recettes écartées par le serveur, ou peu d'aliments
        // Recettes écartées : « tes critères » seulement si des critères ont été choisis (régimes, exclusions,
        // sélection), sinon les contrôles de qualité du serveur
        const criteria = filters.dietary.length > 0 || (filters.excluded?.length ?? 0) > 0 || selected.length > 0;
        setResultNote(data.rejected > 0 ? t(criteria ? 'generate.rejectedNote' : 'generate.rejectedQualityNote', { count: data.rejected })
          : data.fewIngredients ? t('generate.fewIngredientsNote') : null);
        // Nouvelle génération seulement : images demandées en arrière-plan dès l'affichage des résultats,
        // elles apparaissent sur les cartes à leur arrivée (les autres listes n'en demandent jamais)
        images.requestAll(saved);
      } else if (data?.error) {
        // Quota personnel, quota des fournisseurs (secours compris) ou panne
        if (failureReasonOf(data) === 'user_quota') setQuotaReached(true);
        showDialog(failureTitle(t, failureReasonOf(data), t('common.error')), data.message || t('generate.failed'));
      } else {
        showDialog(t('common.error'), t('generate.failed'));
      }
    } catch (error) {
      console.error('Error generating recipes:', error);
      showDialog(t('common.error'), t('generate.failed'));
    } finally {
      setGenerating(false);
      setGeneratingMode(null);
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
    image_prompt: recipe.image_prompt ?? null,
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
      return index === -1 ? recipe : { ...recipe, id: unused.splice(index, 1)[0].id as string, language: filters.language };
    });
  };

  const openRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    // Image pas encore obtenue (échec de l'historique, quota) : nouvel essai
    images.request(recipe);
  };

  // Favori : la recette est déjà dans l'historique ; on l'ajoute aux favoris, ou on l'en retire
  const toggleFavorite = async (recipe: Recipe) => {
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
      const newId = data.id as string;
      recipeId = newId;
      setRecipes((current) => current.map((r) => (r === recipe ? { ...r, id: newId } : r)));
      setSelectedRecipe((current) => (current === recipe ? { ...current, id: newId } : current));
    }

    const id = recipeId;
    const favorite = !favoriteIds.has(id);
    const error = await setFavorite(user.id, id, favorite);
    if (error) {
      alertWriteError(t, 'toggling favorite', error);
      return;
    }
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(id);
      else next.delete(id);
      return next;
    });
    images.request({ id, image_url: recipe.image_url });
    if (!favorite) return;

    showDialog(
      t('generate.savedTitle'),
      t('generate.savedText'),
      [
        {
          text: t('generate.viewSaved'),
          onPress: () => router.navigate('/saved'),
        },
        { text: t('common.ok'), style: 'cancel' },
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

  return {
    // Aliments (lots regroupés) et aliments choisis
    ingredients: foods,
    selectedIds: selected.map((food) => food.id),
    toggleSelected,
    clearSelection: () => setSelectedIds([]),
    hasLeftovers: cookingWith.some((i) => i.kind === 'dish'),
    resultNote,
    // Avec leur image, dès qu'elle est connue (demandée ici ou sur un autre écran)
    recipes: recipes.map(images.withImage),
    loading,
    generating,
    quotaReached,
    generatingMode,
    selectedRecipe: selectedRecipe && images.withImage(selectedRecipe),
    setSelectedRecipe,
    isImageLoading: images.isLoading,
    imageNotice: images.notice,
    isFavorite: (recipe: Recipe) => !!recipe.id && favoriteIds.has(recipe.id),
    filters,
    setFilters,
    generateRecipes,
    openRecipe,
    toggleFavorite,
    toggleDietaryFilter,
  };
}
