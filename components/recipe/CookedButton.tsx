import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { useFoodNames } from '@/lib/foodNames';
import { formatQuantity, parseQuantity, stepOf, usedFromRecipe, type Quantity } from '@/lib/quantity';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Toast } from '@/components/ui/Toast';
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

// Quantité utilisée : un nombre dans l'unité du garde-manger (réglé avec + et −), ou, sans unité commune avec
// la recette, « Tout », « La moitié » ou « Un peu »
type Used = { kind: 'amount'; value: number } | { kind: 'all' } | { kind: 'half' } | { kind: 'little' };

interface PantryRow {
  id: string;
  name: string;
  quantity: string | null;
  food_key: string | null;
  kind: string | null;
  // Quantité du garde-manger lue (null : pas de nombre)
  stock: Quantity | null;
  used: Used;
}

// Changements enregistrés 5 secondes après la validation (message « Annuler ») : retirés et restes
interface Cooking {
  id: string;
  usedUp: string[];
  leftovers: { id: string; quantity: string }[];
}

// « J'ai cuisiné ça » : pour chaque ingrédient du garde-manger utilisé par la recette, la quantité utilisée,
// préremplie avec celle de la recette ; en dessous, ce qu'il en restera. Les aliments finis sont retirés et
// comptés « sauvés », les autres gardent leur date et prennent la quantité restante. Rien n'est enregistré
// avant la fin du message « Retiré du garde-manger · Annuler » (5 secondes).
export function CookedButton({ ingredientsUsed, style }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<PantryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const foodName = useFoodNames(rows);

  const cooking = useUndoableDelete<Cooking>(async ({ usedUp, leftovers }) => {
    // Retirés et comptés « sauvés » ; restes mis à jour sans être comptés
    const { error } = await supabase.rpc('cook_ingredients', { p_ids: usedUp, p_leftovers: leftovers });
    if (error) {
      alertWriteError(t, 'removing cooked ingredients', error);
      throw error;
    }
    notifyPantryChanged();
  });

  const used = (ingredientsUsed ?? []).filter((item) => !!item?.pantry_id);
  const pantryIds = [...new Set(used.map((item) => item.pantry_id as string))];
  // Recettes d'avant la phase 3 : pas d'identifiants, rien à retirer
  if (pantryIds.length === 0) return null;

  const open = async () => {
    // Validation précédente encore annulable : enregistrée d'abord
    cooking.flush();
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
      const amount = usedFromRecipe(stock, needed);
      return { ...row, stock, used: amount !== null ? { kind: 'amount', value: amount } : { kind: 'all' } };
    }));
  };

  const setUsed = (id: string, next: Used) =>
    setRows((current) => current?.map((row) => (row.id === id ? { ...row, used: next } : row)) ?? null);

  const step = (row: PantryRow, direction: 1 | -1) => {
    if (row.used.kind !== 'amount' || !row.stock) return;
    const size = stepOf(row.stock);
    const next = Math.round((row.used.value + direction * size) / size) * size;
    setUsed(row.id, { kind: 'amount', value: Number(Math.min(Math.max(next, 0), row.stock.value).toFixed(3)) });
  };

  // Ce qu'il restera : null si l'aliment est fini (retiré), '' si rien ne change, sinon la quantité restante
  const remaining = (row: PantryRow): string | null => {
    const { used: value, stock } = row;
    if (value.kind === 'all') return null;
    if (value.kind === 'little') return '';
    if (value.kind === 'half') return stock ? formatQuantity(Number((stock.value / 2).toFixed(2)), stock.unit, language) : t('cooked.halfValue');
    if (!stock) return '';
    const left = Number((stock.value - value.value).toFixed(3));
    if (left <= 0) return null;
    return value.value === 0 ? '' : formatQuantity(left, stock.unit, language);
  };

  const remainingLine = (row: PantryRow): string => {
    const left = remaining(row);
    if (left === null) return t('cooked.noneLeft');
    if (left === '') return row.used.kind === 'little' ? t('cooked.mostRemains') : t('cooked.willRemain', { quantity: row.quantity ?? '' });
    return t('cooked.willRemain', { quantity: left });
  };

  const changes = (rows ?? []).map((row) => ({ row, left: remaining(row) })).filter(({ left }) => left !== '');

  const confirm = () => {
    const usedUp = changes.filter(({ left }) => left === null).map(({ row }) => row.id);
    const leftovers = changes.filter(({ left }) => left !== null).map(({ row, left }) => ({ id: row.id, quantity: left as string }));
    setRows(null);
    if (usedUp.length + leftovers.length > 0) cooking.remove({ id: `cooking-${Date.now()}`, usedUp, leftovers });
  };

  return (
    <View style={style}>
      <Toast message={cooking.pending ? t('cooked.removed') : null} actionLabel={t('common.undo')} onAction={cooking.undo} bottom="100%" />
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

              <View style={styles.usedRow}>
                <Text style={styles.usedLabel}>{t('cooked.used')}</Text>
                {row.used.kind === 'amount' && row.stock ? (
                  <View style={styles.stepper}>
                    <StepButton icon={Minus} label={t('cooked.less')} disabled={row.used.value <= 0} onPress={() => step(row, -1)} />
                    <Text style={styles.amount} accessibilityLiveRegion="polite">{formatQuantity(row.used.value, row.stock.unit, language)}</Text>
                    <StepButton icon={Plus} label={t('cooked.more')} disabled={row.used.value >= row.stock.value} onPress={() => step(row, 1)} />
                  </View>
                ) : (
                  <View style={styles.choices}>
                    <Chip label={t('cooked.all')} selected={row.used.kind === 'all'} onPress={() => setUsed(row.id, { kind: 'all' })} />
                    <Chip label={t('cooked.half')} selected={row.used.kind === 'half'} onPress={() => setUsed(row.id, { kind: 'half' })} />
                    <Chip label={t('cooked.aLittle')} selected={row.used.kind === 'little'} onPress={() => setUsed(row.id, { kind: 'little' })} />
                  </View>
                )}
              </View>
              <Text style={[styles.remaining, remaining(row) === null && styles.removed]}>{remainingLine(row)}</Text>
            </View>
          ))}
        </ScrollView>
        <Button
          label={changes.length > 0 ? t('cooked.confirm', { count: changes.length }) : t('common.close')}
          variant={changes.length > 0 ? 'primary' : 'outline'}
          onPress={confirm}
          style={styles.confirm}
        />
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
    gap: spacing.sm,
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
  usedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  usedLabel: {
    ...typography.bodyMedium,
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
  remaining: {
    ...typography.secondary,
  },
  removed: {
    color: colors.expired.text,
  },
  confirm: {
    marginTop: spacing.lg,
  },
});
