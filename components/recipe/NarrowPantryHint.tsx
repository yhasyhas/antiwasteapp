import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Camera, Lightbulb } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { isBasic } from '@/lib/basics';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

// Au plus 2 aliments disponibles (ou choisis) : peu d'idées possibles
export const NARROW_PANTRY = 2;

interface Props {
  ingredients: { id: string; name: string }[];
  selectedIds: string[];
}

// Garde-manger étroit : « Ajoute 1 ou 2 ingrédients pour plus d'idées ». Avec une sélection de 1 ou 2 aliments alors
// que d'autres sont disponibles : en choisir d'autres ; sinon, un bouton vers le Scanner. Les basiques (sel, huile…)
// ne comptent pas.
export function NarrowPantryHint({ ingredients, selectedIds }: Props) {
  const { t } = useLanguage();
  // Aliments distincts (plusieurs lots du même aliment comptent pour un), hors basiques
  const foods = new Set(ingredients.filter((item) => !isBasic(item.name)).map((item) => item.name.trim().toLowerCase()));
  const selected = new Set(ingredients.filter((item) => selectedIds.includes(item.id) && !isBasic(item.name)).map((item) => item.name.trim().toLowerCase()));
  const narrowSelection = selected.size > 0 && selected.size <= NARROW_PANTRY && foods.size > selected.size;
  const narrowPantry = selected.size === 0 && foods.size > 0 && foods.size <= NARROW_PANTRY;
  if (!narrowSelection && !narrowPantry) return null;

  return (
    <View style={styles.box} accessibilityRole="summary">
      <View style={styles.row}>
        <Lightbulb size={sizes.icon} color={colors.onAccent} />
        <Text style={styles.text}>{narrowSelection ? t('generate.narrowSelection') : t('generate.narrowPantry')}</Text>
      </View>
      {narrowPantry ? (
        <Button label={t('generate.narrowAction')} icon={Camera} variant="soft" size="small" onPress={() => router.navigate('/(tabs)/camera')} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.accentSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  text: {
    ...typography.body,
    flex: 1,
  },
  action: {
    alignSelf: 'flex-start',
  },
});
