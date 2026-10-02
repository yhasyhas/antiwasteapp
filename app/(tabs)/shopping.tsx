import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ListChecks, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { addedByLabel } from '@/lib/household';
import { Input, TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/Illustrations';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { SwipeToDelete } from '@/components/ui/SwipeToDelete';
import { Touchable } from '@/components/ui/Touchable';
import { ListItemMotion } from '@/components/ui/ListItemMotion';
import { Toast } from '@/components/ui/Toast';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { expiryFromShelfLife } from '@/lib/expiry';
import { capitalizeFirst } from '@/lib/foodNames';
import { displayQuantity } from '@/lib/quantity';
import {
  addShoppingItem,
  loadShoppingList,
  onShoppingChanged,
  removeShoppingItem,
  setShoppingItemChecked,
  stockShoppingItems,
  type ShoppingItem,
} from '@/lib/shopping';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';
import { showDialog } from '@/lib/dialog';

// Liste de courses du foyer : ajout à la main (ou depuis une recette), coché quand c'est acheté, puis
// rangé au garde-manger avec une date proposée. Partagée et mise à jour en temps réel.
export default function ShoppingScreen() {
  const { t, language } = useLanguage();
  const keyboardScroll = useKeyboardScroll();
  const household = useHousehold();
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [adding, setAdding] = useState(false);
  // Articles à ranger, avec la date choisie pour chacun
  const [stocking, setStocking] = useState<{ item: ShoppingItem; expires_at: string; estimated: boolean }[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await loadShoppingList();
    if (list) setItems(list);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => onShoppingChanged(load), [load]);
  // Autre foyer actif (arrivée, départ) : autre liste
  useEffect(() => {
    load();
  }, [household?.id]);

  // Suppression enregistrée tout de suite, annulable (« Article retiré · Annuler ») : l'article revient tel quel
  const removal = useUndoableAction<ShoppingItem>({
    label: 'deleting shopping item',
    perform: (item) => removeShoppingItem(item.id),
    onDone: (item) => setItems((current) => current?.filter((i) => i.id !== item.id) ?? null),
    onUndone: () => load(),
  });

  // Articles en cours de suppression : déjà cachés (reviennent si l'enregistrement échoue)
  const shown = items?.filter((item) => !removal.hiddenIds.has(item.id)) ?? null;
  const toBuy = (shown ?? []).filter((item) => !item.checked);
  const inCart = (shown ?? []).filter((item) => item.checked);

  const failed = (error: unknown) => {
    console.warn('[courses]', error);
    showDialog(t('errors.writeTitle'), t('errors.writeText'));
  };

  const add = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addShoppingItem(name, quantity);
      setName('');
      setQuantity('');
    } catch (error) {
      failed(error);
    } finally {
      setAdding(false);
    }
  };

  // Coché tout de suite à l'écran, puis enregistré
  const toggle = async (item: ShoppingItem) => {
    setItems((current) => current?.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) ?? null);
    try {
      await setShoppingItemChecked(item.id, !item.checked);
    } catch (error) {
      failed(error);
      load();
    }
  };

  // Date proposée : une semaine (modifiable pour chaque article)
  const openStock = () => setStocking(inCart.map((item) => ({ item, expires_at: expiryFromShelfLife(undefined), estimated: true })));

  const confirmStock = async () => {
    if (!stocking) return;
    setSaving(true);
    try {
      const count = await stockShoppingItems(stocking.map(({ item, expires_at, estimated }) => ({ id: item.id, expires_at, expiry_estimated: estimated })));
      setStocking(null);
      showDialog(t('shopping.stockedTitle'), t('shopping.stockedText', { count }));
    } catch (error) {
      failed(error);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = (item: ShoppingItem, index: number) => {
    // « Pour : recette » ou « Ajouté par … »
    const details = item.recipe_title
      ? t('shopping.forRecipeLine', { title: item.recipe_title })
      : addedByLabel(t, household, item.added_by);
    return (
      <ListItemMotion key={item.id} index={index}>
        {index > 0 ? <View style={cardStyles.divider} /> : null}
        <SwipeToDelete onDelete={() => removal.run(item)}>
          <Touchable
            scale={false}
            style={styles.item}
            onPress={() => toggle(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.checked }}
            accessibilityLabel={capitalizeFirst(item.name)}
          >
            <Checkbox checked={item.checked} />
            <View style={styles.itemText}>
              <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{capitalizeFirst(item.name)}</Text>
              {details ? <Text style={styles.itemDetails}>{details}</Text> : null}
            </View>
            {item.quantity ? <Text style={styles.quantity}>{displayQuantity(item.quantity, language)}</Text> : null}
          </Touchable>
        </SwipeToDelete>
      </ListItemMotion>
    );
  };

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader
        title={t('shopping.short')}
        subtitle={household?.shared ? t('shopping.sharedSubtitle') : undefined}
      />
      <ScrollView
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextField
          value={name}
          onChangeText={setName}
          placeholder={t('shopping.namePlaceholder')}
          maxLength={80}
          returnKeyType="done"
          onSubmitEditing={add}
          accessibilityLabel={t('shopping.namePlaceholder')}
          trailing={
            <>
              <Input
                style={styles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                placeholder={t('shopping.quantityPlaceholder')}
                maxLength={40}
                onSubmitEditing={add}
              />
              <Touchable
                style={[styles.addButton, (!name.trim() || adding) && styles.addButtonDisabled]}
                onPress={add}
                disabled={adding || !name.trim()}
                accessibilityRole="button"
                accessibilityLabel={t('shopping.add')}
              >
                {adding ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Plus size={sizes.iconLarge} color={colors.onPrimary} />}
              </Touchable>
            </>
          }
        />

        {items === null ? (
          <View>
            {[0, 1, 2].map((row) => <SkeletonRow key={row} />)}
          </View>
        ) : shown!.length === 0 ? (
          <EmptyState kind="shopping" title={t('shopping.emptyTitle')} text={t('shopping.emptyText')} />
        ) : (
          <>
            {toBuy.length > 0 && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>{t('shopping.toBuyTitle', { count: toBuy.length })}</Text>
                <View style={cardStyles.divider} />
                {toBuy.map(renderItem)}
              </Card>
            )}
            {inCart.length > 0 && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>{t('shopping.inCartTitle', { count: inCart.length })}</Text>
                <View style={cardStyles.divider} />
                {inCart.map(renderItem)}
                <Button label={t('shopping.stockTitle')} icon={ListChecks} onPress={openStock} style={styles.stock} />
              </Card>
            )}
            <Text style={styles.hint}>{t('shopping.swipeHint')}</Text>
          </>
        )}
      </ScrollView>

      {/* Message « Annuler » sous la liste (il ne la couvre pas) */}
      <Toast message={removal.pending ? t('shopping.removed') : null} actionLabel={t('common.undo')} onAction={removal.undo} />

      {/* Ranger au garde-manger : une date proposée par article, modifiable */}
      <BottomSheet visible={stocking !== null} onClose={() => setStocking(null)}>
        <SheetHeader title={t('shopping.stockTitle')} subtitle={t('shopping.stockHint')} onClose={() => setStocking(null)} />
        <ScrollView style={styles.stockList}>
          {stocking?.map(({ item, expires_at }, index) => (
            <View key={item.id} style={styles.stockItem}>
              {index > 0 ? <View style={cardStyles.divider} /> : null}
              <Text style={styles.itemName}>{capitalizeFirst(item.name)}{item.quantity ? ` · ${displayQuantity(item.quantity, language)}` : ''}</Text>
              <ExpiryPicker
                value={expires_at}
                onChange={(value) => setStocking((current) => current?.map((entry, i) => (i === index ? { ...entry, expires_at: value, estimated: false } : entry)) ?? null)}
              />
            </View>
          ))}
        </ScrollView>
        <Button label={t('shopping.stockConfirm', { count: stocking?.length ?? 0 })} onPress={confirmStock} loading={saving} style={styles.stock} />
      </BottomSheet>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  quantityInput: {
    ...typography.body,
    width: sizes.thumbnail + spacing.lg,
    flexShrink: 0,
    minHeight: sizes.touch,
    borderLeftWidth: sizes.borderWidth,
    borderLeftColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  addButton: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.control - spacing.xs,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: opacity.disabled,
  },
  section: {
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    fontSize: typography.title3.fontSize! - spacing.xs,
    paddingVertical: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: sizes.touch + spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  itemText: {
    flex: 1,
    gap: spacing.xxs,
  },
  itemName: {
    ...typography.cardTitle,
  },
  itemNameChecked: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  itemDetails: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  quantity: {
    ...typography.body,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.secondary,
    textAlign: 'center',
  },
  stock: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stockList: {
    flexGrow: 0,
  },
  stockItem: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
