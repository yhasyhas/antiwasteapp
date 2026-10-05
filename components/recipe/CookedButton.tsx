import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Minus, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { useFoodNames } from '@/lib/foodNames';
import { formatDate, isToday, localDateOf, shortDate } from '@/lib/expiry';
import { addPantryItems, loadPantry } from '@/lib/pantry';
import { frozenExpiry, wasThawed } from '@/lib/storage';
import { alertWriteError } from '@/lib/alertWriteError';
import { consumeOldestFirst, findExisting, foodIdentity, groupLots, lotsStock, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { formatQuantity, parseQuantity, stepOf, usedFromRecipe, type Quantity } from '@/lib/quantity';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { QuantityField } from '@/components/pantry/QuantityField';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Toast } from '@/components/ui/Toast';
import { Touchable } from '@/components/ui/Touchable';
import { StepButton } from '@/components/ui/StepButton';
import { colors, motion, sizes, spacing, typography } from '@/constants/theme';
import { showDialog } from '@/lib/dialog';

interface UsedIngredient {
  name: string;
  quantity?: string;
  unit?: string;
  // Relie un ingrédient de la recette à celui du garde-manger (depuis la phase 3)
  pantry_id?: string | null;
}

interface Props {
  ingredientsUsed: UsedIngredient[] | null | undefined;
  // Recette enregistrée : le repas lui est relié (« Cuisiné aujourd'hui », « Modifier », « Cuisinée le … »)
  recipeId?: string | null;
  // Nom du plat (restes congelés après le repas)
  recipeTitle?: string;
  // Conteneur du bouton (barre fixée en bas de la fiche recette)
  style?: StyleProp<ViewStyle>;
  // Fin du mode cuisine (« C'est prêt ! ») : la feuille s'ouvre tout de suite
  openOnMount?: boolean;
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

// Quantités saisies, gardées avec l'action pour rouvrir la feuille (« Modifier »)
type Inputs = { rows: { key: string; used: Used }[] };

// Changements de la validation : lots finis et lots entamés
interface Cooking {
  id: string;
  usedUp: string[];
  leftovers: { id: string; quantity: string }[];
  inputs: Inputs;
}

// Dernière action « J'ai cuisiné ça » de la recette, encore modifiable (24 heures)
interface LastCook {
  id: string;
  created_at: string;
  removed: PantryIngredient[];
  updated: { before: PantryIngredient; after: PantryIngredient }[];
  inputs: Inputs | null;
}

// Feuille ouverte : nouveau repas, ou correction du dernier
type Mode = { kind: 'new' } | { kind: 'modify'; action: LastCook };

// « J'ai cuisiné ça » : pour chaque aliment du garde-manger utilisé par la recette, la quantité utilisée,
// préremplie avec celle de la recette ; en dessous, ce qu'il en restera. La quantité est prise du lot le plus
// ancien au plus récent : les lots finis sont retirés et comptés « sauvés », un lot entamé garde sa date et
// prend la quantité restante. Enregistré tout de suite, puis « Retiré du garde-manger · Annuler » (état d'avant
// rétabli par le serveur, tous les lots compris).
// Recette enregistrée : ensuite « ✓ Cuisiné aujourd'hui » (grisé), récapitulatif avant / après de chaque
// aliment, « Modifier » (feuille rouverte avec les quantités saisies ; la correction remplace l'action en une
// seule opération, conflit compris) et « Je l'ai cuisinée à nouveau » (vrai deuxième repas).
export function CookedButton({ ingredientsUsed, recipeId, recipeTitle, style, openOnMount = false }: Props) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<CookRow[] | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'new' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastCook, setLastCook] = useState<LastCook | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Restes du plat au congélateur : quantité saisie (feuille ouverte), puis date une fois congelés
  const [leftovers, setLeftovers] = useState<string | null>(null);
  const [savingLeftovers, setSavingLeftovers] = useState(false);
  const [leftoversFrozenUntil, setLeftoversFrozenUntil] = useState<string | null>(null);
  const recapLots = lastCook ? [...lastCook.removed, ...lastCook.updated.map((change) => change.before)] : [];
  const foodName = useFoodNames([...(rows?.map((row) => row.group.first) ?? []), ...recapLots]);

  // Dernière action modifiable de la recette (la mienne, moins de 24 heures)
  const loadLastCook = useCallback(async () => {
    if (!recipeId) return;
    const { data, error } = await supabase.rpc('last_cook_action', { p_recipe_id: recipeId });
    if (error) {
      console.warn('[cuisiné] dernière action illisible :', error.message);
      return;
    }
    setLastCook((data as LastCook[] | null)?.[0] ?? null);
  }, [recipeId]);
  useEffect(() => {
    loadLastCook();
  }, [loadLastCook]);
  // « Correction enregistrée » : message bref
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), motion.undoWindow);
    return () => clearTimeout(timer);
  }, [notice]);

  const cooking = useUndoableAction<Cooking>({
    label: 'removing cooked ingredients',
    // Retirés et comptés « sauvés » ; lots entamés mis à jour sans être comptés ; repas relié à la recette
    perform: async ({ usedUp, leftovers, inputs }) => {
      const { data, error } = await supabase.rpc('cook_with_undo', {
        p_ids: usedUp, p_leftovers: leftovers, p_recipe_id: recipeId ?? null, p_inputs: inputs,
      });
      if (error) throw error;
      return data as string;
    },
    onDone: () => {
      notifyPantryChanged();
      loadLastCook();
    },
    onUndone: () => {
      notifyPantryChanged();
      loadLastCook();
    },
  });

  const used = (ingredientsUsed ?? []).filter((item) => !!item?.pantry_id);
  // Recettes d'avant la phase 3 : pas d'identifiants, rien à retirer
  if (used.length === 0) return null;

  // Lignes de la feuille à partir d'un garde-manger (actuel, ou celui d'avant le repas pour « Modifier »)
  const rowsFrom = (pantry: PantryIngredient[], inputs: Inputs | null): CookRow[] => {
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
      const saved = inputs?.rows.find((row) => row.key === group.key)?.used;
      const valid = saved && (saved.kind !== 'amount' || (stock && saved.value <= stock.value));
      found.set(group.key, {
        key: group.key, group, stock,
        used: valid ? saved : amount !== null ? { kind: 'amount', value: amount } : { kind: 'all' },
      });
    }
    return [...found.values()];
  };

  const open = async (next: Mode = { kind: 'new' }) => {
    setLoading(true);
    const pantry = await loadPantry();
    setLoading(false);
    if (!pantry) {
      showDialog(t('common.error'), t('errors.writeText'));
      return;
    }
    let base = pantry;
    if (next.kind === 'modify') {
      // Garde-manger d'avant le repas : lots entamés à leur quantité d'avant, lots finis de retour
      const before = new Map(next.action.updated.map((change) => [change.before.id, change.before]));
      base = [...pantry.filter((lot) => !before.has(lot.id)), ...before.values(), ...next.action.removed];
    }
    const found = rowsFrom(base, next.kind === 'modify' ? next.action.inputs : null);
    if (found.length === 0) {
      showDialog(t('cooked.button'), t('cooked.nothingLeft'));
      return;
    }
    setMode(next);
    setRows(found);
  };

  useEffect(() => {
    if (openOnMount) open();
  }, []);

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

  // Correction : l'action précédente remplacée en une seule opération (rien ne change en cas de refus)
  const modify = async (action: LastCook, usedUp: string[], leftovers: { id: string; quantity: string }[], inputs: Inputs) => {
    const { data, error } = await supabase.rpc('modify_cook_action', {
      p_action_id: action.id, p_ids: usedUp, p_leftovers: leftovers, p_inputs: inputs,
    });
    if (error) {
      showDialog(t('cookedMore.modifyTitle'), t('undo.failedText'));
      return false;
    }
    const status = (data as { status: string }).status;
    notifyPantryChanged();
    await loadLastCook();
    if (status === 'modified' || status === 'undone') {
      setNotice(t('cookedMore.modified'));
      return true;
    }
    showDialog(t('cookedMore.modifyTitle'), status === 'conflict' ? t('undo.conflictText') : status === 'expired' ? t('undo.expiredText') : t('undo.failedText'));
    return status !== 'conflict';
  };

  // Enregistré avant de fermer la fiche : en cas d'échec (hors connexion), erreur et fiche gardée ouverte
  const confirm = async () => {
    const all = changes.map(changesOf);
    const usedUp = all.flatMap((change) => change.usedUp);
    const leftovers = all.flatMap((change) => change.leftovers);
    const inputs: Inputs = { rows: (rows ?? []).map((row) => ({ key: row.key, used: row.used })) };
    setSaving(true);
    let saved: boolean;
    if (mode.kind === 'modify') {
      saved = await modify(mode.action, usedUp, leftovers, inputs);
    } else if (usedUp.length + leftovers.length === 0) {
      saved = true;
    } else {
      saved = await cooking.run({ id: `cooking-${Date.now()}`, usedUp, leftovers, inputs });
    }
    setSaving(false);
    if (saved) setRows(null);
  };

  // Récapitulatif du dernier repas : avant → après de chaque aliment (« Tomates : 4 → 1 », « Riz : fini »)
  const recap = (() => {
    if (!lastCook) return [];
    const foods = new Map<string, { before: PantryIngredient[]; after: PantryIngredient[] }>();
    const entry = (lot: PantryIngredient) => {
      const key = foodIdentity(lot.name);
      if (!foods.has(key)) foods.set(key, { before: [], after: [] });
      return foods.get(key)!;
    };
    for (const lot of lastCook.removed) entry(lot).before.push(lot);
    for (const change of lastCook.updated) {
      entry(change.before).before.push(change.before);
      entry(change.before).after.push(change.after);
    }
    return [...foods.values()].map(({ before, after }) => ({
      name: foodName(before[0]),
      line: `${totalLabel(before, language)} → ${after.length > 0 ? totalLabel(after, language) : t('cookedMore.finished')}`,
    }));
  })();
  const cookedLabel = lastCook
    ? isToday(lastCook.created_at) ? t('cookedMore.doneToday') : `✓ ${t('cookedMore.cookedOn', { date: shortDate(localDateOf(lastCook.created_at), language) })}`
    : null;
  const showConfirmed = lastCook && !cooking.pending;
  // Repas avec un aliment décongelé : congeler les restes du plat est mis en avant (l'aliment ne se recongèle
  // pas cru)
  const thawedUsed = recapLots.some(wasThawed);
  const leftoversExpiry = frozenExpiry(null, 'dish');

  const freezeLeftovers = async () => {
    if (!recipeTitle || leftovers === null) return;
    setSavingLeftovers(true);
    try {
      await addPantryItems([{
        name: recipeTitle,
        quantity: leftovers.trim(),
        kind: 'dish',
        expires_at: leftoversExpiry,
        added_via: 'manual',
        choice: 'separate',
        location: 'freezer',
        date_kind: 'best_before',
        expiry_estimated: true,
      }], [], language);
      notifyPantryChanged();
      setLeftovers(null);
      setLeftoversFrozenUntil(leftoversExpiry);
    } catch (error) {
      alertWriteError(t, 'freezing leftovers', error);
    } finally {
      setSavingLeftovers(false);
    }
  };
  const openLeftovers = () => setLeftovers(formatQuantity(1, 'portion', language));

  return (
    <View style={style}>
      <Toast message={cooking.pending ? t('cooked.removed') : notice} actionLabel={cooking.pending ? t('common.undo') : undefined} onAction={cooking.pending ? cooking.undo : undefined} inset={false} />
      {showConfirmed ? (
        <View style={styles.confirmed}>
          <Button label={cookedLabel!} variant="soft" size="medium" disabled onPress={() => undefined} />
          {/* Récapitulatif compact (la barre du bas ne doit pas couvrir la recette) */}
          {recap.length > 0 ? (
            <Text
              style={styles.recapLine}
              numberOfLines={3}
              accessibilityLabel={`${t('cookedMore.recapTitle')} : ${recap.map((item) => `${item.name} ${item.line}`).join(', ')}`}
            >
              {recap.map((item) => `${item.name} : ${item.line}`).join(' · ')}
            </Text>
          ) : null}
          {recipeTitle && thawedUsed && !leftoversFrozenUntil ? (
            <>
              <Text style={styles.recapLine}>{t('cookedMore.freezeLeftoversHint')}</Text>
              <Button label={t('cookedMore.freezeLeftovers')} variant="outline" size="medium" onPress={openLeftovers} />
            </>
          ) : null}
          {leftoversFrozenUntil ? (
            <Text style={styles.recapLine}>{t('cookedMore.leftoversDone', { date: formatDate(leftoversFrozenUntil, language) })}</Text>
          ) : null}
          <View style={styles.links}>
            <Touchable onPress={() => open({ kind: 'modify', action: lastCook })} style={styles.link} accessibilityRole="button">
              <Text style={styles.linkText}>{t('cookedMore.modify')}</Text>
            </Touchable>
            {recipeTitle && !thawedUsed && !leftoversFrozenUntil ? (
              <Touchable onPress={openLeftovers} style={styles.link} accessibilityRole="button">
                <Text style={styles.linkSecondary}>{t('cookedMore.freezeLeftovers')}</Text>
              </Touchable>
            ) : null}
            <Touchable onPress={() => open()} style={styles.link} accessibilityRole="button">
              <Text style={styles.linkSecondary}>{t('cookedMore.cookAgain')}</Text>
            </Touchable>
          </View>
        </View>
      ) : (
        <Button label={t('cooked.button')} icon={Check} onPress={() => open()} loading={loading} />
      )}

      {/* Restes du plat au congélateur, comme un reste : date du congélateur, conseil */}
      <BottomSheet visible={leftovers !== null} onClose={() => setLeftovers(null)} keyboard>
        <SheetHeader title={t('cookedMore.leftoversTitle')} subtitle={recipeTitle} onClose={() => setLeftovers(null)} />
        <View style={styles.leftovers}>
          <QuantityField
            label={t('cookedMore.leftoversQuantity')}
            value={leftovers ?? ''}
            onChange={setLeftovers}
            itemName={recipeTitle ?? ''}
          />
          <Text style={styles.remaining}>{t('storage.frozenDone', { date: formatDate(leftoversExpiry, language) })}</Text>
          <Text style={styles.remaining}>{t('storage.freezeTip_dish')}</Text>
        </View>
        <Button label={t('cookedMore.leftoversConfirm')} onPress={freezeLeftovers} loading={savingLeftovers} style={styles.confirm} />
      </BottomSheet>

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
          label={mode.kind === 'modify' ? t('cookedMore.saveModification') : changes.length > 0 ? t('cooked.confirm', { count: changes.length }) : t('common.close')}
          variant={mode.kind === 'modify' || changes.length > 0 ? 'primary' : 'outline'}
          onPress={confirm}
          loading={saving}
          style={styles.confirm}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmed: {
    gap: spacing.xs,
  },
  recapLine: {
    ...typography.secondary,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  link: {
    minHeight: sizes.touch,
    justifyContent: 'center',
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  linkSecondary: {
    ...typography.secondary,
    textDecorationLine: 'underline',
  },
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
  leftovers: {
    gap: spacing.md,
  },
});
