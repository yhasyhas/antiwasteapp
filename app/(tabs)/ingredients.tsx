import React, { useCallback, useEffect, useState } from 'react';
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
import { UndoToast } from '@/components/ui/UndoToast';
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { IngredientCard, type PantryIngredient } from '@/components/pantry/IngredientCard';
import { ExpiryEditModal } from '@/components/pantry/ExpiryEditModal';
import { FoodFactSheet } from '@/components/pantry/FoodFactSheet';
import { expiryStatus, sortByUrgency } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged, onPantryChanged } from '@/lib/pantryEvents';
import { activeHouseholdId } from '@/lib/household';
import { useHousehold } from '@/hooks/useHousehold';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { colors, radius, shadows, sizes, spacing, typography } from '@/constants/theme';

type Filter = 'all' | 'urgent' | 'leftovers';

const isUrgent = (ingredient: PantryIngredient) => {
  const status = expiryStatus(ingredient.expires_at);
  return status === 'expired' || status === 'soon';
};

export default function IngredientsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<PantryIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingExpiry, setEditingExpiry] = useState<PantryIngredient | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const household = useHousehold();
  // Fiche de l'aliment touché
  const [factIngredient, setFactIngredient] = useState<PantryIngredient | null>(null);

  // Garde-manger partagé : rechargé quand un membre le modifie (temps réel) ou qu'on change de foyer
  useEffect(() => onPantryChanged(loadIngredients), [user]);

  // « Ajouté par » (foyer partagé seulement) : moi, un membre, ou un ancien membre
  const addedBy = (authorId: string | null): string | undefined => {
    if (!household?.shared) return undefined;
    const member = household.members.find((m) => m.user_id === authorId);
    if (!member) return t('household.formerMember');
    return member.is_me ? t('household.you') : member.name ?? t('household.guest');
  };

  // Rechargé à chaque retour sur l'onglet (ingrédients ajoutés depuis la caméra, par exemple)
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, [user])
  );

  const loadIngredients = async () => {
    if (!user) return;

    const householdId = await activeHouseholdId();
    if (!householdId) return;

    // Squelettes au premier chargement seulement ; les rechargements se font en arrière-plan
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    // Par urgence : expirés et proches d'abord, sans date à la fin
    if (data) setIngredients(sortByUrgency(data as PantryIngredient[]));
    setLoading(false);
  };

  // Suppression annulable (« Aliment retiré · Annuler ») : faite pour de bon après 5 secondes
  const removal = useUndoableDelete<PantryIngredient>(async (ingredient) => {
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', ingredient.id);

    if (error) {
      alertWriteError(t, 'deleting ingredient', error);
      throw error;
    }
    setIngredients((current) => current.filter((ing) => ing.id !== ingredient.id));
    notifyPantryChanged();
  });

  const saveExpiry = async (expiresAt: string | null) => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const { error } = await supabase
      .from('ingredients')
      .update({ expires_at: expiresAt })
      .eq('id', editingExpiry.id);
    setSavingExpiry(false);

    if (error) {
      alertWriteError(t, 'updating expiry date', error);
      return;
    }
    const id = editingExpiry.id;
    setIngredients((current) => sortByUrgency(current.map((ing) => ing.id === id ? { ...ing, expires_at: expiresAt } : ing)));
    setEditingExpiry(null);
    notifyPantryChanged();
    if (expiresAt) await maybeAskNotificationPermission();
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

  // Aliments en attente de suppression : déjà cachés
  const shown = ingredients.filter((ingredient) => !removal.hiddenIds.has(ingredient.id));
  const query = searchQuery.trim().toLowerCase();
  const searched = query ? shown.filter((ingredient) => ingredient.name.toLowerCase().includes(query)) : shown;
  const counts = {
    all: searched.length,
    urgent: searched.filter(isUrgent).length,
    leftovers: searched.filter((ingredient) => ingredient.kind === 'dish').length,
  };
  const visible = searched.filter((ingredient) =>
    filter === 'urgent' ? isUrgent(ingredient) : filter === 'leftovers' ? ingredient.kind === 'dish' : true,
  );
  const groups = [
    { key: 'urgent', title: t('pantry.groupUrgent'), items: visible.filter(isUrgent), color: colors.expired.text },
    { key: 'later', title: t('pantry.groupLater'), items: visible.filter((ingredient) => !isUrgent(ingredient)), color: colors.textSecondary },
  ].filter((group) => group.items.length > 0);

  const renderCard = (ingredient: PantryIngredient, index: number) => (
    <ListItemMotion key={ingredient.id} index={index}>
      <IngredientCard
        ingredient={ingredient}
        onDelete={() => removal.remove(ingredient)}
        onEditExpiry={() => setEditingExpiry(ingredient)}
        addedBy={addedBy(ingredient.user_id)}
        onOpenFact={() => setFactIngredient(ingredient)}
      />
    </ListItemMotion>
  );

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader
        title={t('tabs.pantry')}
        subtitle={
          household?.shared
            ? t('pantry.sharedSubtitle', { count: household.members.length })
            : t('ingredientCount', { count: shown.length })
        }
        actions={
          <>
            <SquareButton icon={Users} label={t('household.title')} onPress={() => router.push('/household')} />
            <SquareButton icon={ShoppingCart} label={t('shopping.title')} onPress={() => router.push('/shopping')} />
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
        ) : shown.length === 0 ? (
          <EmptyState
            kind="pantry"
            title={t('pantry.emptyTitle')}
            text={t('pantry.emptyText')}
            action={<Button label={t('pantry.addIngredients')} icon={Camera} onPress={() => router.push('/(tabs)/camera')} />}
          />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              <Chip label={t('pantry.filterAll', { count: counts.all })} selected={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label={t('pantry.filterUrgent', { count: counts.urgent })} selected={filter === 'urgent'} onPress={() => setFilter('urgent')} />
              <Chip label={t('pantry.filterLeftovers', { count: counts.leftovers })} selected={filter === 'leftovers'} onPress={() => setFilter('leftovers')} />
            </ScrollView>

            {groups.length === 0 ? (
              <Text style={styles.noResults}>{t('pantry.noResults')}</Text>
            ) : (
              groups.map((group) => (
                <View key={group.key} style={styles.section}>
                  <Text style={[styles.groupTitle, { color: group.color }]}>{group.title}</Text>
                  {group.items.map(renderCard)}
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
        onPress={() => router.push('/(tabs)/camera')}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel={t('pantry.addIngredients')}
      >
        <Plus size={sizes.iconLarge + spacing.sm} color={colors.onPrimary} />
      </Touchable>

      <FoodFactSheet
        ingredient={factIngredient}
        onClose={() => setFactIngredient(null)}
        onRemove={() => factIngredient && removal.remove(factIngredient)}
      />

      <UndoToast
        message={removal.pending ? t('pantry.removed') : null}
        onUndo={removal.undo}
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
