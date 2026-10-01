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
import { PantryLotsSection, type LotPatch } from '@/components/pantry/PantryLotsSection';
import { RecentlyRemoved } from '@/components/pantry/RecentlyRemoved';
import { formatDate, sortByUrgency, todayISO } from '@/lib/expiry';
import { defaultLocation, freezeFamily, frozenExpiry, isUrgentLot, LOCATIONS, openedExpiry, thawedExpiry, type StorageLocation } from '@/lib/storage';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged, onPantryChanged } from '@/lib/pantryEvents';
import { loadPantry } from '@/lib/pantry';
import { groupLots, lotsStock, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { formatQuantity } from '@/lib/quantity';
import { addedByLabel } from '@/lib/household';
import { useHousehold } from '@/hooks/useHousehold';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { hasGenericFact, linkPantryFoodKeys, useFoodNaming } from '@/lib/foodNames';
import { ProductCard } from '@/components/pantry/ProductCard';
import { colors, radius, shadows, sizes, spacing, typography } from '@/constants/theme';

type Filter = 'all' | 'urgent' | 'leftovers' | StorageLocation;
type Group = LotGroup<PantryIngredient> & { total?: string };

// Ligne urgente : un de ses lots a une date stricte passée ou proche, hors congélateur
const isUrgent = (group: Group) => group.lots.some(isUrgentLot);
// Ligne entièrement au congélateur
const isFrozen = (group: Group) => group.lots.every((lot) => lot.location === 'freezer');
// Emplacement d'un lot (lot d'avant la phase 8 : emplacement par défaut)
const locationOf = (lot: PantryIngredient) => (lot.location as StorageLocation | null) ?? defaultLocation(lot.category, lot.kind, lot.food_key);

// Suppression annulable : un aliment entier (tous ses lots) ou un seul lot
interface Removal {
  // Clé de la ligne, ou identifiant du lot
  id: string;
  ids: string[];
  lot: boolean;
  // Aliment entier : nom affiché (message « Œufs : 3 lots retirés »)
  name: string;
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
  // « Est-ce encore bon ? » demandé depuis un lot (la fiche défile jusqu'à la section)
  const [stillGoodRequest, setStillGoodRequest] = useState(0);
  const [editingExpiry, setEditingExpiry] = useState<PantryIngredient | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const household = useHousehold();
  // Nom affiché ; nom générique d'un produit scanné (sous-titre)
  const naming = useFoodNaming(ingredients);
  const foodName = naming.name;
  // Feuille de l'aliment touché (sa ligne, et un de ses lots pour la retrouver si la ligne change de clé)
  const [sheet, setSheet] = useState<{ key: string; lotId: string } | null>(null);

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

  // Changement d'un lot (date, type de date, emplacement, ouverture, congélation) ; renvoie vrai s'il est
  // enregistré
  const updateLot = async (lot: PantryIngredient, patch: Partial<PantryIngredient>): Promise<boolean> => {
    const { error } = await supabase
      .from('ingredients')
      .update(patch)
      .eq('id', lot.id);
    if (error) {
      alertWriteError(t, 'updating pantry lot', error);
      return false;
    }
    setIngredients((current) => sortByUrgency(current.map((ing) => ing.id === lot.id ? { ...ing, ...patch } : ing)));
    notifyPantryChanged();
    if (patch.expires_at) await maybeAskNotificationPermission();
    return true;
  };
  // Date choisie par l'utilisateur : plus estimée
  const saveLotExpiry = (lot: PantryIngredient, expiresAt: string | null) => updateLot(lot, { expires_at: expiresAt, expiry_estimated: false });
  const saveLotPatch = (lot: PantryIngredient, patch: LotPatch) => updateLot(lot, patch);

  // « Congeler » : au congélateur, nouvelle date estimée selon l'aliment (qualité, indicative), conseil
  const freezeLot = async (lot: PantryIngredient) => {
    const expiresAt = frozenExpiry(lot.category, lot.kind);
    if (!await updateLot(lot, { location: 'freezer', frozen_at: todayISO(), thawed_at: null, expires_at: expiresAt, date_kind: 'best_before', expiry_estimated: true })) return;
    Alert.alert(
      t('storage.freezeTipTitle'),
      `${t('storage.frozenDone', { date: formatDate(expiresAt, language) })}\n\n${t(`storage.freezeTip_${freezeFamily(lot.category, lot.kind)}`)}`,
    );
  };
  // « Décongeler » : au frigo, date courte (1 à 2 jours, stricte), rappel de ne pas recongeler
  const thawLot = async (lot: PantryIngredient) => {
    const expiresAt = thawedExpiry(lot.category, lot.kind);
    if (!await updateLot(lot, { location: 'fridge', thawed_at: todayISO(), expires_at: expiresAt, date_kind: 'use_by', expiry_estimated: true })) return;
    Alert.alert(t('storage.thaw'), t('storage.thawDone', { date: formatDate(expiresAt, language) }));
  };
  // « Je l'ai ouvert » : date la plus proche entre celle d'origine et la conservation après ouverture ; si
  // c'est celle d'après ouverture, elle devient stricte (et estimée)
  const openLot = async (lot: PantryIngredient) => {
    const expiresAt = openedExpiry(lot.expires_at, lot.category, lot.kind);
    const shortened = expiresAt !== lot.expires_at;
    await updateLot(lot, { opened_at: todayISO(), expires_at: expiresAt, ...(shortened && { date_kind: 'use_by', expiry_estimated: true }) });
  };

  const saveExpiry = async (expiresAt: string | null) => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const saved = await saveLotExpiry(editingExpiry, expiresAt);
    setSavingExpiry(false);
    if (saved) setEditingExpiry(null);
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
    ...Object.fromEntries(LOCATIONS.map((location) => [location, searched.filter((group) => group.lots.some((lot) => locationOf(lot) === location)).length])),
  } as Record<Filter, number>;
  const visible = searched.filter((group) =>
    filter === 'urgent' ? isUrgent(group)
      : filter === 'leftovers' ? group.first.kind === 'dish'
        : filter === 'all' ? true
          : group.lots.some((lot) => locationOf(lot) === filter),
  );
  const sections = [
    { key: 'urgent', title: t('pantry.groupUrgent'), items: visible.filter(isUrgent), color: colors.expired.text },
    { key: 'later', title: t('pantry.groupLater'), items: visible.filter((group) => !isUrgent(group) && !isFrozen(group)), color: colors.textSecondary },
    { key: 'freezer', title: t('storage.groupFreezer'), items: visible.filter((group) => !isUrgent(group) && isFrozen(group)), color: colors.foodFamilies.cold.icon },
  ].filter((section) => section.items.length > 0);

  const sheetGroup = sheet
    ? allGroups.find((group) => group.key === sheet.key) ?? allGroups.find((group) => group.lots.some((lot) => lot.id === sheet.lotId)) ?? null
    : null;
  const openSheet = (group: Group) => setSheet({ key: group.key, lotId: group.first.id });
  const removeGroup = (group: Group) =>
    removal.run({ id: group.key, ids: group.lots.map((lot) => lot.id), lot: false, name: foodName(group.first) });

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
          subtitle={naming.generic(group.first)}
          quantityLabel={group.total}
          lotCount={group.lots.length}
          onDelete={() => removeGroup(group)}
          onEditExpiry={() => (multiple ? openSheet(group) : setEditingExpiry(group.first))}
          addedBy={multiple ? undefined : addedByLabel(t, household, group.first.user_id) ?? undefined}
          onOpenFact={() => openSheet(group)}
        />
      </ListItemMotion>
    );
  };

  const removedMessage = (item: Removal) =>
    item.lot ? t('lots.removed') : item.ids.length > 1 ? t('pantry.removedLots', { name: item.name, count: item.ids.length }) : t('pantry.removed');
  const toastMessage = merging.pending ? t('lots.merged') : removal.pending ? removedMessage(removal.pending) : null;
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

      <View style={styles.list}>
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
              {LOCATIONS.filter((location) => counts[location] > 0).map((location) => (
                <Chip key={location} label={`${t(`storage.${location}`)} · ${counts[location]}`} selected={filter === location} onPress={() => setFilter(location)} />
              ))}
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

          </>
        )}

        {/* Retraits et « J'ai cuisiné ça » des dernières 24 heures, rétablissables */}
        {!loading ? <RecentlyRemoved /> : null}

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
      </View>

      {/* Message « Annuler » sous la liste (il ne la couvre pas) */}
      <Toast message={toastMessage} actionLabel={t('common.undo')} onAction={toastAction} />

      {/* Feuille de l'aliment : ses lots (« Dans ton garde-manger »), puis sa fiche */}
      <FoodFactSheet
        ingredient={sheetGroup?.first ?? null}
        title={sheetGroup ? foodName(sheetGroup.first) : undefined}
        subtitle={sheetGroup ? naming.generic(sheetGroup.first) : null}
        product={sheetGroup?.first.barcode ? <ProductCard ingredient={sheetGroup.first} /> : null}
        stillGoodRequest={stillGoodRequest}
        onClose={() => setSheet(null)}
        // Fiche générique : aliments bruts, et produits peu transformés (NOVA 1 ou 2)
        withFact={!!sheetGroup && sheetGroup.first.kind !== 'dish' && (!sheetGroup.first.barcode || hasGenericFact(sheetGroup.first))}
        pantry={sheetGroup ? (
          <PantryLotsSection
            group={sheetGroup}
            addedBy={(lot) => addedByLabel(t, household, lot.user_id)}
            onRemoveLot={(lot) => removal.run({ id: lot.id, ids: [lot.id], lot: true, name: foodName(lot) })}
            onRemoveAll={() => {
              setSheet(null);
              removeGroup(sheetGroup);
            }}
            onUpdateLot={saveLotPatch}
            onFreeze={freezeLot}
            onThaw={thawLot}
            onOpen={openLot}
            onMerge={mergeLots}
            onShowStillGood={() => setStillGoodRequest((request) => request + 1)}
          />
        ) : null}
        toast={<Toast message={toastMessage} actionLabel={t('common.undo')} onAction={toastAction} inset={false} />}
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
