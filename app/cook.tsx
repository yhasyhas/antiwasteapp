import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, Vibration, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ChevronLeft, ChevronRight, ChefHat, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Touchable } from '@/components/ui/Touchable';
import { CookStep } from '@/components/cook/CookStep';
import { TimerStrip } from '@/components/cook/TimerStrip';
import { CookedButton } from '@/components/recipe/CookedButton';
import { RecipeRating } from '@/components/recipe/RecipeRating';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '@/constants/theme';
import { recipeAmount } from '@/lib/quantity';
import { useRecipeImages } from '@/hooks/useRecipeImages';
import { endCooking, loadCookingSession, markTimersAlerted, updateCooking, useCookingSession } from '@/lib/cookingSession';

const KEEP_AWAKE_TAG = 'cooking-mode';
// Fin de minuteur constatée dans l'app moins de 10 s après l'heure : vibration (sinon la notification a déjà sonné)
const FRESH_ALERT_MS = 10_000;

// Mode cuisine : mise en place (ingrédients à cocher), puis une étape à la fois en très gros caractères
// (« Étape 3 sur 7 », Précédent / Suivant ou glissement), minuteurs en haut de l'écran, et « C'est prêt ! » qui
// ouvre « J'ai cuisiné ça ». Écran gardé allumé. Quitter garde la séance : on revient à la même étape, avec les
// minuteurs en cours (lib/cookingSession.ts).
export default function CookScreen() {
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const { width } = useWindowDimensions();
  const session = useCookingSession();
  // Photo du plat : celle de la séance, ou celle arrivée depuis (image générée pendant la cuisine)
  const images = useRecipeImages();
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    loadCookingSession().then(() => setReady(true));
  }, []);

  // Écran allumé pendant le mode cuisine
  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((error) => console.warn('[cuisine] écran allumé impossible :', error));
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, []);

  // Minuteurs : affichage chaque seconde ; fin constatée dans l'app → vibration (son : notification programmée)
  const timers = session?.timers ?? [];
  useEffect(() => {
    if (timers.length === 0) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const finished = (currentTimers: typeof timers) => currentTimers.filter((timer) => !timer.alerted && timer.endAt <= current);
      const done = finished(timers);
      if (done.length === 0) return;
      if (done.some((timer) => current - timer.endAt < FRESH_ALERT_MS)) {
        Vibration.vibrate([0, 600, 300, 600, 300, 600]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
      markTimersAlerted(done.map((timer) => timer.id));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timers]);

  const recipe = session?.recipe;
  const steps = recipe?.instructions ?? [];
  const textLanguage = recipe?.language ?? language;
  const total = steps.length;
  const step = Math.min(session?.step ?? 0, Math.max(0, total - 1));

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= total) return;
    updateCooking({ step: index });
    listRef.current?.scrollToIndex({ index, animated: true });
  }, [total]);

  const onSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index !== step && index >= 0 && index < total) updateCooking({ step: index });
  };

  const finish = () => updateCooking({ phase: 'done' });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const closeDone = async () => {
    await endCooking();
    close();
  };

  if (!ready) return <View style={styles.container} />;
  if (!session || !recipe) {
    return (
      <View style={[styles.container, styles.center, safe.top(spacing.xl)]}>
        <Text style={styles.empty}>{t('cook.noSteps')}</Text>
        <Button label={t('cook.backToRecipe')} variant="outline" onPress={close} style={styles.emptyButton} />
      </View>
    );
  }

  const header = (
    <View style={[styles.header, safe.top(spacing.sm)]}>
      <Touchable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel={t('cook.quit')}>
        <X size={sizes.iconLarge + 4} color={colors.text} />
      </Touchable>
      <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
    </View>
  );

  // ---------- Mise en place ----------
  if (session.phase === 'prep') {
    const prepared = new Set(session.prepared);
    const toggle = (index: number) =>
      updateCooking({ prepared: prepared.has(index) ? session.prepared.filter((i) => i !== index) : [...session.prepared, index] });
    return (
      <View style={styles.container}>
        {header}
        <TimerStrip timers={timers} now={now} />
        <ScrollView contentContainerStyle={styles.prepContent}>
          <Text style={styles.phaseTitle}>{t('cook.prepTitle')}</Text>
          <Text style={styles.hint}>{t('cook.prepHint')}</Text>
          <Text style={styles.count}>{t('cook.prepCount', { done: prepared.size, total: recipe.ingredients_used.length })}</Text>
          {recipe.ingredients_used.map((item, index) => {
            const amount = recipeAmount(item.quantity, item.unit, textLanguage);
            const checked = prepared.has(index);
            return (
              <Touchable
                key={`${item.name}-${index}`}
                onPress={() => toggle(index)}
                style={styles.prepRow}
                scale={false}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={amount ? `${item.name}, ${amount}` : item.name}
              >
                <Checkbox checked={checked} />
                <Text style={[styles.prepName, checked && styles.prepChecked]}>{item.name}</Text>
                {amount ? <Text style={[styles.prepAmount, checked && styles.prepChecked]}>{amount}</Text> : null}
              </Touchable>
            );
          })}
        </ScrollView>
        <View style={[styles.footer, safe.bottom(spacing.md)]}>
          <Button label={t('cook.letsGo')} icon={ChefHat} size="large" disabled={total === 0} onPress={() => updateCooking({ phase: 'steps', step: 0 })} style={styles.footerButton} />
        </View>
      </View>
    );
  }

  // ---------- C'est prêt ! ----------
  if (session.phase === 'done') {
    // « J'ai cuisiné ça » : seulement si la recette utilise des aliments du garde-manger
    const fromPantry = recipe.ingredients_used.some((item) => item.pantry_id);
    const photo = images.withImage({ id: recipe.id, image_url: recipe.image_url }).image_url;
    return (
      <View style={styles.container}>
        {header}
        <TimerStrip timers={timers} now={now} />
        <ScrollView contentContainerStyle={styles.doneContent}>
          {photo ? (
            <View style={styles.photoBlock}>
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" accessibilityIgnoresInvertColors />
              <Text style={styles.photoCaption}>{t('recipe.imageCaption')}</Text>
            </View>
          ) : (
            <ChefHat size={72} color={colors.primary} />
          )}
          <Text style={styles.doneTitle}>{t('cook.doneTitle')}</Text>
          <Text style={styles.doneText}>{fromPantry ? t('cook.doneText') : t('cook.enjoy')}</Text>
          {fromPantry ? (
            <CookedButton ingredientsUsed={recipe.ingredients_used} recipeId={recipe.id} recipeTitle={recipe.title} openOnMount style={styles.cooked} />
          ) : null}
          {recipe.id ? <RecipeRating recipeId={recipe.id} style={styles.cooked} /> : null}
        </ScrollView>
        <View style={[styles.footer, safe.bottom(spacing.md)]}>
          <Button label={t('cook.close')} variant="outline" size="large" onPress={closeDone} style={styles.footerButton} />
        </View>
      </View>
    );
  }

  // ---------- Étapes ----------
  const last = step === total - 1;
  return (
    <View style={styles.container}>
      {header}
      <TimerStrip timers={timers} now={now} />
      <Text style={styles.stepOf} accessibilityRole="header">{t('cook.stepOf', { current: step + 1, total })}</Text>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((step + 1) / Math.max(1, total)) * 100}%` }]} />
      </View>
      <FlatList
        ref={listRef}
        data={steps.map((_, index) => index)}
        keyExtractor={(index) => String(index)}
        renderItem={({ item }) => <CookStep recipe={recipe} index={item} width={width} textLanguage={textLanguage} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={step}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={onSwipe}
        // Peu d'étapes : toutes gardées en mémoire, glissement fluide sur un téléphone modeste
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        style={styles.pager}
      />
      <View style={[styles.navigation, safe.bottom(spacing.md)]}>
        <Touchable
          onPress={() => (step === 0 ? updateCooking({ phase: 'prep' }) : goTo(step - 1))}
          style={[styles.navButton, styles.navPrevious]}
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? t('cook.prepTitle') : t('cook.previous')}
        >
          <ChevronLeft size={sizes.iconLarge + 4} color={colors.primary} />
          <Text style={styles.navPreviousText} numberOfLines={1} adjustsFontSizeToFit>{step === 0 ? t('cook.prepTitle') : t('cook.previous')}</Text>
        </Touchable>
        <Touchable
          onPress={() => (last ? finish() : goTo(step + 1))}
          style={[styles.navButton, styles.navNext]}
          accessibilityRole="button"
          accessibilityLabel={last ? t('cook.finish') : t('cook.next')}
        >
          <Text style={styles.navNextText} numberOfLines={1} adjustsFontSizeToFit>{last ? t('cook.finish') : t('cook.next')}</Text>
          {last ? null : <ChevronRight size={sizes.iconLarge + 4} color={colors.onPrimary} />}
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  empty: {
    ...typography.body,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  close: {
    width: sizes.touch + 4,
    height: sizes.touch + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.cardTitle,
    flex: 1,
  },
  phaseTitle: {
    ...typography.title1,
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  count: {
    ...typography.secondaryStrong,
  },
  prepContent: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  prepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  prepName: {
    flex: 1,
    fontFamily: fontFamilies.semibold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  prepAmount: {
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.primary,
  },
  prepChecked: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerButton: {
    minHeight: 64,
  },
  stepOf: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: colors.primary,
    paddingHorizontal: spacing.screen,
  },
  progress: {
    height: 6,
    marginHorizontal: spacing.screen,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  pager: {
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
  navButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  navPrevious: {
    backgroundColor: colors.primarySoft,
  },
  navNext: {
    flex: 1.4,
    backgroundColor: colors.primary,
  },
  navPreviousText: {
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    color: colors.primary,
  },
  navNextText: {
    flexShrink: 1,
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    color: colors.onPrimary,
  },
  doneContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  photoBlock: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  photoCaption: {
    ...typography.secondary,
    textAlign: 'center',
  },
  doneTitle: {
    ...typography.hero,
    textAlign: 'center',
  },
  doneText: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  cooked: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
