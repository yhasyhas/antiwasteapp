import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronLeft, Clock, Flame, Heart, Languages, Sparkles, Users } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { toSaveCount, usePantryUrgency } from '@/hooks/usePantryUrgency';
import { isBasic } from '@/lib/basics';
import { difficultyLabel, verifiedDietLabels } from '@/lib/labels';
import { recipeAmount } from '@/lib/quantity';
import { failureTitle } from '@/lib/quotaReason';
import { cachedTranslation, translateRecipe } from '@/lib/recipeTranslation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { RecipePlaceholder } from '@/components/ui/Illustrations';
import { Toast } from '@/components/ui/Toast';
import { Touchable } from '@/components/ui/Touchable';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';
import { CookedButton } from './CookedButton';
import { AddMissingButton } from './AddMissingButton';
import { CookStartButton } from '@/components/cook/CookStartButton';
import { translatedRecipe, type Recipe, type RecipeText } from './types';
import { showDialog } from '@/lib/dialog';

interface Props {
  recipe: Recipe;
  // Image en cours de génération : squelette dans l'emplacement, puis l'image à son arrivée
  imageLoading: boolean;
  // Image impossible (quota du jour, panne) : message discret sous le titre
  imageNotice?: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

// Fiche recette unique (génération, dernière recette, favoris), en plein écran : image (ou illustration),
// temps, difficulté, personnes, régimes, ingrédients « Du garde-manger » et « À acheter » avec quantités,
// étapes, astuces, suggestion, favori ; « J'ai cuisiné ça » toujours visible en bas. Recette dans une autre
// langue que l'app : « Traduire en … » (traduction gardée en base, générée une seule fois).
export function RecipeSheet({ recipe: original, imageLoading, imageNotice, isFavorite, onToggleFavorite, onClose }: Props) {
  const { t, language } = useLanguage();
  // Étiquettes de régime vérifiées par le serveur seulement (codes, traduits par l’app)
  const dietLabels = verifiedDietLabels(t, original.dietary_tags);
  const safe = useSafeSpacing();

  // Traduction dans la langue de l'app : déjà faite (en base ou pendant la session), ou à la demande
  const canTranslate = !!original.id && !!original.language && original.language !== language;
  const savedTranslation = () => (original.id ? original.translations?.[language] ?? cachedTranslation(original.id, language) ?? null : null);
  const [translation, setTranslation] = useState<RecipeText | null>(savedTranslation);
  const [showOriginal, setShowOriginal] = useState(false);
  // Image dépassée : barre d'en-tête opaque (retour, titre, favori) qui couvre aussi la barre d'état
  const [pastHero, setPastHero] = useState(false);
  const heroLimit = sizes.recipeHero - safe.insets.top - sizes.touch - spacing.xl;
  const [translating, setTranslating] = useState(false);
  useEffect(() => {
    setTranslation(savedTranslation());
    setShowOriginal(false);
  }, [original.id, language]);
  const recipe = canTranslate && translation && !showOriginal ? translatedRecipe(original, translation) : original;
  // Langue du texte affiché (unités des quantités accordées dans cette langue)
  const textLanguage = canTranslate && translation && !showOriginal ? language : original.language ?? language;

  const translate = async () => {
    if (translation) return setShowOriginal(false);
    setTranslating(true);
    const result = await translateRecipe(original.id!, language);
    setTranslating(false);
    if (result.ok) {
      setTranslation(result.translation);
      setShowOriginal(false);
      return;
    }
    showDialog(
      failureTitle(t, result.reason, t('recipe.translateTitle')),
      result.reason === 'user_quota' ? t('recipe.translateQuota') : result.reason === 'provider_quota' ? t('recipe.translateBusy') : t('recipe.translateError'),
    );
  };

  // Confirmation d'ajout aux courses (« Voir »), 5 secondes
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), motion.undoWindow);
  };
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const openShoppingList = () => {
    onClose();
    router.navigate('/shopping');
  };
  const pantry = usePantryUrgency();
  const toSave = toSaveCount(recipe, pantry);
  // À acheter, sans les basiques (recettes enregistrées avant leur retrait côté serveur)
  const missing = (recipe.missing_ingredients ?? []).filter((name) => !isBasic(name));

  // Quantité d'un ingrédient (recherchée dans ingredients_used par son nom)
  const amountOf = (name: string) => {
    const item = recipe.ingredients_used.find((used) => normalize(used.name) === normalize(name))
      ?? recipe.ingredients_used.find((used) => normalize(used.name).includes(normalize(name)) || normalize(name).includes(normalize(used.name)));
    return item ? recipeAmount(item.quantity, item.unit, textLanguage) : '';
  };
  // Ingrédients qui ne sont ni « du garde-manger » ni « à acheter » (sel, huile…, anciennes recettes)
  const listed = [...recipe.ingredients_from_list, ...missing].map(normalize);
  const others = recipe.ingredients_used.filter((used) => !listed.some((name) => name === normalize(used.name) || normalize(used.name).includes(name) || name.includes(normalize(used.name))));

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const past = event.nativeEvent.contentOffset.y > heroLimit;
            if (past !== pastHero) setPastHero(past);
          }}
        >
          {/* Image, ou illustration tant qu'il n'y en a pas (génération en cours comprise) */}
          <View style={styles.hero}>
            {recipe.image_url ? (
              <Image source={{ uri: recipe.image_url }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" transition={motion.normal} />
            ) : (
              <RecipePlaceholder style={styles.fill} label={t('recipe.photoPlaceholder')} />
            )}
          </View>

          <View style={styles.sheet}>
            <Text style={styles.title}>{recipe.title}</Text>
            {recipe.image_url ? <Text style={styles.caption}>{t('recipe.imageCaption')}</Text> : null}
            {!recipe.image_url && !imageLoading && imageNotice ? <Text style={styles.caption}>{imageNotice}</Text> : null}
            {canTranslate && translation && !showOriginal ? (
              <Text style={styles.caption}>
                {t('recipe.translatedNote')} ·{' '}
                <Text style={styles.captionLink} onPress={() => setShowOriginal(true)} accessibilityRole="link">{t('recipe.showOriginal')}</Text>
              </Text>
            ) : canTranslate ? (
              <Button label={t('recipe.translate')} icon={Languages} variant="soft" size="small" onPress={translate} loading={translating} style={styles.translate} />
            ) : null}
            {recipe.description ? <Text style={styles.description}>{recipe.description}</Text> : null}

            <View style={styles.pills}>
              <Pill icon={Clock} label={t('common.minutes', { count: recipe.total_time })} />
              {recipe.difficulty ? <Pill icon={Flame} label={difficultyLabel(t, recipe.difficulty)} /> : null}
              {recipe.servings > 0 ? <Pill icon={Users} label={t('generate.servingsShort', { count: recipe.servings })} /> : null}
            </View>
            {recipe.prep_time > 0 || recipe.cook_time > 0 ? (
              <Text style={styles.times}>{t('home.prepAndCook', { prep: recipe.prep_time, cook: recipe.cook_time })}</Text>
            ) : null}

            {dietLabels.length > 0 && (
              <View style={styles.tags}>
                {dietLabels.map((label, index) => (
                  <Badge key={index} label={label} tone="leftover" />
                ))}
              </View>
            )}

            {recipe.suggestion ? (
              <View style={styles.note}>
                <Sparkles size={sizes.iconSmall} color={colors.onAccent} />
                <Text style={styles.noteText}>{recipe.suggestion}</Text>
              </View>
            ) : null}

            {/* Mode cuisine : dans la langue affichée (traduction comprise) */}
            {recipe.instructions.length > 0 ? (
              <CookStartButton recipe={{ ...recipe, language: textLanguage }} onBeforeOpen={onClose} style={styles.cookStart} />
            ) : null}

            {recipe.ingredients_from_list.length > 0 && (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('recipe.fromPantryShort')}</Text>
                  {toSave > 0 ? <Badge label={t('recipe.toSave', { count: toSave })} tone="expired" /> : null}
                </View>
                {recipe.ingredients_from_list.map((name, index) => (
                  <IngredientRow key={index} name={name} amount={amountOf(name)} checkbox={<Checkbox checked shape="circle" />} />
                ))}
              </Card>
            )}

            {missing.length > 0 && (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('recipe.toBuy')}</Text>
                </View>
                {missing.map((name, index) => (
                  <IngredientRow key={index} name={name} amount={amountOf(name)} checkbox={<Checkbox checked={false} shape="dashed" />} />
                ))}
                <AddMissingButton
                  names={missing}
                  quantities={missing.map(amountOf)}
                  recipeId={recipe.id}
                  recipeTitle={recipe.title}
                  onAdded={showToast}
                  onOpenList={openShoppingList}
                />
              </Card>
            )}

            {others.length > 0 && (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('recipe.otherIngredients')}</Text>
                </View>
                {others.map((item, index) => (
                  <IngredientRow key={index} name={item.name} amount={recipeAmount(item.quantity, item.unit, textLanguage)} />
                ))}
              </Card>
            )}

            {recipe.instructions.length > 0 && (
              <View style={styles.steps}>
                <Text style={styles.sectionTitle}>{t('recipe.instructions')}</Text>
                {recipe.instructions.map((step, index) => (
                  <View key={index} style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {recipe.tips.map((tip, index) => (
              <View key={index} style={styles.note}>
                <Sparkles size={sizes.iconSmall} color={colors.onAccent} />
                <Text style={styles.noteText}>
                  <Text style={styles.noteStrong}>{t('recipe.tipLabel')} </Text>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Retour et favori posés sur l'image ; une fois l'image dépassée, barre opaque avec le titre */}
        <View style={[styles.topBar, safe.top(pastHero ? spacing.sm : spacing.md), pastHero && styles.topBarSolid]} pointerEvents="box-none">
          <RoundButton onPress={onClose} label={t('common.back')}>
            <ChevronLeft size={sizes.iconLarge} color={colors.text} />
          </RoundButton>
          {pastHero ? <Text style={styles.topBarTitle} numberOfLines={1}>{recipe.title}</Text> : null}
          <RoundButton onPress={onToggleFavorite} label={isFavorite ? t('saved.removeFavorite') : t('recipe.saveToFavorites')} selected={isFavorite}>
            <Heart size={sizes.icon} color={colors.expired.text} fill={isFavorite ? colors.expired.text : colors.transparent} />
          </RoundButton>
        </View>

        {/* Barre du bas : messages (« Voir », « Annuler ») et « J'ai cuisiné ça » toujours visible */}
        {toast || recipe.ingredients_used.some((item) => item.pantry_id) ? (
          <View style={[styles.bottomBar, safe.bottom(spacing.md)]}>
            <Toast message={toast} actionLabel={t('common.view')} onAction={openShoppingList} inset={false} />
            <CookedButton ingredientsUsed={recipe.ingredients_used} recipeId={recipe.id} recipeTitle={recipe.title} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <View style={styles.pill}>
      <Icon size={sizes.iconSmall} color={colors.text} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function IngredientRow({ name, amount, checkbox }: { name: string; amount: string; checkbox?: React.ReactNode }) {
  return (
    <View>
      <View style={cardStyles.divider} />
      <View style={styles.ingredient}>
        {checkbox}
        <Text style={styles.ingredientName}>{name}</Text>
        {amount ? <Text style={styles.ingredientAmount}>{amount}</Text> : null}
      </View>
    </View>
  );
}

function RoundButton({ onPress, label, selected, children }: { onPress: () => void; label: string; selected?: boolean; children: React.ReactNode }) {
  return (
    <Touchable onPress={onPress} style={styles.round} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }}>
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  cookStart: {
    marginTop: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // La barre du bas est dans la mise en page : le contenu s'arrête au-dessus d'elle
  scroll: {
    paddingBottom: spacing.xxxl,
  },
  hero: {
    height: sizes.recipeHero,
    backgroundColor: colors.illustration.background,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  sheet: {
    marginTop: -radius.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    ...typography.title1,
  },
  caption: {
    ...typography.secondary,
    marginTop: -spacing.sm,
  },
  captionLink: {
    ...typography.secondaryStrong,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  translate: {
    alignSelf: 'flex-start',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minHeight: sizes.touch - spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillText: {
    ...typography.listTitle,
  },
  times: {
    ...typography.secondary,
    marginTop: -spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.control,
    padding: spacing.lg,
  },
  noteText: {
    ...typography.body,
    flex: 1,
    fontSize: typography.listTitle.fontSize,
  },
  noteStrong: {
    fontFamily: typography.button.fontFamily,
  },
  card: {
    paddingVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touch,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.cardTitle,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touch + spacing.xs,
  },
  ingredientName: {
    ...typography.bodyMedium,
    flex: 1,
  },
  ingredientAmount: {
    ...typography.body,
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.cardTitle,
    fontSize: typography.title3.fontSize! - spacing.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: sizes.iconChip - spacing.xs,
    height: sizes.iconChip - spacing.xs,
    borderRadius: radius.small,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typography.button,
    color: colors.primary,
  },
  stepText: {
    ...typography.body,
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  topBarSolid: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: sizes.borderWidth,
    borderBottomColor: colors.border,
  },
  topBarTitle: {
    ...typography.button,
    flex: 1,
    textAlign: 'center',
  },
  round: {
    width: sizes.touch + spacing.xs,
    height: sizes.touch + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
});
