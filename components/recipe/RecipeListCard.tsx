import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bookmark, Check, Clock, Heart, ShoppingCart, Sparkles } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { type Feasibility, toSaveCount, usePantryUrgency } from '@/hooks/usePantryUrgency';
import { MAX_MISSING } from '@/lib/savedRecipes';
import { recipeAmount } from '@/lib/quantity';
import { addMissingToShoppingList } from '@/lib/shopping';
import { showDialog } from '@/lib/dialog';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { RecipePlaceholder } from '@/components/ui/Illustrations';
import { Touchable } from '@/components/ui/Touchable';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';
import type { Recipe } from './types';
import { localDateOf, shortDate } from '@/lib/expiry';

interface Props {
  recipe: Recipe;
  // Image en cours de génération : l'illustration « Photo du plat » reste affichée jusqu'à son arrivée
  imageLoading?: boolean;
  onPress: () => void;
  // Cœur de favori sur la carte
  favorite?: { active: boolean; onToggle: () => void };
  // large : image en haut (génération, favoris) ; compact : vignette à gauche (« Mes recettes » de l'accueil)
  variant?: 'large' | 'compact';
  // « Cuisinée le [date] » (Mes recettes)
  showCooked?: boolean;
  // Signet « Pour plus tard », indépendant du cœur (Mes recettes)
  later?: { active: boolean; onToggle: () => void };
  // « X/Y ingrédients disponibles » d'après le garde-manger actuel (hors sel, poivre, huile, eau) ; s'il en
  // manque peu (MAX_MISSING), « Il manque : oignon » avec un bouton pour l'ajouter aux courses
  availability?: Feasibility;
}

// « Il manque : oignon » et « Ajouter aux courses » (avec la quantité de la recette, sans doublon dans la liste)
function MissingRow({ recipe, missing }: { recipe: Recipe; missing: Feasibility['missing'] }) {
  const { t, language } = useLanguage();
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const add = async () => {
    setState('adding');
    try {
      await addMissingToShoppingList(missing.map((item) => item.name), missing.map((item) => recipeAmount(item.quantity, item.unit, language)), recipe.id, recipe.title);
      setState('added');
    } catch (error) {
      console.warn('[courses] ajout impossible :', error);
      setState('idle');
      showDialog(t('errors.writeTitle'), t('errors.writeText'));
    }
  };
  const added = state === 'added';
  return (
    <View style={styles.missing}>
      <Text style={styles.missingText} numberOfLines={2}>{t('saved.missing', { names: missing.map((item) => item.name).join(', ') })}</Text>
      <Touchable
        onPress={add}
        disabled={state !== 'idle'}
        style={styles.missingButton}
        accessibilityRole="button"
        accessibilityState={{ disabled: state !== 'idle' }}
        accessibilityLabel={added ? t('saved.missingAdded') : t('saved.addMissing')}
      >
        {added ? <Check size={sizes.iconSmall} color={colors.primary} /> : <ShoppingCart size={sizes.iconSmall} color={colors.primary} />}
        <Text style={styles.missingButtonText}>{added ? t('saved.missingAdded') : t('saved.addMissing')}</Text>
      </Touchable>
    </View>
  );
}

// Carte de recette unique pour toutes les listes. Elle affiche l'image si elle existe, sans jamais la
// demander elle-même (voir useRecipeImages) ; sinon une illustration. Badge « X à sauver » : aliments du
// garde-manger utilisés qui expirent bientôt.
export function RecipeListCard({ recipe, onPress, favorite, variant = 'large', showCooked = false, later, availability }: Props) {
  const { t, language } = useLanguage();
  const cooked = showCooked && recipe.last_cooked_at
    ? <Text style={styles.cooked}>{t('cookedMore.cookedOn', { date: shortDate(localDateOf(recipe.last_cooked_at), language) })}</Text>
    : null;
  const pantry = usePantryUrgency();
  const toSave = toSaveCount(recipe, pantry);
  const compact = variant === 'compact';

  const image = recipe.image_url ? (
    // Cache sur disque : l'image n'est pas retéléchargée à chaque visite
    <Image
      source={{ uri: recipe.image_url }}
      style={styles.fill}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={recipe.id}
      transition={motion.normal}
    />
  ) : (
    // Pas encore d'image (ou image en cours de génération) : illustration « Photo du plat »
    <RecipePlaceholder style={styles.fill} compact={compact} label={compact ? t('recipe.photoShort') : t('recipe.photoPlaceholder')} />
  );

  const meta = (
    <View style={styles.meta}>
      <View style={styles.time}>
        <Clock size={sizes.iconSmall} color={colors.textSecondary} />
        <Text style={styles.timeText}>{t('common.minutes', { count: recipe.total_time })}</Text>
      </View>
      {recipe.difficulty ? <Badge label={difficultyLabel(t, recipe.difficulty)} tone="soft" /> : null}
      {toSave > 0 ? <Badge label={t('recipe.toSave', { count: toSave })} tone="expired" /> : null}
      {availability && availability.total > 0 ? (
        <Badge label={t('saved.available', { available: availability.available, total: availability.total })} tone={availability.available === availability.total ? 'ok' : 'neutral'} />
      ) : null}
    </View>
  );

  const heart = favorite ? (
    <Touchable
      onPress={favorite.onToggle}
      style={styles.heart}
      accessibilityRole="button"
      accessibilityState={{ selected: favorite.active }}
      accessibilityLabel={favorite.active ? t('saved.removeFavorite') : t('recipe.saveToFavorites')}
    >
      <Heart size={sizes.iconLarge} color={favorite.active ? colors.expired.text : colors.text} fill={favorite.active ? colors.expired.text : colors.transparent} />
    </Touchable>
  ) : null;

  const bookmark = later ? (
    <Touchable
      onPress={later.onToggle}
      style={styles.heart}
      accessibilityRole="button"
      accessibilityState={{ selected: later.active }}
      accessibilityLabel={later.active ? t('saved.removeLater') : t('saved.saveForLater')}
    >
      <Bookmark size={sizes.iconLarge} color={later.active ? colors.primary : colors.text} fill={later.active ? colors.primary : colors.transparent} />
    </Touchable>
  ) : null;
  const actions = bookmark || heart ? <View style={styles.actions}>{bookmark}{heart}</View> : null;
  const missingRow = availability && availability.missing.length > 0 && availability.missing.length <= MAX_MISSING && availability.available > 0
    ? <MissingRow recipe={recipe} missing={availability.missing} />
    : null;

  if (compact) {
    return (
      <Card onPress={onPress} style={styles.compactCard} accessibilityLabel={recipe.title}>
        <View style={styles.thumbnail}>{image}</View>
        <View style={styles.compactBody}>
          <Text style={styles.compactTitle} numberOfLines={2}>{recipe.title}</Text>
          {meta}
          {missingRow}
          {cooked}
        </View>
        {actions}
      </Card>
    );
  }

  return (
    <Card onPress={onPress} style={styles.card} accessibilityLabel={recipe.title}>
      <View style={styles.imageArea}>{image}</View>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={3}>{recipe.title}</Text>
          {actions}
        </View>
        {recipe.description ? <Text style={styles.description} numberOfLines={3}>{recipe.description}</Text> : null}
        {recipe.suggestion ? (
          <View style={styles.suggestion}>
            <Sparkles size={sizes.iconSmall} color={colors.onAccent} />
            <Text style={styles.suggestionText} numberOfLines={2}>{recipe.suggestion}</Text>
          </View>
        ) : null}
        {meta}
        {missingRow}
        {cooked}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  imageArea: {
    height: sizes.recipeImage,
    backgroundColor: colors.illustration.background,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    ...typography.title3,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  heart: {
    width: sizes.touch,
    height: sizes.touch,
    marginTop: -spacing.sm,
    marginRight: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.iconChip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    ...typography.body,
    flex: 1,
    fontSize: typography.listTitle.fontSize,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  time: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.xs,
  },
  cooked: {
    ...typography.secondary,
  },
  missing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missingText: {
    ...typography.secondary,
    color: colors.text,
    flexShrink: 1,
  },
  missingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.sm,
  },
  missingButtonText: {
    ...typography.secondary,
    color: colors.primary,
    fontWeight: '600',
  },
  timeText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.md,
  },
  thumbnail: {
    width: sizes.thumbnail,
    height: sizes.thumbnail,
    borderRadius: radius.iconChip + spacing.xs,
    overflow: 'hidden',
    backgroundColor: colors.illustration.background,
  },
  compactBody: {
    flex: 1,
    gap: spacing.sm,
  },
  compactTitle: {
    ...typography.cardTitle,
  },
});
