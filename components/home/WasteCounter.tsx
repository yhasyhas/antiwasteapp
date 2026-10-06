import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { onPantryChanged } from '@/lib/pantryEvents';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, sizes, spacing, typography } from '@/constants/theme';

interface Counts {
  saved: number;
  wasted: number;
}

interface Stats {
  household: Counts;
  me: Counts;
  shared: boolean;
}

// Compteur anti-gaspi du mois (fonction food_stats), en tête de l'accueil : grand chiffre des aliments
// sauvés (« J'ai cuisiné ça ») par moi, et bilan du foyer (sauvés, gaspillés : supprimés après leur date).
// En nombre d'aliments, sans kilos ni euros. Toucher le compteur ouvre « Mon impact » (6 mois, les plus gaspillés).
export function WasteCounter() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(() => {
    supabase.rpc('food_stats').then(({ data, error }) => {
      if (error) console.warn('[compteur]', error.message);
      else setStats(data as Stats);
    });
  }, []);

  useFocusEffect(load);
  useEffect(() => onPantryChanged(load), [load]);

  if (!stats) {
    return (
      <Card variant="soft" style={styles.card}>
        <Skeleton width={spacing.xxxl * 2} height={typography.display.lineHeight!} />
        <View style={styles.text}>
          <Skeleton width="80%" height={typography.cardTitle.fontSize!} />
          <Skeleton width="60%" height={typography.secondary.fontSize!} />
        </View>
      </Card>
    );
  }

  // Foyer partagé : mon chiffre en grand, le foyer en dessous ; sinon mon bilan (celui du foyer personnel)
  const mine = stats.shared ? stats.me : stats.household;
  const line = stats.shared
    ? t('counter.householdLine', {
      saved: t('counter.savedShort', { count: stats.household.saved }),
      wasted: t('counter.wasted', { count: stats.household.wasted }),
    })
    : t('counter.wastedLine', { wasted: t('counter.wasted', { count: mine.wasted }) });
  const empty = stats.household.saved + stats.household.wasted === 0;

  return (
    <Card
      variant="soft"
      style={styles.card}
      onPress={() => router.push('/impact')}
      accessibilityLabel={`${mine.saved} ${t('counter.bigLabel', { count: mine.saved })}. ${empty ? t('counter.hint') : line}. ${t('impact.open')}`}
    >
      <Text style={styles.number}>{mine.saved}</Text>
      <View style={styles.text}>
        <Text style={styles.label}>{t('counter.bigLabel', { count: mine.saved })}</Text>
        <Text style={styles.line}>{empty ? t('counter.hint') : line}</Text>
      </View>
      <ChevronRight size={sizes.icon} color={colors.textSecondary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  number: {
    ...typography.display,
    color: colors.primary,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.cardTitle,
  },
  line: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
});
