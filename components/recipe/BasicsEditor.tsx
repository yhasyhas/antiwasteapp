import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { TextField } from '@/components/ui/Input';
import { Touchable } from '@/components/ui/Touchable';
import { isKnownBasic, matchKey, MAX_BASIC_LENGTH, MAX_BASICS, SUGGESTED_BASICS } from '@/lib/basics';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';

interface Props {
  // Identifiants connus (« garlic ») ou noms libres (« sauce soja »)
  value: string[];
  onChange: (basics: string[]) => void;
}

// « Mes basiques » (Préférences) : basiques choisis, supprimables ; suggestions à ajouter d'un toucher ; champ pour un
// basique libre
export function BasicsEditor({ value, onChange }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const label = (basic: string) => (isKnownBasic(basic) ? String(t(`basics.item.${basic}` as never)) : basic);
  const has = (basic: string) => value.some((item) => matchKey(item) === matchKey(basic) || (isKnownBasic(item) && matchKey(label(item)) === matchKey(basic)));
  const full = value.length >= MAX_BASICS;
  const suggestions = SUGGESTED_BASICS.filter((basic) => !value.includes(basic));

  const add = (basic: string) => {
    const name = basic.trim().slice(0, MAX_BASIC_LENGTH);
    if (!name || full || has(name)) return;
    onChange([...value, name]);
  };
  const addDraft = () => {
    add(draft);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      {value.length > 0 ? (
        <View style={styles.grid}>
          {value.map((basic) => (
            <Touchable
              key={basic}
              style={styles.chip}
              onPress={() => onChange(value.filter((other) => other !== basic))}
              accessibilityRole="button"
              accessibilityLabel={t('preferences.removeBasic', { name: label(basic) })}
            >
              <Text style={styles.chipText}>{label(basic)}</Text>
              <X size={sizes.iconSmall} color={colors.primary} />
            </Touchable>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{t('preferences.basicsEmpty')}</Text>
      )}

      {suggestions.length > 0 && !full ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>{t('preferences.basicsSuggestions')}</Text>
          <View style={styles.grid}>
            {suggestions.map((basic) => (
              <Touchable
                key={basic}
                style={styles.suggestion}
                onPress={() => add(basic)}
                accessibilityRole="button"
                accessibilityLabel={t('preferences.addBasic', { name: label(basic) })}
              >
                <Plus size={sizes.iconSmall} color={colors.primary} />
                <Text style={styles.suggestionText}>{label(basic)}</Text>
              </Touchable>
            ))}
          </View>
        </View>
      ) : null}

      {!full ? (
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder={t('preferences.basicsPlaceholder')}
          maxLength={MAX_BASIC_LENGTH}
          returnKeyType="done"
          onSubmitEditing={addDraft}
          blurOnSubmit={false}
          trailing={
            <Touchable style={[styles.addButton, !draft.trim() && styles.disabled]} onPress={addDraft} disabled={!draft.trim()} accessibilityRole="button" accessibilityLabel={t('preferences.addBasic', { name: draft.trim() })}>
              <Plus size={sizes.iconLarge} color={colors.onPrimary} />
            </Touchable>
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minHeight: sizes.touch - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...typography.listTitle,
    color: colors.primary,
  },
  empty: {
    ...typography.secondary,
  },
  suggestions: {
    gap: spacing.sm,
  },
  suggestionsTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touch - spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionText: {
    ...typography.listTitle,
    color: colors.text,
  },
  addButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.control - spacing.xs,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
