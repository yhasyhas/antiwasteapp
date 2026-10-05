import React, { memo, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus, Thermometer, Timer } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { StepButton } from '@/components/ui/StepButton';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '@/constants/theme';
import { coreTemperature, formatTimer, stepDurations, stepIngredients } from '@/lib/cookingSteps';
import { startTimer } from '@/lib/cookingSession';
import { recipeAmount } from '@/lib/quantity';
import type { CookingRecipe } from '@/lib/cookingSession';

interface Props {
  recipe: CookingRecipe;
  index: number;
  width: number;
  // Langue du texte de la recette (unités accordées)
  textLanguage: string;
}

// Durée d'un bouton de minuteur : « 7 min », « 1 h 30 », « 45 s »
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

// Une étape du mode cuisine, lisible à un mètre : texte en très gros caractères ; température à cœur mise en
// évidence ; un bouton de minuteur par durée trouvée (la plus longue d'une fourchette), réglable avant de le
// lancer ; ingrédients nommés dans l'étape, avec leur quantité.
export const CookStep = memo(function CookStep({ recipe, index, width, textLanguage }: Props) {
  const { t } = useLanguage();
  const text = recipe.instructions[index] ?? '';
  const durations = useMemo(() => stepDurations(text), [text]);
  const core = useMemo(() => coreTemperature(text), [text]);
  const ingredients = useMemo(() => stepIngredients(text, recipe.ingredients_used), [text, recipe.ingredients_used]);
  // Minuteur en cours de réglage (avant « Lancer »)
  const [adjusting, setAdjusting] = useState<number | null>(null);

  const launch = (seconds: number) => {
    setAdjusting(null);
    startTimer(index, seconds);
  };

  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.step}>{text}</Text>

      {core ? (
        <View style={styles.core} accessible accessibilityLabel={t('cook.coreTemp', { temp: core })}>
          <Thermometer size={sizes.iconLarge + 4} color={colors.expired.text} />
          <Text style={styles.coreText}>{t('cook.coreTemp', { temp: core })}</Text>
        </View>
      ) : null}

      {durations.length > 0 ? (
        <View style={styles.timers}>
          {adjusting !== null ? (
            <View style={styles.adjust}>
              <StepButton icon={Minus} label={t('cook.timerLess')} disabled={adjusting <= 60} onPress={() => setAdjusting(Math.max(60, adjusting - 60))} />
              <Text style={styles.adjustValue}>{formatTimer(adjusting)}</Text>
              <StepButton icon={Plus} label={t('cook.timerMore')} disabled={adjusting >= 12 * 3600} onPress={() => setAdjusting(adjusting + 60)} />
              <Button label={t('cook.timerStart')} icon={Timer} size="medium" onPress={() => launch(adjusting)} style={styles.adjustStart} />
            </View>
          ) : (
            durations.map((duration) => (
              <Button
                key={duration.seconds}
                label={t('cook.timerFor', { duration: durationLabel(duration.seconds) })}
                icon={Timer}
                variant="soft"
                size="large"
                onPress={() => setAdjusting(duration.seconds)}
                accessibilityLabel={`${t('cook.timerFor', { duration: durationLabel(duration.seconds) })} (${duration.text})`}
              />
            ))
          )}
          {adjusting !== null ? <Button label={t('cook.timerCancel')} variant="ghost" size="small" onPress={() => setAdjusting(null)} /> : null}
        </View>
      ) : null}

      {ingredients.length > 0 ? (
        <View style={styles.ingredients}>
          <Text style={styles.ingredientsTitle}>{t('cook.stepIngredients')}</Text>
          {ingredients.map((item, i) => {
            const amount = recipeAmount(item.quantity, item.unit, textLanguage);
            return (
              <View key={`${item.name}-${i}`} style={styles.ingredient}>
                <Text style={styles.ingredientName}>{item.name}</Text>
                {amount ? <Text style={styles.ingredientAmount}>{amount}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  // Lisible à un mètre
  step: {
    fontFamily: fontFamilies.semibold,
    fontSize: 30,
    lineHeight: 42,
    color: colors.text,
  },
  core: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.expired.background,
  },
  coreText: {
    flex: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.expired.text,
  },
  timers: {
    gap: spacing.md,
  },
  adjust: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  adjustValue: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    minWidth: 96,
    textAlign: 'center',
  },
  adjustStart: {
    flexGrow: 1,
  },
  ingredients: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  ingredientsTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ingredientName: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
  },
  ingredientAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.primary,
  },
});
