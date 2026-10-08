import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AlarmClockOff, BellRing, ChevronRight, Timer, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Touchable } from '@/components/ui/Touchable';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '@/constants/theme';
import { formatTimer } from '@/lib/cookingSteps';
import { openExactAlarmSettings, remainingSeconds, removeTimer, useExactAlarms, type CookingTimer } from '@/lib/cookingSession';

// Minuteurs en cours, en haut du mode cuisine : « Étape 3 · 6:42 » ; fini : « Étape 3 · Terminé ! » en rouge.
// Toucher un minuteur l'arrête (en cours) ou le ferme (fini) ; toucher son étape n'y mène pas (le libellé suffit).
// Alarmes exactes refusées (Android 12 et plus) : rappel discret au-dessus, qui ouvre « Alarmes et rappels ».
export function TimerStrip({ timers, now }: { timers: CookingTimer[]; now: number }) {
  const { t } = useLanguage();
  const exactAlarms = useExactAlarms();
  const reminder = exactAlarms === false ? (
    <Touchable onPress={() => openExactAlarmSettings()} style={styles.reminder} accessibilityRole="button" accessibilityLabel={t('cook.exactReminder')}>
      <AlarmClockOff size={sizes.iconSmall} color={colors.soon.text} />
      <Text style={styles.reminderText}>{t('cook.exactReminder')}</Text>
      <ChevronRight size={sizes.iconSmall} color={colors.soon.text} />
    </Touchable>
  ) : null;
  if (timers.length === 0) return reminder;
  return (
    <>
    {reminder}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.strip}>
      {timers.map((timer) => {
        const left = remainingSeconds(timer, now);
        const done = left <= 0;
        const step = timer.step + 1;
        return (
          <Touchable
            key={timer.id}
            onPress={() => removeTimer(timer.id)}
            style={[styles.pill, done && styles.pillDone]}
            accessibilityRole="button"
            accessibilityLabel={done ? t('cook.timerSeen', { step }) : `${t('cook.timerRunning', { step, time: formatTimer(left) })}. ${t('cook.timerStop', { step })}`}
          >
            {done ? <BellRing size={sizes.icon} color={colors.onPrimary} /> : <Timer size={sizes.icon} color={colors.primary} />}
            <Text style={[styles.text, done && styles.textDone]}>
              {done ? t('cook.timerDone', { step }) : t('cook.timerRunning', { step, time: formatTimer(left) })}
            </Text>
            <X size={sizes.iconSmall} color={done ? colors.onPrimary : colors.textSecondary} />
          </Touchable>
        );
      })}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.soon.background,
  },
  reminderText: {
    ...typography.secondaryStrong,
    flex: 1,
    color: colors.soon.text,
  },
  strip: {
    flexGrow: 0,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  pillDone: {
    backgroundColor: colors.expired.text,
  },
  text: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  textDone: {
    color: colors.onPrimary,
  },
});
