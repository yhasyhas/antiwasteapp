import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Camera, Leaf, ShoppingCart, Sparkles } from 'lucide-react-native';
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
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { recipeFromRow, type Recipe } from '@/components/recipe/types';
import { RecipeSheet } from '@/components/recipe/RecipeSheet';
import { RecipeListCard } from '@/components/recipe/RecipeListCard';
import { WasteCounter } from '@/components/home/WasteCounter';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { EmptyState } from '@/components/ui/Illustrations';
import { Skeleton } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { colors, sizes, spacing, typography } from '@/constants/theme';

type RecentRecipe = Recipe & { id: string };

// Nombre d'aliments « à utiliser vite » affichés sur l'accueil
const URGENT_COUNT = 3;

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  // null : pas encore chargé (squelettes)
  const [ingredients, setIngredients] = useState<PantryIngredient[] | null>(null);
  const [lastRecipe, setLastRecipe] = useState<RecentRecipe | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState<RecentRecipe | null>(null);
  // Images lues dans l'état partagé : une image générée sur un autre écran apparaît ici aussi
  const images = useRecipeImages();

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

    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data) setLastRecipe(data.length > 0 ? recipeFromRow(data[0]) : null);
    setFavoriteIds(await loadFavoriteIds(user.id));
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

  // Les plus urgents (triés par date) ; la génération les présélectionne
  const urgent = (ingredients ?? []).filter((ingredient) => ingredient.expires_at).slice(0, URGENT_COUNT);
  const cookUrgent = () => {
    if (urgent.length > 0) router.push({ pathname: '/recipe/generate', params: { priority: urgent.map((i) => i.id).join(',') } });
    else router.push('/recipe/generate');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, safe.top(spacing.xxxl)]} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.hello}>{t('home.hello')}</Text>
          <Text style={styles.headline}>{t('home.headline')}</Text>
        </View>

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
              action={<Button label={t('home.scanFood')} icon={Camera} onPress={() => router.push('/(tabs)/camera')} />}
            />
          </Card>
        ) : (
          <>
            <Card style={styles.urgentCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t('home.useSoon')}</Text>
                <Touchable onPress={() => router.push('/(tabs)/ingredients')} style={styles.link} accessibilityRole="link">
                  <Text style={styles.linkText}>{t('home.seeAll')}</Text>
                </Touchable>
              </View>
              {urgent.length === 0 ? (
                <Text style={styles.nothing}>{t('home.nothingUrgent')}</Text>
              ) : (
                urgent.map((ingredient) => (
                  <View key={ingredient.id}>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                      <IconChip icon={Leaf} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{ingredient.name}</Text>
                        {ingredient.quantity ? <Text style={styles.rowSubtitle} numberOfLines={1}>{ingredient.quantity}</Text> : null}
                      </View>
                      <View style={styles.badges}>
                        {ingredient.kind === 'dish' ? <Badge label={t('pantry.leftover')} tone="leftover" /> : null}
                        <ExpiryBadge expiresAt={ingredient.expires_at} />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Button
              label={urgent.length > 0 ? t('home.cookThese') : t('home.generateRecipes')}
              icon={Sparkles}
              onPress={cookUrgent}
            />
          </>
        )}

        <View style={styles.shortcuts}>
          <Card onPress={() => router.push('/(tabs)/camera')} style={styles.shortcut} accessibilityLabel={t('home.scanFood')}>
            <IconChip icon={Camera} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('home.scanFood')}</Text>
              <Text style={styles.rowSubtitle}>{t('home.scanSubtitle')}</Text>
            </View>
          </Card>
          <Card onPress={() => router.push('/shopping')} style={styles.shortcut} accessibilityLabel={t('shopping.title')}>
            <IconChip icon={ShoppingCart} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t('shopping.short')}</Text>
              <Text style={styles.rowSubtitle}>{t('shopping.toBuyCount', { count: toBuy })}</Text>
            </View>
          </Card>
        </View>

        {lastRecipe ? (
          <RecipeListCard
            variant="compact"
            recipe={images.withImage(lastRecipe)}
            imageLoading={images.isLoading(lastRecipe.id)}
            onPress={() => openRecipe(lastRecipe)}
          />
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
  nothing: {
    ...typography.secondary,
    paddingBottom: spacing.md,
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
