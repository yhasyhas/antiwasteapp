import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Layers } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Chip } from '@/components/ui/Chip';
import { addedWhen } from '@/lib/expiry';
import { totalLabel, type LotGroup } from '@/lib/pantryLots';
import type { ExistingChoice } from '@/lib/pantry';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

export type AddChoice = ExistingChoice | 'skip';

interface Props {
  // Ligne du garde-manger qui contient déjà l'aliment
  group: LotGroup<PantryIngredient>;
  choice: AddChoice;
  // Total après « Ajouter aux existants », ou null si les unités ne se correspondent pas
  mergedTotal: string | null;
  onChange: (choice: AddChoice) => void;
}

// Aliment déjà dans le garde-manger (scan, saisie manuelle) : « Déjà dans ton garde-manger : 3 tomates,
// ajouté hier », puis ajouter aux existants, ajouter séparément (nouveau lot, sur la même ligne) ou ne pas
// ajouter
export function ExistingFoodChoice({ group, choice, mergedTotal, onChange }: Props) {
  const { t, language } = useLanguage();
  const total = totalLabel(group.lots, language);
  const latest = group.lots.reduce((last, lot) => (lot.created_at > last ? lot.created_at : last), group.lots[0].created_at);
  const when = addedWhen(t, latest, language);

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Layers size={sizes.iconSmall} color={colors.primary} />
        <Text style={styles.text}>
          {total ? t('existing.alreadyHave', { quantity: total, when }) : t('existing.alreadyHaveNoQuantity', { when })}
        </Text>
      </View>
      <View style={styles.choices}>
        {mergedTotal !== null ? (
          <Chip label={t('existing.merge')} selected={choice === 'merge'} onPress={() => onChange('merge')} />
        ) : null}
        <Chip label={t('existing.separate')} selected={choice === 'separate'} onPress={() => onChange('separate')} />
        <Chip label={t('existing.skip')} selected={choice === 'skip'} onPress={() => onChange('skip')} />
      </View>
      {mergedTotal === null ? <Text style={styles.note}>{t('existing.mergeImpossible')}</Text> : null}
      {choice === 'merge' && mergedTotal ? <Text style={styles.note}>{t('existing.mergedTotal', { quantity: mergedTotal })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.primarySoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  text: {
    ...typography.bodyMedium,
    flex: 1,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    ...typography.secondary,
  },
});
