import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { useFoodNames } from '@/lib/foodNames';
import { loadPantry } from '@/lib/pantry';
import { consumeOldestFirst, findExisting, groupLots, lotsStock, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { formatQuantity, parseQuantity, stepOf, usedFromRecipe, type Quantity } from '@/lib/quantity';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Toast } from '@/components/ui/Toast';
import { StepButton } from '@/components/ui/StepButton';
import { colors, sizes, spacing, typography } from '@/constants/theme';

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
// la recette ou entre les lots, « Tout », « La moitié » ou « Un peu »
type Used = { kind: 'amount'; value: number } | { kind: 'all' } | { kind: 'half' } | { kind: 'little' };

// Un aliment du garde-manger (tous ses lots) utilisé par la recette
interface CookRow {
  key: string;
  group: LotGroup<PantryIngredient>;
  // Quantité totale des lots (null : pas calculable)
  stock: Quantity | null;
  used: Used;
}

// Changements de la validation : lots finis et lots entamés
interface Cooking {
  id: string;
  usedUp: string[];
  leftovers: { id: string; quantity: string }[];
}

// « J'ai cuisiné ça » : pour chaque aliment du garde-manger utilisé par la recette, la quantité utilisée,
// préremplie avec celle de la recette ; en dessous, ce qu'il en restera. La quantité est prise du lot le plus
// ancien au plus récent : les lots finis sont retirés et comptés « sauvés », un lot entamé garde sa date et
// prend la quantité restante. Enregistré tout de suite, puis « Retiré du garde-manger · Annuler » pendant
// 5 secondes (état d'avant rétabli par le serveur, tous les lots compris).
export function CookedButton({ ingredientsUsed, style }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<CookRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const foodName = useFoodNames(rows?.map((row) => row.group.first));

  const cooking = useUndoableAction<Cooking>({
    label: 'removing cooked ingredients',
    // Retirés et comptés « sauvés » ; lots entamés mis à jour sans être comptés
    perform: async ({ usedUp, leftovers }) => {
      const { data, error } = await supabase.rpc('cook_with_undo', { p_ids: usedUp, p_leftovers: leftovers });
      if (error) throw error;
      return data as string;
    },
    onDone: () => notifyPantryChanged(),
    onUndone: () => notifyPantryChanged(),
  });

  const used = (ingredientsUsed ?? []).filter((item) => !!item?.pantry_id);
  // Recettes d'avant la phase 3 : pas d'identifiants, rien à retirer
  if (used.length === 0) return null;

  const open = async () => {
    setLoading(true);
    const pantry = await loadPantry();
    setLoading(false);
    if (!pantry) {
      Alert.alert(t('common.error'), t('errors.writeText'));
      return;
    }
    // Aliment de chaque ingrédient de la recette : celui du lot choisi à la génération, ou, s'il n'est plus
    // là, le même aliment ajouté depuis
    const groups = groupLots(pantry);
    const found = new Map<string, CookRow>();
    for (const item of used) {
      const group = groups.find((candidate) => candidate.lots.some((lot) => lot.id === item.pantry_id))
        ?? findExisting(groups, { name: item.name, quantity: '', kind: 'ingredient', expires_at: null });
      if (!group || found.has(group.key)) continue;
      const stock = lotsStock(group.lots);
      const needed = parseQuantity([item.quantity, item.unit].filter(Boolean).join(' '), group.first.name);
      const amount = usedFromRecipe(stock, needed);
      found.set(group.key, { key: group.key, group, stock, used: amount !== null ? { kind: 'amount', value: amount } : { kind: 'all' } });
    }
    if (found.size === 0) {
      Alert.alert(t('cooked.button'), t('cooked.nothingLeft'));
      return;
    }
    setRows([...found.values()]);
  };

  const setUsed = (key: string, next: Used) =>
    setRows((current) => current?.map((row) => (row.key === key ? { ...row, used: next } : row)) ?? null);

  const step = (row: CookRow, direction: 1 | -1) => {
    if (row.used.kind !== 'amount' || !row.stock) return;
    const size = stepOf(row.stock);
    const next = Math.round((row.used.value + direction * size) / size) * size;
    setUsed(row.key, { kind: 'amount', value: Number(Math.min(Math.max(next, 0), row.stock.value).toFixed(3)) });
  };

  // Lots finis et lots entamés pour la quantité choisie
  const changesOf = (row: CookRow): { usedUp: string[]; leftovers: { id: string; quantity: string }[] } => {
    const { used: value, stock, group } = row;
    if (value.kind === 'all') return { usedUp: group.lots.map((lot) => lot.id), leftovers: [] };
    if (value.kind === 'little') return { usedUp: [], leftovers: [] };
    if (value.kind === 'amount') return consumeOldestFirst(group.lots, value.value, language);
    // La moitié : du plus ancien au plus récent si le total se calcule, sinon chaque lot de moitié
    if (stock) return consumeOldestFirst(group.lots, stock.value / 2, language);
    return {
      usedUp: [],
      leftovers: group.lots.map((lot) => {
        const quantity = parseQuantity(lot.quantity, lot.name);
        return { id: lot.id, quantity: quantity ? formatQuantity(Number((quantity.value / 2).toFixed(2)), quantity.unit, language) : t('cooked.halfValue') };
      }),
    };
  };

  // Ce qu'il restera : null si l'aliment est fini (retiré), '' si rien ne change, sinon la quantité restante
  const remaining = (row: CookRow): string | null => {
    const { used: value, stock } = row;
    if (value.kind === 'all') return null;
    if (value.kind === 'little') return '';
    if (value.kind === 'half') return stock ? formatQuantity(Number((stock.value / 2).toFixed(2)), stock.unit, language) : t('cooked.halfValue');
    if (!stock) return '';
    const left = Number((stock.value - value.value).toFixed(3));
    if (left <= 0) return null;
    return value.value === 0 ? '' : formatQuantity(left, stock.unit, language);
  };

  const remainingLine = (row: CookRow): string => {
    const left = remaining(row);
    if (left === null) return t('cooked.noneLeft');
    if (left === '') return row.used.kind === 'little' ? t('cooked.mostRemains') : t('cooked.willRemain', { quantity: totalLabel(row.group.lots, language) });
    return t('cooked.willRemain', { quantity: left });
  };

  const changes = (rows ?? []).filter((row) => remaining(row) !== '');

  // Enregistré avant de fermer la fiche : en cas d'échec (hors connexion), erreur et fiche gardée ouverte
  const confirm = async () => {
    const all = changes.map(changesOf);
    const usedUp = all.flatMap((change) => change.usedUp);
    const leftovers = all.flatMap((change) => change.leftovers);
    if (usedUp.length + leftovers.length === 0) return setRows(null);
    setSaving(true);
    const saved = await cooking.run({ id: `cooking-${Date.now()}`, usedUp, leftovers });
    setSaving(false);
    if (saved) setRows(null);
  };

  return (
    <View style={style}>
      <Toast message={cooking.pending ? t('cooked.removed') : null} actionLabel={t('common.undo')} onAction={cooking.undo} bottom="100%" />
      <Button label={t('cooked.button')} icon={Check} onPress={open} loading={loading} />

      <BottomSheet visible={rows !== null} onClose={() => setRows(null)}>
        <SheetHeader title={t('cooked.title')} subtitle={t('cooked.subtitle')} onClose={() => setRows(null)} />
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {(rows ?? []).map((row, index) => (
            <View key={row.key} style={styles.item}>
              {index > 0 ? <View style={cardStyles.divider} /> : null}
              <View style={styles.itemHeader}>
                <Text style={styles.name} numberOfLines={2}>{foodName(row.group.first)}</Text>
                <Text style={styles.quantity}>
                  {[totalLabel(row.group.lots, language), row.group.lots.length > 1 ? t('lots.count', { count: row.group.lots.length }) : null].filter(Boolean).join(' · ')}
                </Text>
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
                    <Chip label={t('cooked.all')} selected={row.used.kind === 'all'} onPress={() => setUsed(row.key, { kind: 'all' })} />
                    <Chip label={t('cooked.half')} selected={row.used.kind === 'half'} onPress={() => setUsed(row.key, { kind: 'half' })} />
                    <Chip label={t('cooked.aLittle')} selected={row.used.kind === 'little'} onPress={() => setUsed(row.key, { kind: 'little' })} />
                  </View>
                )}
              </View>
              <Text style={[styles.remaining, remaining(row) === null && styles.removed]}>{remainingLine(row)}</Text>
              {row.group.lots.length > 1 && remaining(row) !== '' && remaining(row) !== null ? (
                <Text style={styles.remaining}>{t('lots.oldestFirst')}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <Button
          label={changes.length > 0 ? t('cooked.confirm', { count: changes.length }) : t('common.close')}
          variant={changes.length > 0 ? 'primary' : 'outline'}
          onPress={confirm}
          loading={saving}
          style={styles.confirm}
        />
      </BottomSheet>
    </View>
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
