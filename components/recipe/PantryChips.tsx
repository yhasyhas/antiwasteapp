import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Circle, Soup } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Chip } from '@/components/ui/Chip';
import { Touchable } from '@/components/ui/Touchable';
import { EXPIRY_COLORS, expiryStatus, type FoodKind } from '@/lib/expiry';
import { useFoodNames } from '@/lib/foodNames';
import { colors, sizes, spacing, typography } from '@/constants/theme';

export interface ChipIngredient {
  id: string;
  name: string;
  expires_at: string | null;
  kind: FoodKind;
  food_key?: string | null;
}

interface Props {
  ingredients: ChipIngredient[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

const COLLAPSED_COUNT = 8;

// « Avec tes aliments » : ingrédients du garde-manger (triés par urgence), point de couleur pour ceux qui
// expirent, icône pour les restes. Toucher des ingrédients les sélectionne : la génération ne cuisine
// alors qu'avec eux ; « Tout utiliser » revient à tout le garde-manger.
export function PantryChips({ ingredients, selectedIds, onToggle, onClear }: Props) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const foodName = useFoodNames(ingredients);
  // Les ingrédients choisis restent visibles même repliés
  const visible = expanded
    ? ingredients
    : ingredients.filter((ing, i) => i < COLLAPSED_COUNT || selectedIds.includes(ing.id));
  const hidden = ingredients.length - visible.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('generate.withYourFoods')}</Text>
        {selectedIds.length > 0 && (
          <Touchable onPress={onClear} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkText}>{t('generate.useAll')}</Text>
          </Touchable>
        )}
      </View>
      <Text style={styles.hint}>
        {selectedIds.length > 0 ? t('generate.selectionActive', { count: selectedIds.length }) : t('generate.priorityHint')}
      </Text>
      <View style={styles.grid}>
        {visible.map((ingredient) => {
          const status = expiryStatus(ingredient.expires_at);
          const urgent = status === 'expired' || status === 'soon';
          return (
            <Chip
              key={ingredient.id}
              label={foodName(ingredient)}
              selected={selectedIds.includes(ingredient.id)}
              showCheck
              icon={ingredient.kind === 'dish' ? Soup : urgent ? Circle : undefined}
              iconColor={ingredient.kind === 'dish' ? colors.primary : urgent ? EXPIRY_COLORS[status].text : undefined}
              onPress={() => onToggle(ingredient.id)}
            />
          );
        })}
        {hidden > 0 && <Chip label={t('generate.more', { count: hidden })} onPress={() => setExpanded(true)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touch,
  },
  title: {
    ...typography.bodyStrong,
  },
  link: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  hint: {
    ...typography.secondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
