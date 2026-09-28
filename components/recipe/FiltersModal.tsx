import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { spacing, typography, colors } from '@/constants/theme';
import { cuisineOptions, dietaryOptions, difficultyOptions, languages, mealTypes } from './options';
import { CookTimeChoice, ServingsStepper } from './PreferenceControls';
import type { Filters } from './types';

interface Props {
  visible: boolean;
  filters: Filters;
  onChange: (filters: Filters) => void;
  onToggleDietary: (option: string) => void;
  onClose: () => void;
}

// Feuille des filtres de génération : type de repas, cuisine, temps, personnes, régimes, difficulté, langue
export function FiltersModal({ visible, filters, onChange, onToggleDietary, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <SheetHeader title={t('generate.filtersTitle')} onClose={onClose} />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <Group title={t('generate.mealType')}>
          {mealTypes.map((meal) => (
            <Chip
              key={meal.value}
              label={t(meal.labelKey)}
              icon={meal.icon}
              selected={filters.mealType === meal.value}
              onPress={() => onChange({ ...filters, mealType: meal.value })}
            />
          ))}
        </Group>

        <Group title={t('cuisine.title')}>
          {cuisineOptions.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              showCheck
              selected={filters.cuisine === option.value}
              onPress={() => onChange({ ...filters, cuisine: option.value })}
            />
          ))}
        </Group>

        <Group title={t('preferences.maxTime')}>
          <CookTimeChoice value={filters.maxCookTime} onChange={(maxCookTime) => onChange({ ...filters, maxCookTime })} />
        </Group>

        <Group title={t('preferences.servings')}>
          <ServingsStepper value={filters.servings} onChange={(servings) => onChange({ ...filters, servings })} />
        </Group>

        <Group title={t('generate.dietary')}>
          {dietaryOptions.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey)}
              showCheck
              selected={filters.dietary.includes(option.value)}
              onPress={() => onToggleDietary(option.value)}
            />
          ))}
        </Group>

        {/* Aliments exclus : rappel (modifiables dans les préférences) */}
        {filters.excluded.length > 0 && (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('preferences.excluded')}</Text>
            <Text style={styles.note}>{t('preferences.excludedNote', { items: filters.excluded.join(', ') })}</Text>
          </View>
        )}

        <Group title={t('generate.difficulty')}>
          {difficultyOptions.map((option) => (
            <Chip
              key={option}
              label={difficultyLabel(t, option)}
              showCheck
              selected={filters.difficulty === option}
              onPress={() => onChange({ ...filters, difficulty: option })}
            />
          ))}
        </Group>

        <Group title={t('generate.recipeLanguage')}>
          {languages.map((lang) => (
            <Chip
              key={lang.value}
              label={`${lang.flag} ${lang.label}`}
              selected={filters.language === lang.value}
              onPress={() => onChange({ ...filters, language: lang.value })}
            />
          ))}
        </Group>
      </ScrollView>

      <Button label={t('generate.apply')} onPress={onClose} style={styles.apply} />
    </BottomSheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  group: {
    gap: spacing.md,
  },
  groupTitle: {
    ...typography.bodyStrong,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    ...typography.secondary,
    color: colors.textSecondary,
  },
  apply: {
    marginTop: spacing.md,
  },
});
