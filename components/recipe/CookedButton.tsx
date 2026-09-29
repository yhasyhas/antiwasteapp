import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { useFoodNames } from '@/lib/foodNames';
import { formatQuantity, parseQuantity, remainingAfter, roundTo, stepFor, type Quantity } from '@/lib/quantity';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Touchable } from '@/components/ui/Touchable';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';

interface UsedIngredient {
  name: string;
  quantity?: string;
  unit?: string;
  // Relie un ingrédient de la recette à celui du garde-manger (depuis la phase 3)
  pantry_id?: string | null;
}

interface Props {
  ingredientsUsed: UsedIngredient[] | null | undefined;
  // Conteneur du bouton (barre fixée en bas de la fiche recette)
  style?: StyleProp<ViewStyle>;
}

// Reste choisi : quantité calculée (modifiable avec + et −), ou « La moitié » / « Un peu »
type Leftover = { kind: 'amount'; value: number } | { kind: 'half' } | { kind: 'little' };

interface PantryRow {
  id: string;
  name: string;
  quantity: string | null;
  food_key: string | null;
  kind: string | null;
  // Quantité du garde-manger lue (null : pas de nombre)
  stock: Quantity | null;
  // Reste calculé quand l'unité correspond à celle de la recette (4 œufs − 2 = 2)
  computed: number | null;
  // null : « Tout utilisé »
  leftover: Leftover | null;
}

// « J'ai cuisiné ça » : pour chaque ingrédient du garde-manger utilisé par la recette, « Tout utilisé » (par
// défaut) ou « Il en reste ». Les aliments entièrement utilisés sont retirés et comptés « sauvés » ; les
// autres gardent leur date et prennent la quantité restante (comptés plus tard, une fois finis).
export function CookedButton({ ingredientsUsed, style }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<PantryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const foodName = useFoodNames(rows);

  const used = (ingredientsUsed ?? []).filter((item) => !!item?.pantry_id);
  const pantryIds = [...new Set(used.map((item) => item.pantry_id as string))];
  // Recettes d'avant la phase 3 : pas d'identifiants, rien à retirer
  if (pantryIds.length === 0) return null;

  const open = async () => {
    setLoading(true);
    // Seulement ceux encore présents (d'autres ont pu être retirés entre-temps)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, quantity, food_key, kind')
      .in('id', pantryIds);
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), t('errors.writeText'));
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert(t('cooked.button'), t('cooked.nothingLeft'));
      return;
    }
    setRows(data.map((row) => {
      const stock = parseQuantity(row.quantity, row.name);
      const recipe = used.find((item) => item.pantry_id === row.id);
      const needed = recipe ? parseQuantity([recipe.quantity, recipe.unit].filter(Boolean).join(' '), row.name) : null;
      return { ...row, stock, computed: stock && needed ? remainingAfter(stock, needed) : null, leftover: null };
    }));
  };

  const update = (id: string, change: (row: PantryRow) => Partial<PantryRow>) =>
    setRows((current) => current?.map((row) => (row.id === id ? { ...row, ...change(row) } : row)) ?? null);

  const setSomeLeft = (row: PantryRow, someLeft: boolean) =>
    update(row.id, () => ({
      leftover: !someLeft ? null : row.computed !== null ? { kind: 'amount', value: row.computed } : { kind: 'half' },
    }));

  const step = (row: PantryRow, direction: 1 | -1) =>
    update(row.id, (current) => {
      if (current.leftover?.kind !== 'amount' || !current.stock) return {};
      const size = stepFor({ value: current.leftover.value, dimension: current.stock.dimension });
      const next = roundTo(current.leftover.value + direction * size, size);
      return { leftover: { kind: 'amount', value: Math.min(Math.max(next, size), current.stock.value) } };
    });

  // Quantité restante enregistrée dans le garde-manger
  const leftoverText = (row: PantryRow): string => {
    const leftover = row.leftover!;
    if (leftover.kind === 'amount') return formatQuantity(leftover.value, row.stock!.unit, language);
    if (leftover.kind === 'half' && row.stock) return formatQuantity(Number((row.stock.value / 2).toFixed(2)), row.stock.unit, language);
    return leftover.kind === 'half' ? t('cooked.halfValue') : t('cooked.aLittleValue');
  };

  const confirm = async () => {
    const all = rows ?? [];
    const usedUp = all.filter((row) => !row.leftover).map((row) => row.id);
    const leftovers = all
      .filter((row) => row.leftover)
      .map((row) => ({ id: row.id, quantity: leftoverText(row) }))
      .filter((item) => item.quantity !== (all.find((row) => row.id === item.id)?.quantity ?? ''));
    setSaving(true);
    // Retirés et comptés « sauvés » ; restes mis à jour sans être comptés
    const { error } = await supabase.rpc('cook_ingredients', { p_ids: usedUp, p_leftovers: leftovers });
    setSaving(false);
    if (error) {
      alertWriteError(t, 'removing cooked ingredients', error);
      return;
    }
    setRows(null);
    notifyPantryChanged();
    const lines = [
      usedUp.length > 0 ? t('cooked.doneSaved', { count: usedUp.length }) : null,
      leftovers.length > 0 ? t('cooked.doneLeft', { count: leftovers.length }) : null,
    ].filter(Boolean);
    Alert.alert(t('cooked.doneTitle'), lines.join('\n') || undefined);
  };

  return (
    <View style={style}>
      <Button label={t('cooked.button')} icon={Check} onPress={open} loading={loading} />

      <BottomSheet visible={rows !== null} onClose={() => setRows(null)}>
        <SheetHeader title={t('cooked.title')} subtitle={t('cooked.subtitle')} onClose={() => setRows(null)} />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {(rows ?? []).map((row, index) => (
            <View key={row.id} style={styles.item}>
              {index > 0 ? <View style={cardStyles.divider} /> : null}
              <View style={styles.itemHeader}>
                <Text style={styles.name} numberOfLines={2}>{foodName(row)}</Text>
                {row.quantity ? <Text style={styles.quantity}>{row.quantity}</Text> : null}
              </View>
              <View style={styles.choices}>
                <Chip label={t('cooked.allUsed')} selected={!row.leftover} onPress={() => setSomeLeft(row, false)} />
                <Chip label={t('cooked.someLeft')} selected={!!row.leftover} onPress={() => setSomeLeft(row, true)} />
              </View>

              {row.leftover?.kind === 'amount' && row.stock ? (
                <View style={styles.stepper}>
                  <StepButton
                    icon={Minus}
                    label={t('cooked.less')}
                    disabled={row.leftover.value <= stepFor({ value: row.leftover.value, dimension: row.stock.dimension })}
                    onPress={() => step(row, -1)}
                  />
                  <Text style={styles.amount} accessibilityLiveRegion="polite">{leftoverText(row)}</Text>
                  <StepButton
                    icon={Plus}
                    label={t('cooked.more')}
                    disabled={row.leftover.value >= row.stock.value}
                    onPress={() => step(row, 1)}
                  />
                </View>
              ) : row.leftover ? (
                <View style={styles.choices}>
                  <Chip label={t('cooked.half')} selected={row.leftover.kind === 'half'} onPress={() => update(row.id, () => ({ leftover: { kind: 'half' } }))} />
                  <Chip label={t('cooked.aLittle')} selected={row.leftover.kind === 'little'} onPress={() => update(row.id, () => ({ leftover: { kind: 'little' } }))} />
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Button label={t('cooked.confirm')} onPress={confirm} loading={saving} style={styles.confirm} />
      </BottomSheet>
    </View>
  );
}

function StepButton({ icon: Icon, label, disabled, onPress }: { icon: typeof Plus; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={[styles.stepButton, disabled && styles.stepButtonDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={sizes.icon} color={colors.primary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  item: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  name: {
    ...typography.listTitle,
    flex: 1,
  },
  quantity: {
    ...typography.secondary,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: opacity.disabled,
  },
  amount: {
    ...typography.cardTitle,
    minWidth: sizes.thumbnail,
    textAlign: 'center',
  },
  confirm: {
    marginTop: spacing.lg,
  },
});
