import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { Chip } from '@/components/ui/Chip';
import { spacing } from '@/constants/theme';
import { cuisineOptions, getMealTypeIcon, getMealTypeLabel } from './options';
import type { Filters } from './types';

// Filtres actifs en pilules (cuisine, temps, personnes, repas, difficulté) ; toucher l'une d'elles ouvre
// la feuille des filtres
export function FilterSummary({ filters, onOpen }: { filters: Filters; onOpen: () => void }) {
  const { t } = useLanguage();
  const cuisine = cuisineOptions.find((c) => c.value === filters.cuisine);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label={t('generate.preferences')} icon={SlidersHorizontal} onPress={onOpen} />
      {filters.cuisine !== 'any' && cuisine ? <Chip label={t(cuisine.labelKey)} onPress={onOpen} /> : null}
      <Chip label={t('generate.maxTimeShort', { count: filters.maxCookTime })} onPress={onOpen} />
      {filters.servings ? <Chip label={t('generate.servingsShort', { count: filters.servings })} onPress={onOpen} /> : null}
      <Chip label={getMealTypeLabel(t, filters.mealType)} icon={getMealTypeIcon(filters.mealType)} onPress={onOpen} />
      <Chip label={difficultyLabel(t, filters.difficulty)} onPress={onOpen} />
      {filters.dietary.length > 0 ? <Chip label={t('generate.dietCount', { count: filters.dietary.length })} onPress={onOpen} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
});
