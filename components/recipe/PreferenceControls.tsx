import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { TextField } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Touchable } from '@/components/ui/Touchable';
import { COOK_TIME_OPTIONS, MAX_EXCLUDED, MAX_SERVINGS } from '@/lib/preferences';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';

// Commandes communes à l'écran « Préférences » et aux filtres de génération

// Temps maximum : 15 min à 2 h
export function CookTimeChoice({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.grid}>
      {COOK_TIME_OPTIONS.map((minutes) => (
        <Chip key={minutes} label={t('common.minutes', { count: minutes })} selected={value === minutes} showCheck onPress={() => onChange(minutes)} />
      ))}
    </View>
  );
}

// Nombre de personnes : « non précisé » ou 1 à 12
export function ServingsStepper({ value, onChange }: { value: number | null; onChange: (servings: number | null) => void }) {
  const { t } = useLanguage();
  const current = value ?? 0;
  const step = (icon: typeof Plus, disabled: boolean, next: number | null, label: string) => {
    const Icon = icon;
    return (
      <Touchable
        style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
        onPress={() => onChange(next)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon size={sizes.icon} color={colors.primary} />
      </Touchable>
    );
  };
  return (
    <View style={styles.stepper}>
      {step(Minus, current === 0, current <= 1 ? null : current - 1, '-')}
      <Text style={styles.stepValue}>{value ? t('preferences.servingsValue', { count: value }) : t('preferences.servingsAny')}</Text>
      {step(Plus, current >= MAX_SERVINGS, Math.min(MAX_SERVINGS, current + 1), '+')}
    </View>
  );
}

// Aliments exclus (allergies, goûts) : étiquettes supprimables et champ d'ajout
export function ExcludedEditor({ value, onChange }: { value: string[]; onChange: (excluded: string[]) => void }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim().slice(0, 40);
    if (!name || value.length >= MAX_EXCLUDED) return;
    if (!value.some((item) => item.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft('');
  };
  return (
    <View style={styles.excluded}>
      {value.length > 0 && (
        <View style={styles.grid}>
          {value.map((item) => (
            <Touchable
              key={item}
              style={styles.excludedChip}
              onPress={() => onChange(value.filter((other) => other !== item))}
              accessibilityRole="button"
              accessibilityLabel={t('preferences.removeExcluded', { name: item })}
            >
              <Text style={styles.excludedText}>{item}</Text>
              <X size={sizes.iconSmall} color={colors.expired.text} />
            </Touchable>
          ))}
        </View>
      )}
      {value.length < MAX_EXCLUDED && (
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={t('preferences.excludedPlaceholder')}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={add}
          blurOnSubmit={false}
          trailing={
            <Touchable style={[styles.addButton, !draft.trim() && styles.stepButtonDisabled]} onPress={add} disabled={!draft.trim()} accessibilityRole="button" accessibilityLabel={t('shopping.add')}>
              <Plus size={sizes.iconLarge} color={colors.onPrimary} />
            </Touchable>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: opacity.disabled,
  },
  stepValue: {
    ...typography.bodyStrong,
    minWidth: sizes.illustration - spacing.xxl,
    textAlign: 'center',
  },
  excluded: {
    gap: spacing.md,
  },
  excludedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minHeight: sizes.touch - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.expired.background,
  },
  excludedText: {
    ...typography.listTitle,
    color: colors.expired.text,
  },
  addButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.control - spacing.xs,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
