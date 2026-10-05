import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Camera, ChefHat, ShoppingCart, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { loadFavoriteIds, setFavorite } from '@/lib/favorites';
import { activeHouseholdId } from '@/lib/household';
import { onPantryChanged } from '@/lib/pantryEvents';
import { loadShoppingList, onShoppingChanged } from '@/lib/shopping';
import { sortByUrgency } from '@/lib/expiry';
import { isUrgentLot } from '@/lib/storage';
import { groupLots, lotLabel } from '@/lib/pantryLots';
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { useFoodNames } from '@/lib/foodNames';
import { displayQuantity } from '@/lib/quantity';
import { recipeFromRow, type Recipe } from '@/components/recipe/types';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { feasibility, usePantryUrgency } from '@/hooks/usePantryUrgency';
import { MAX_MISSING } from '@/lib/savedRecipes';
import { WasteCounter } from '@/components/home/WasteCounter';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { FoodIcon } from '@/components/pantry/FoodIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { EmptyState } from '@/components/ui/Illustrations';
import { Skeleton } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { CookingBanner } from '@/components/cook/CookingBanner';
import { colors, sizes, spacing, typography } from '@/constants/theme';

type RecentRecipe = Recipe & { id: string };

// Nombre d'aliments « à utiliser vite » affichés sur l'accueil
const URGENT_COUNT = 3;
// « Mes recettes » : favoris d'abord (faisables maintenant en tête), puis les plus récentes
const MY_RECIPES_COUNT = 3;
// Dernières recettes lues pour la section ; les favoris sont lus en plus, quel que soit leur âge
const RECIPES_LOADED = 30;

export default function HomeScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  // null : pas encore chargé (squelettes)
  const [ingredients, setIngredients] = useState<PantryIngredient[] | null>(null);
  const [recipes, setRecipes] = useState<RecentRecipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<RecentRecipe | null>(null);
  // Images lues dans l'état partagé : une image générée sur un autre écran apparaît ici aussi
  const images = useRecipeImages();
  const pantry = usePantryUrgency();
  const foodName = useFoodNames(ingredients);

  // Rechargé à chaque retour sur l'onglet : ingrédients scannés, recettes générées entre-temps
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
      loadRecipes();
    }, [user])
  );

  // Garde-manger du foyer actif ; rechargé quand un membre le modifie (temps réel)
  useEffect(() => onPantryChanged(loadIngredients), [user]);

  // Articles à acheter (carte « Courses »)
  const [toBuy, setToBuy] = useState(0);
  const loadToBuy = useCallback(() => {
    loadShoppingList().then((items) => items && setToBuy(items.filter((item) => !item.checked).length));
  }, []);
  useFocusEffect(loadToBuy);
  useEffect(() => onShoppingChanged(loadToBuy), [loadToBuy]);

  const loadIngredients = async () => {
    if (!user) return;
    const householdId = await activeHouseholdId();
    if (!householdId) return;

    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (data) setIngredients(sortByUrgency(data as PantryIngredient[]));
  };

  const loadRecipes = async () => {
    if (!user) return;

    const favorites = await loadFavoriteIds(user.id);
    const [recent, favored] = await Promise.all([
      supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(RECIPES_LOADED),
      favorites.size > 0
        ? supabase.from('recipes').select('*').in('id', [...favorites])
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    if (recent.data) {
      const rows = [...recent.data, ...(favored.data ?? [])];
      const unique = rows.filter((row: any, i) => rows.findIndex((other: any) => other.id === row.id) === i);
      setRecipes(unique.map((row) => recipeFromRow(row) as RecentRecipe));
    }
    setFavoriteIds(favorites);
  };

  const openRecipe = (recipe: RecentRecipe) => {
    setSelectedRecipe(recipe);
    images.request(recipe);
  };

  const toggleFavorite = async (recipe: RecentRecipe) => {
    if (!user) return;
    const favorite = !favoriteIds.has(recipe.id);
    const error = await setFavorite(user.id, recipe.id, favorite);
    if (error) {
      alertWriteError(t, 'toggling favorite', error);
      return;
    }
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(recipe.id);
      else next.delete(recipe.id);
      return next;
    });
  };

  // Les plus urgents (périmés ou bientôt, triés par date), un par aliment : son lot le plus ancien ;
  // « Cuisiner ces aliments » les présélectionne
  const urgent = groupLots(ingredients ?? [])
    .map((group) => ({ group, lot: group.lots.find(isUrgentLot) }))
    .filter((entry) => entry.lot)
    .map(({ group, lot }) => ({ ...lot!, quantity: lotLabel(lot!, group.lots, language) }))
    .slice(0, URGENT_COUNT);
  // Mes recettes : les favoris d'abord, ceux faisables maintenant (au plus un ingrédient manquant) en tête ;
  // puis les autres recettes, faisables d'abord ; à égalité, les plus récentes
  const missing = (recipe: RecentRecipe) => {
    const { available, total } = feasibility(recipe, pantry);
    return total - available;
  };
  const rank = (recipe: RecentRecipe) => (favoriteIds.has(recipe.id) ? 0 : 2) + (missing(recipe) <= MAX_MISSING ? 0 : 1);
  const myRecipes = [...recipes]
    .sort((a, b) => rank(a) - rank(b) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, MY_RECIPES_COUNT);
  const cookUrgent = () => router.push({ pathname: '/recipe/generate', params: { priority: urgent.map((i) => i.id).join(',') } });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, safe.top(spacing.xxxl)]} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.hello}>{t('home.hello')}</Text>
          <Text style={styles.headline}>{t('home.headline')}</Text>
        </View>

        {/* Séance du mode cuisine en cours : reprise à la même étape */}
        <CookingBanner />

        <WasteCounter />

        {ingredients === null ? (
          <Card style={styles.urgentCard}>
            {[0, 1, 2].map((row) => (
              <View key={row} style={styles.skeletonRow}>
                <Skeleton width={sizes.iconChip} height={sizes.iconChip} rounded={sizes.iconChip / 3} />
                <View style={styles.rowText}>
                  <Skeleton width="55%" height={typography.listTitle.fontSize!} />
                  <Skeleton width="30%" height={typography.secondary.fontSize!} />
                </View>
              </View>
            ))}
          </Card>
        ) : ingredients.length === 0 ? (
          <Card>
            <EmptyState
              kind="pantry"
              title={t('home.emptyPantryTitle')}
              text={t('home.emptyPantryText')}
              action={<Button label={t('home.scanFood')} icon={Camera} onPress={() => router.navigate('/(tabs)/camera')} />}
            />
          </Card>
        ) : (
          <>
            {/* Sans aliment urgent, pas de carte */}
            {urgent.length > 0 ? (
              <Card style={styles.urgentCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('home.useSoon')}</Text>
                  <Touchable onPress={() => router.navigate('/(tabs)/ingredients')} style={styles.link} accessibilityRole="link">
                    <Text style={styles.linkText}>{t('home.seeAll')}</Text>
                  </Touchable>
                </View>
                {urgent.map((ingredient) => (
                  <View key={ingredient.id}>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                      <FoodIcon category={ingredient.category} kind={ingredient.kind} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{foodName(ingredient)}</Text>
                        {ingredient.quantity ? <Text style={styles.rowSubtitle} numberOfLines={1}>{displayQuantity(ingredient.quantity, language)}</Text> : null}
                      </View>
                      <View style={styles.badges}>
                        {ingredient.kind === 'dish' ? <Badge label={t('pantry.leftover')} tone="leftover" /> : null}
                        <ExpiryBadge expiresAt={ingredient.expires_at} dateKind={ingredient.date_kind} location={ingredient.location} />
                      </View>
                    </View>
                  </View>
                ))}
                <Button
                  label={t('home.cookTheseCount', { count: urgent.length })}
                  icon={Sparkles}
                  variant="soft"
                  size="medium"
                  onPress={cookUrgent}
                  style={styles.cookUrgent}
                />
              </Card>
            ) : null}

            {/* Génération avec tout le garde-manger */}
            <Button label={t('home.findRecipe')} icon={ChefHat} onPress={() => router.push('/recipe/generate')} />
          </>
        )}

        <View style={styles.shortcuts}>
          <Card onPress={() => router.navigate('/(tabs)/camera')} style={styles.shortcut} accessibilityLabel={t('home.scanFood')}>
            <IconChip icon={Camera} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('home.scanFood')}</Text>
              <Text style={styles.rowSubtitle}>{t('home.scanSubtitle')}</Text>
            </View>
          </Card>
          <Card onPress={() => router.navigate('/shopping')} style={styles.shortcut} accessibilityLabel={t('shopping.title')}>
            <IconChip icon={ShoppingCart} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('shopping.short')}</Text>
              <Text style={styles.rowSubtitle}>{t('shopping.toBuyCount', { count: toBuy })}</Text>
            </View>
          </Card>
        </View>

        {myRecipes.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('saved.title')}</Text>
              <Touchable
                onPress={() => router.navigate({ pathname: '/saved', params: { tab: favoriteIds.size > 0 ? 'favorites' : 'all', at: String(Date.now()) } })}
                style={styles.link}
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>{t('home.seeAll')}</Text>
              </Touchable>
            </View>
            {myRecipes.map((recipe) => (
              <RecipeListCard
                key={recipe.id}
                variant="compact"
                recipe={images.withImage(recipe)}
                imageLoading={images.isLoading(recipe.id)}
                onPress={() => openRecipe(recipe)}
                favorite={{ active: favoriteIds.has(recipe.id), onToggle: () => toggleFavorite(recipe) }}
                availability={feasibility(recipe, pantry)}
                showCooked
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {selectedRecipe && (
        <RecipeSheet
          recipe={images.withImage(selectedRecipe)}
          imageLoading={images.isLoading(selectedRecipe.id)}
          imageNotice={images.notice(selectedRecipe.id)}
          isFavorite={favoriteIds.has(selectedRecipe.id)}
          onToggleFavorite={() => toggleFavorite(selectedRecipe)}
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
  heading: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hello: {
    ...typography.body,
    color: colors.textSecondary,
  },
  headline: {
    ...typography.title1,
  },
  urgentCard: {
    paddingVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touch,
  },
  cardTitle: {
    ...typography.cardTitle,
    fontSize: typography.title3.fontSize! - spacing.xs,
  },
  link: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  divider: {
    height: sizes.borderWidth,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.cardTitle,
  },
  rowSubtitle: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cookUrgent: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});
