import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Camera, Plus, Search, ShoppingCart, Users } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Illustrations';
import { ScreenHeader, SquareButton } from '@/components/ui/ScreenHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { ListItemMotion } from '@/components/ui/ListItemMotion';
import { Toast } from '@/components/ui/Toast';
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { IngredientCard, type PantryIngredient } from '@/components/pantry/IngredientCard';
import { ExpiryEditModal } from '@/components/pantry/ExpiryEditModal';
import { FoodFactSheet } from '@/components/pantry/FoodFactSheet';
import { LotsSheet } from '@/components/pantry/LotsSheet';
import { expiryStatus, sortByUrgency } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged, onPantryChanged } from '@/lib/pantryEvents';
import { loadPantry } from '@/lib/pantry';
import { groupLots, lotsStock, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { formatQuantity } from '@/lib/quantity';
import { activeHouseholdId, addedByLabel } from '@/lib/household';
import { useHousehold } from '@/hooks/useHousehold';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { linkPantryFoodKeys, useFoodNames } from '@/lib/foodNames';
import { colors, motion, radius, shadows, sizes, spacing, typography } from '@/constants/theme';

type Filter = 'all' | 'urgent' | 'leftovers';
type Group = LotGroup<PantryIngredient> & { total?: string };

// Ligne urgente : son lot le plus ancien est périmé ou proche de sa date
const isUrgent = (group: Group) => {
  const status = expiryStatus(group.first.expires_at);
  return status === 'expired' || status === 'soon';
};

// Suppression annulable : un aliment entier (tous ses lots) ou un seul lot
interface Removal {
  // Clé de la ligne, ou identifiant du lot
  id: string;
  ids: string[];
  lot: boolean;
}

interface Merge {
  id: string;
  target: string;
  others: string[];
  quantity: string;
}

export default function IngredientsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [ingredients, setIngredients] = useState<PantryIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingExpiry, setEditingExpiry] = useState<PantryIngredient | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const household = useHousehold();
  const foodName = useFoodNames(ingredients);
  // Fiche de l'aliment touché ; détail des lots (clé de la ligne)
  const [factIngredient, setFactIngredient] = useState<PantryIngredient | null>(null);
  const [lotsKey, setLotsKey] = useState<string | null>(null);

  // Garde-manger partagé : rechargé quand un membre le modifie (temps réel) ou qu'on change de foyer
  useEffect(() => onPantryChanged(loadIngredients), [user]);

  // Rechargé à chaque retour sur l'onglet (ingrédients ajoutés depuis la caméra, par exemple)
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, [user])
  );

  const loadIngredients = async () => {
    if (!user) return;
    // Squelettes au premier chargement seulement ; les rechargements se font en arrière-plan
    const data = await loadPantry();
    // Par urgence : expirés et proches d'abord, sans date à la fin
    if (data) setIngredients(sortByUrgency(data));
    setLoading(false);
    // Aliments ajoutés sans identifiant (ajout manuel, code-barres, courses) : reliés à leur fiche
    if (data?.some((row) => !row.food_key && row.kind !== 'dish')) linkPantryFoodKeys();
  };

  // Suppression enregistrée tout de suite, annulable (« Aliment retiré · Annuler », « Lot retiré ») : les lots
  // reviennent tels quels et le compteur est rétabli
  const removal = useUndoableAction<Removal>({
    label: 'deleting ingredient',
    perform: async ({ ids }) => {
      const { data, error } = await supabase.rpc('delete_ingredients_with_undo', { p_ids: ids });
      if (error) throw error;
      return data as string;
    },
    onDone: ({ ids }) => {
      setIngredients((current) => current.filter((ing) => !ids.includes(ing.id)));
      notifyPantryChanged();
    },
    onUndone: () => {
      loadIngredients();
      notifyPantryChanged();
    },
  });

  // Fusion de lots de même date et même unité, annulable
  const merging = useUndoableAction<Merge>({
    label: 'merging lots',
    perform: async ({ target, others, quantity }) => {
      const { data, error } = await supabase.rpc('merge_lots', { p_target: target, p_others: others, p_quantity: quantity });
      if (error) throw error;
      return data as string;
    },
    onDone: () => {
      loadIngredients();
      notifyPantryChanged();
    },
    onUndone: () => {
      loadIngredients();
      notifyPantryChanged();
    },
  });

  // Renvoie vrai si la date est enregistrée
  const saveLotExpiry = async (lot: PantryIngredient, expiresAt: string | null): Promise<boolean> => {
    const { error } = await supabase
      .from('ingredients')
      .update({ expires_at: expiresAt })
      .eq('id', lot.id);
    if (error) {
      alertWriteError(t, 'updating expiry date', error);
      return false;
    }
    setIngredients((current) => sortByUrgency(current.map((ing) => ing.id === lot.id ? { ...ing, expires_at: expiresAt } : ing)));
    notifyPantryChanged();
    if (expiresAt) await maybeAskNotificationPermission();
    return true;
  };

  const saveExpiry = async (expiresAt: string | null) => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const saved = await saveLotExpiry(editingExpiry, expiresAt);
    setSavingExpiry(false);
    if (saved) setEditingExpiry(null);
  };

  const clearAllIngredients = () => {
    Alert.alert(
      t('pantry.clearTitle'),
      t('pantry.clearText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('pantry.clearTitle'),
          style: 'destructive',
          onPress: async () => {
            const householdId = await activeHouseholdId();
            if (!user || !householdId) return;

            setLoading(true);
            const { error } = await supabase
              .from('ingredients')
              .delete()
              .eq('household_id', householdId);

            if (error) {
              alertWriteError(t, 'clearing ingredients', error);
            } else {
              setIngredients([]);
              notifyPantryChanged();
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  // Une ligne par aliment, avec sa quantité totale, recalculée seulement quand le garde-manger change (pas à
  // chaque lettre de la recherche). Lots en cours de suppression : déjà cachés (reviennent si l'enregistrement
  // échoue).
  const allGroups = useMemo(() => {
    const lots = ingredients.filter((ingredient) => !removal.hiddenIds.has(ingredient.id));
    return groupLots(lots)
      .filter((group) => !removal.hiddenIds.has(group.key))
      .map((group) => ({ ...group, total: totalLabel(group.lots, language) }));
  }, [ingredients, removal.hiddenIds, language]);
  const query = searchQuery.trim().toLowerCase();
  const searched = query
    ? allGroups.filter((group) => foodName(group.first).toLowerCase().includes(query) || group.lots.some((lot) => lot.name.toLowerCase().includes(query)))
    : allGroups;
  const counts = {
    all: searched.length,
    urgent: searched.filter(isUrgent).length,
    leftovers: searched.filter((group) => group.first.kind === 'dish').length,
  };
  const visible = searched.filter((group) =>
    filter === 'urgent' ? isUrgent(group) : filter === 'leftovers' ? group.first.kind === 'dish' : true,
  );
  const sections = [
    { key: 'urgent', title: t('pantry.groupUrgent'), items: visible.filter(isUrgent), color: colors.expired.text },
    { key: 'later', title: t('pantry.groupLater'), items: visible.filter((group) => !isUrgent(group)), color: colors.textSecondary },
  ].filter((section) => section.items.length > 0);

  const lotsGroup = lotsKey ? allGroups.find((group) => group.key === lotsKey) ?? null : null;
  const removeGroup = (group: Group) => removal.run({ id: group.key, ids: group.lots.map((lot) => lot.id), lot: false });

  // Fiche de l'aliment depuis le détail des lots : la feuille des lots se ferme d'abord
  const openFactFromLots = (group: Group) => {
    setLotsKey(null);
    setTimeout(() => setFactIngredient(group.first), motion.normal);
  };

  const mergeLots = (same: PantryIngredient[]) => {
    const stock = lotsStock(same);
    if (!stock) return;
    const [target, ...others] = same;
    merging.run({ id: `merge-${target.id}`, target: target.id, others: others.map((lot) => lot.id), quantity: formatQuantity(stock.value, stock.unit, language) });
  };

  const renderCard = (group: Group, index: number) => {
    const multiple = group.lots.length > 1;
    return (
      <ListItemMotion key={group.key} index={index}>
        <IngredientCard
          ingredient={group.first}
          displayName={foodName(group.first)}
          quantityLabel={group.total}
          lotCount={group.lots.length}
          onDelete={() => removeGroup(group)}
          onEditExpiry={() => (multiple ? setLotsKey(group.key) : setEditingExpiry(group.first))}
          addedBy={multiple ? undefined : addedByLabel(t, household, group.first.user_id) ?? undefined}
          onOpenFact={() => (multiple ? setLotsKey(group.key) : setFactIngredient(group.first))}
        />
      </ListItemMotion>
    );
  };

  const toastMessage = merging.pending ? t('lots.merged') : removal.pending ? t(removal.pending.lot ? 'lots.removed' : 'pantry.removed') : null;
  const toastAction = merging.pending ? merging.undo : removal.undo;

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader
        title={t('tabs.pantry')}
        subtitle={
          household?.shared
            ? t('pantry.sharedSubtitle', { count: household.members.length })
            : t('ingredientCount', { count: allGroups.length })
        }
        actions={
          <>
            <SquareButton icon={Users} label={t('household.title')} onPress={() => router.push('/household')} />
            <SquareButton icon={ShoppingCart} label={t('shopping.title')} onPress={() => router.navigate('/shopping')} />
          </>
        }
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          icon={Search}
          placeholder={t('pantry.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />

        {loading ? (
          <View style={styles.section}>
            {[0, 1, 2, 3].map((row) => <SkeletonRow key={row} />)}
          </View>
        ) : allGroups.length === 0 ? (
          <EmptyState
            kind="pantry"
            title={t('pantry.emptyTitle')}
            text={t('pantry.emptyText')}
            action={<Button label={t('pantry.addIngredients')} icon={Camera} onPress={() => router.navigate('/(tabs)/camera')} />}
          />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label={t('pantry.filterAll', { count: counts.all })} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={t('pantry.filterUrgent', { count: counts.urgent })} selected={filter === 'urgent'} onPress={() => setFilter('urgent')} />
              <Chip label={t('pantry.filterLeftovers', { count: counts.leftovers })} selected={filter === 'leftovers'} onPress={() => setFilter('leftovers')} />
            </ScrollView>

            {sections.length === 0 ? (
              <Text style={styles.noResults}>{t('pantry.noResults')}</Text>
            ) : (
              sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  <Text style={[styles.groupTitle, { color: section.color }]}>{section.title}</Text>
                  {section.items.map(renderCard)}
                </View>
              ))
            )}

            <Touchable onPress={clearAllIngredients} style={styles.clear} accessibilityRole="button">
              <Text style={styles.clearText}>{t('pantry.clearTitle')}</Text>
            </Touchable>
          </>
        )}
      </ScrollView>

      {/* Ajouter : scan ou ajout à la main */}
      <Touchable
        onPress={() => router.navigate('/(tabs)/camera')}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel={t('pantry.addIngredients')}
      >
        <Plus size={sizes.iconLarge + spacing.sm} color={colors.onPrimary} />
      </Touchable>

      <FoodFactSheet
        ingredient={factIngredient}
        onClose={() => setFactIngredient(null)}
        onRemove={() => {
          if (!factIngredient) return;
          const group = allGroups.find((candidate) => candidate.lots.some((lot) => lot.id === factIngredient.id));
          if (group) removeGroup(group);
        }}
      />

      <LotsSheet
        group={lotsGroup}
        displayName={lotsGroup ? foodName(lotsGroup.first) : ''}
        addedBy={(lot) => addedByLabel(t, household, lot.user_id)}
        onClose={() => setLotsKey(null)}
        onRemoveLot={(lot) => removal.run({ id: lot.id, ids: [lot.id], lot: true })}
        onRemoveAll={() => {
          if (!lotsGroup) return;
          setLotsKey(null);
          removeGroup(lotsGroup);
        }}
        onSaveExpiry={saveLotExpiry}
        onMerge={mergeLots}
        onOpenFact={lotsGroup && lotsGroup.first.kind !== 'dish' ? () => openFactFromLots(lotsGroup) : undefined}
        toast={<Toast message={toastMessage} actionLabel={t('common.undo')} onAction={toastAction} bottom="100%" />}
      />

      <Toast
        message={toastMessage}
        actionLabel={t('common.undo')}
        onAction={toastAction}
        bottom={spacing.xl + sizes.fab + spacing.md}
      />

      <ExpiryEditModal
        ingredient={editingExpiry}
        saving={savingExpiry}
        onSave={saveExpiry}
        onClose={() => setEditingExpiry(null)}
      />
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.screen,
    // Place pour le bouton « + » (sa hauteur et son écart au bord) sous le dernier élément, en fin de liste
    paddingBottom: spacing.xl + sizes.fab + spacing.xxxl,
    gap: spacing.lg,
  },
  filters: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  noResults: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxxl,
  },
  clear: {
    alignSelf: 'center',
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  clearText: {
    ...typography.bodyStrong,
    color: colors.expired.text,
  },
  fab: {
    position: 'absolute',
    right: spacing.screen,
    bottom: spacing.xl,
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
});
