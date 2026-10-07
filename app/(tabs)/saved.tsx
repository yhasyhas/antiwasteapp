import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LayoutList, Rows3, Search, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSavedRecipes } from '@/hooks/useSavedRecipes';
import { feasibility, toSaveCount, usePantryUrgency } from '@/hooks/usePantryUrgency';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { mealTypes } from '@/components/recipe/options';
import { cuisineKey, cuisineLabel } from '@/lib/cuisines';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Illustrations';
import { TextField } from '@/components/ui/Input';
import { ListItemMotion } from '@/components/ui/ListItemMotion';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRecipeCard } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { showDialog } from '@/lib/dialog';
import { filterRecipes, NO_FILTERS, optionsOf, periodSections, type SavedFilters, type SavedTab } from '@/lib/savedRecipes';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

// Régimes vérifiés par le serveur (étiquettes « diet:… ») et leurs libellés
const DIETS = [
  { value: 'vegetarian', labelKey: 'diet.vegetarian' },
  { value: 'vegan', labelKey: 'diet.vegan' },
  { value: 'gluten-free', labelKey: 'diet.glutenFree' },
  { value: 'dairy-free', labelKey: 'diet.dairyFree' },
] as const;

// « Mes recettes » : Favoris · Pour plus tard · Toutes, recherche par titre et par ingrédient, filtres rapides
// (faisable maintenant, aliments urgents, moins de 30 min, cuisine, régime, repas), cartes ou liste compacte,
// sections par période
export default function SavedScreen() {
  const { recipes, loading, selectedRecipe, setSelectedRecipe, isImageLoading, imageNotice, openRecipe, toggleFavorite, toggleLater } = useSavedRecipes();
  const { t } = useLanguage();
  const pantry = usePantryUrgency();
  // Onglet demandé par l'accueil (« Tout voir ») : Favoris s'il y en a au moins un, sinon Toutes
  // (« at » : chaque toucher est une nouvelle demande, même après un changement d'onglet à la main)
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const requestedTab = params.tab === 'favorites' || params.tab === 'later' || params.tab === 'all' ? params.tab : null;
  const [tab, setTab] = useState<SavedTab>(requestedTab ?? 'favorites');
  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
  }, [requestedTab, params.at]);
  const [filters, setFilters] = useState<SavedFilters>(NO_FILTERS);
  const [compact, setCompact] = useState(false);
  const update = (change: Partial<SavedFilters>) => setFilters((current) => ({ ...current, ...change }));

  const context = useMemo(() => ({
    feasibility: (recipe: Parameters<typeof feasibility>[0]) => feasibility(recipe, pantry),
    toSave: (recipe: Parameters<typeof toSaveCount>[0]) => toSaveCount(recipe, pantry),
  }), [pantry]);
  const visible = filterRecipes(recipes, tab, filters, context);
  // « Faisable maintenant » : une seule liste, triée ; sinon des sections par période
  const sections = filters.feasible ? [{ period: null, items: visible }] : periodSections(visible, tab);
  const counts = {
    favorites: recipes.filter((recipe) => recipe.is_favorite).length,
    later: recipes.filter((recipe) => recipe.later_at).length,
    all: recipes.length,
  };
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  // Choix d'une valeur (cuisine, régime, repas) : seulement celles présentes dans les recettes
  const pick = (title: string, options: { value: string; label: string }[], current: string | null, onPick: (value: string | null) => void) => {
    showDialog(title, undefined, [
      { text: t('saved.filterAny'), onPress: () => onPick(null) },
      ...options.map((option) => ({ text: option.value === current ? `✓ ${option.label}` : option.label, onPress: () => onPick(option.value) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };
  // Anciennes valeurs (« african ») ramenées au découpage actuel
  const cuisines = optionsOf(recipes, (recipe) => (recipe.cuisine && cuisineKey(recipe.cuisine) !== 'any' ? [cuisineKey(recipe.cuisine)] : []));
  const diets = DIETS.filter((diet) => recipes.some((recipe) => recipe.dietary_tags.includes(`diet:${diet.value}`)));
  const meals = optionsOf(recipes, (recipe) => (recipe.meal_type ? [recipe.meal_type] : []));
  const cuisineName = (value: string) => cuisineLabel(t, value);
  const mealLabel = (value: string) => {
    const option = mealTypes.find((item) => item.value === value);
    return option ? t(option.labelKey) : value;
  };
  const dietLabel = (value: string) => {
    const option = DIETS.find((item) => item.value === value);
    return option ? t(option.labelKey) : value;
  };
  const periodTitle = { week: t('saved.periodWeek'), month: t('saved.periodMonth'), older: t('saved.periodOlder') };

  const renderCard = (recipe: (typeof visible)[number], index: number) => (
    <ListItemMotion key={recipe.id} index={index}>
      <RecipeListCard
        recipe={recipe}
        variant={compact ? 'compact' : 'large'}
        imageLoading={isImageLoading(recipe.id)}
        onPress={() => openRecipe(recipe)}
        favorite={{ active: recipe.is_favorite, onToggle: () => toggleFavorite(recipe.id) }}
        later={{ active: !!recipe.later_at, onToggle: () => toggleLater(recipe.id) }}
        availability={context.feasibility(recipe)}
        showCooked
      />
    </ListItemMotion>
  );

  const emptyTab = tab === 'favorites'
    ? <EmptyState kind="recipes" title={t('saved.emptyFavoritesTitle')} text={t('saved.emptyFavoritesText')} />
    : tab === 'later'
      ? <EmptyState kind="recipes" title={t('saved.emptyLaterTitle')} text={t('saved.emptyLaterText')} />
      : <EmptyState kind="recipes" title={t('saved.emptyTitle')} text={t('saved.emptyText')} />;

  return (
    <View style={styles.container}>
      <ScreenHeader back title={t('saved.title')} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonRecipeCard />
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState kind="recipes" title={t('saved.emptyTitle')} text={t('saved.emptyText')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Onglets */}
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['favorites', 'later', 'all'] as const).map((key) => (
              <Touchable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {t(key === 'favorites' ? 'saved.tabFavorites' : key === 'later' ? 'saved.tabLater' : 'saved.tabAll')} · {counts[key]}
                </Text>
              </Touchable>
            ))}
          </View>

          <View style={styles.searchRow}>
            <TextField
              icon={Search}
              placeholder={t('saved.searchPlaceholder')}
              value={filters.query}
              onChangeText={(query) => update({ query })}
              returnKeyType="search"
              containerStyle={styles.search}
            />
            <Touchable
              onPress={() => setCompact((value) => !value)}
              style={styles.viewToggle}
              accessibilityRole="button"
              accessibilityLabel={compact ? t('saved.viewCards') : t('saved.viewCompact')}
            >
              {compact ? <Rows3 size={sizes.icon} color={colors.text} /> : <LayoutList size={sizes.icon} color={colors.text} />}
            </Touchable>
          </View>

          {/* Filtres rapides */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
            <Chip label={t('saved.filterFeasible')} selected={filters.feasible} onPress={() => update({ feasible: !filters.feasible })} />
            <Chip label={t('saved.filterUrgent')} selected={filters.urgent} onPress={() => update({ urgent: !filters.urgent })} />
            <Chip label={t('saved.filterQuick')} selected={filters.quick} onPress={() => update({ quick: !filters.quick })} />
            {cuisines.length > 0 ? (
              <Chip
                label={filters.cuisine ? cuisineName(filters.cuisine) : t('saved.filterCuisine')}
                selected={!!filters.cuisine}
                onPress={() => pick(t('saved.filterCuisine'), cuisines.map((value) => ({ value, label: cuisineName(value) })), filters.cuisine, (cuisine) => update({ cuisine }))}
              />
            ) : null}
            {diets.length > 0 ? (
              <Chip
                label={filters.diet ? dietLabel(filters.diet) : t('saved.filterDiet')}
                selected={!!filters.diet}
                onPress={() => pick(t('saved.filterDiet'), diets.map((diet) => ({ value: diet.value, label: t(diet.labelKey) })), filters.diet, (diet) => update({ diet }))}
              />
            ) : null}
            {meals.length > 1 ? (
              <Chip
                label={filters.meal ? mealLabel(filters.meal) : t('saved.filterMeal')}
                selected={!!filters.meal}
                onPress={() => pick(t('saved.filterMeal'), meals.map((value) => ({ value, label: mealLabel(value) })), filters.meal, (meal) => update({ meal }))}
              />
            ) : null}
            {filtered ? <Chip label={t('saved.clearFilters')} icon={X} onPress={() => setFilters(NO_FILTERS)} /> : null}
          </ScrollView>

          {counts[tab] === 0 ? (
            emptyTab
          ) : visible.length === 0 ? (
            <Text style={styles.noResults}>{t('saved.noResults')}</Text>
          ) : (
            sections.map((section) => (
              <View key={section.period ?? 'feasible'} style={[styles.section, compact && styles.sectionCompact]}>
                <Text style={styles.sectionTitle}>{section.period ? periodTitle[section.period] : t('saved.feasibleTitle')}</Text>
                {section.items.map(renderCard)}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {selectedRecipe && (
        <RecipeSheet
          recipe={selectedRecipe}
          imageLoading={isImageLoading(selectedRecipe.id)}
          imageNotice={imageNotice(selectedRecipe.id)}
          isFavorite={selectedRecipe.is_favorite}
          onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: sizes.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.button,
    color: colors.text,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  search: {
    flex: 1,
  },
  viewToggle: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
  },
  filters: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  sectionCompact: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  noResults: {
    ...typography.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
