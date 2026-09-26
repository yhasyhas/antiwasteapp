import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Check, Plus, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useHousehold } from '@/hooks/useHousehold';
import { Input } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { scanModalStyles } from '@/components/scan/scanModalStyles';
import { expiryFromShelfLife } from '@/lib/expiry';
import {
  addShoppingItem,
  loadShoppingList,
  onShoppingChanged,
  removeShoppingItem,
  setShoppingItemChecked,
  stockShoppingItems,
  type ShoppingItem,
} from '@/lib/shopping';

// Liste de courses du foyer : ajout à la main (ou depuis une recette), coché quand c'est acheté, puis
// rangé au garde-manger avec une date proposée. Partagée et mise à jour en temps réel.
export default function ShoppingScreen() {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const household = useHousehold();
  const [items, setItems] = useState<ShoppingItem[] | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [adding, setAdding] = useState(false);
  // Articles à ranger, avec la date choisie pour chacun
  const [stocking, setStocking] = useState<{ item: ShoppingItem; expires_at: string }[] | null>(null);
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

  const toBuy = (items ?? []).filter((item) => !item.checked);
  const inCart = (items ?? []).filter((item) => item.checked);

  const authorName = (userId: string | null) => {
    if (!household?.shared) return null;
    const member = household.members.find((m) => m.user_id === userId);
    if (!member) return t('household.formerMember');
    return member.is_me ? t('household.me') : member.name;
  };

  const failed = (error: unknown) => {
    console.warn('[courses]', error);
    Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
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

  const remove = async (item: ShoppingItem) => {
    setItems((current) => current?.filter((i) => i.id !== item.id) ?? null);
    try {
      await removeShoppingItem(item.id);
    } catch (error) {
      failed(error);
      load();
    }
  };

  // Date proposée : une semaine (modifiable pour chaque article)
  const openStock = () => setStocking(inCart.map((item) => ({ item, expires_at: expiryFromShelfLife(undefined) })));

  const confirmStock = async () => {
    if (!stocking) return;
    setSaving(true);
    try {
      const count = await stockShoppingItems(stocking.map(({ item, expires_at }) => ({ id: item.id, expires_at })));
      setStocking(null);
      Alert.alert(t('shopping.stockedTitle'), t('shopping.stockedText', { count }));
    } catch (error) {
      failed(error);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = (item: ShoppingItem) => {
    const author = authorName(item.added_by);
    const details = [item.quantity, item.recipe_title && t('shopping.forRecipe', { title: item.recipe_title }), author && t('household.addedBy', { name: author })]
      .filter(Boolean)
      .join(' · ');
    return (
      <View key={item.id} style={styles.item}>
        <TouchableOpacity style={styles.itemMain} onPress={() => toggle(item)} accessibilityRole="checkbox" accessibilityState={{ checked: item.checked }}>
          <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
            {item.checked && <Check size={16} color="#fff" />}
          </View>
          <View style={styles.itemText}>
            <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{item.name}</Text>
            {details ? <Text style={styles.itemDetails}>{details}</Text> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => remove(item)} hitSlop={8} accessibilityLabel={t('common.delete')}>
          <Trash2 size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('shopping.title') }} />
      <KeyboardAvoider style={styles.container}>
        <ScrollView
          ref={keyboardScroll.scrollRef}
          onScroll={keyboardScroll.onScroll}
          scrollEventThrottle={keyboardScroll.scrollEventThrottle}
          contentContainerStyle={[styles.content, safe.bottom(24)]}
          keyboardShouldPersistTaps="handled"
        >
          {household?.shared && <Text style={styles.intro}>{t('shopping.sharedIntro')}</Text>}

          <View style={styles.addRow}>
            <Input
              style={[styles.input, styles.nameInput]}
              value={name}
              onChangeText={setName}
              placeholder={t('shopping.namePlaceholder')}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <Input
              style={[styles.input, styles.quantityInput]}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('shopping.quantityPlaceholder')}
              maxLength={40}
              onSubmitEditing={add}
            />
            <TouchableOpacity style={styles.addButton} onPress={add} disabled={adding || !name.trim()} accessibilityLabel={t('shopping.add')}>
              {adding ? <ActivityIndicator color="#fff" size="small" /> : <Plus size={22} color="#fff" />}
            </TouchableOpacity>
          </View>

          {items === null ? (
            <ActivityIndicator style={styles.loading} color="#10b981" />
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <ShoppingCart size={56} color="#d1d5db" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>{t('shopping.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('shopping.emptyText')}</Text>
            </View>
          ) : (
            <>
              {toBuy.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('shopping.toBuy', { count: toBuy.length })}</Text>
                  {toBuy.map(renderItem)}
                </View>
              )}
              {inCart.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('shopping.inCart', { count: inCart.length })}</Text>
                  {inCart.map(renderItem)}
                  <TouchableOpacity style={styles.stockButton} onPress={openStock}>
                    <Text style={styles.stockButtonText}>{t('shopping.stock', { count: inCart.length })}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoider>

      {/* Ranger au garde-manger : une date proposée par article, modifiable */}
      <Modal visible={stocking !== null} animationType="slide" transparent onRequestClose={() => setStocking(null)}>
        <View style={scanModalStyles.modalOverlay}>
          <View style={[scanModalStyles.modalContent, safe.bottom(24)]}>
            <View style={scanModalStyles.modalHeader}>
              <Text style={scanModalStyles.modalTitle}>{t('shopping.stockTitle')}</Text>
              <TouchableOpacity onPress={() => setStocking(null)} hitSlop={8}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.stockHint}>{t('shopping.stockHint')}</Text>
            <ScrollView style={styles.stockList}>
              {stocking?.map(({ item, expires_at }, index) => (
                <View key={item.id} style={styles.stockItem}>
                  <Text style={styles.itemName}>{item.name}{item.quantity ? ` · ${item.quantity}` : ''}</Text>
                  <ExpiryPicker
                    value={expires_at}
                    onChange={(value) => setStocking((current) => current?.map((entry, i) => (i === index ? { ...entry, expires_at: value } : entry)) ?? null)}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.stockButton} onPress={confirmStock} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.stockButtonText}>{t('shopping.stockConfirm', { count: stocking?.length ?? 0 })}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, gap: 16 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  nameInput: { flex: 2 },
  quantityInput: { flex: 1 },
  addButton: { backgroundColor: '#10b981', borderRadius: 10, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  loading: { marginTop: 40 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3f4f6' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#10b981' },
  itemText: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemNameChecked: { color: '#9ca3af', textDecorationLine: 'line-through' },
  itemDetails: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stockButton: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  stockButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  stockHint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  stockList: { maxHeight: 420 },
  stockItem: { gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
});
