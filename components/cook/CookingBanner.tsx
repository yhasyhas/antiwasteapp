import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChefHat, ChevronRight, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Touchable } from '@/components/ui/Touchable';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { formatTimer } from '@/lib/cookingSteps';
import { endCooking, remainingSeconds, useCookingSession } from '@/lib/cookingSession';
import { showDialog } from '@/lib/dialog';

// Accueil : séance du mode cuisine en cours (« En cuisine : Poulet yassa · Étape 3 sur 7 · 6:42 ») ; toucher la
// reprend à la même étape ; la croix l'arrête (minuteurs compris), après confirmation.
export function CookingBanner() {
  const { t } = useLanguage();
  const session = useCookingSession();
  const [now, setNow] = useState(Date.now());
  const running = session?.timers.filter((timer) => remainingSeconds(timer, now) > 0) ?? [];

  useEffect(() => {
    if (!session || session.timers.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session?.timers.length]);

  if (!session) return null;
  const total = session.recipe.instructions.length;
  const where = session.phase === 'prep' ? t('cook.bannerPrep') : session.phase === 'done' ? t('cook.doneTitle') : t('cook.bannerStep', { step: session.step + 1, total });
  // Le minuteur le plus proche de sa fin
  const next = [...running].sort((a, b) => a.endAt - b.endAt)[0];
  const finished = session.timers.some((timer) => remainingSeconds(timer, now) <= 0);

  const stop = () =>
    showDialog(t('cook.stopTitle'), t('cook.stopText', { title: session.recipe.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cook.stop'), style: 'destructive', onPress: () => endCooking() },
    ]);

  return (
    <View style={styles.banner}>
      <Touchable onPress={() => router.push('/cook')} style={styles.main} accessibilityRole="button" accessibilityLabel={`${t('cook.banner', { title: session.recipe.title })}, ${where}. ${t('cook.bannerAction')}`}>
        <View style={styles.icon}>
          <ChefHat size={sizes.iconLarge} color={colors.onPrimary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{t('cook.banner', { title: session.recipe.title })}</Text>
          <Text style={[styles.detail, finished && styles.detailDone]} numberOfLines={1}>
            {where}{next ? ` · ${formatTimer(remainingSeconds(next, now))}` : ''}{finished ? ` · ${t('cook.timerDoneTitle')}` : ''}
          </Text>
        </View>
        <ChevronRight size={sizes.iconLarge} color={colors.primary} />
      </Touchable>
      <Touchable onPress={stop} style={styles.stop} accessibilityRole="button" accessibilityLabel={t('cook.quit')}>
        <X size={sizes.icon} color={colors.textSecondary} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    backgroundColor: colors.primarySoft,
    paddingLeft: spacing.md,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  icon: {
    width: sizes.iconChip,
    height: sizes.iconChip,
    borderRadius: radius.iconChip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.listTitle,
  },
  detail: {
    ...typography.secondary,
    fontVariant: ['tabular-nums'],
  },
  detailDone: {
    color: colors.expired.text,
  },
  stop: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
