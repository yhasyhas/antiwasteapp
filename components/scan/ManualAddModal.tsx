import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, ScrollView, Switch } from 'react-native';
import { router } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { expiryForPackagedProduct, expiryFromShelfLife, type FoodKind } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { scanModalStyles } from './scanModalStyles';
import { BarcodeNotice } from './BarcodeNotice';

interface ManualIngredient {
  name: string;
  quantity: string;
  kind: FoodKind;
  expires_at: string;
  // Produit scanné par code-barres
  barcode?: string;
  category?: string | null;
}

// Saisie préremplie après un scan de code-barres : produit trouvé dans Open Food Facts, ou code seul
// (found = false). key change à chaque scan, même pour un code déjà scanné.
export interface ManualPrefill {
  key: number;
  barcode: string;
  found: boolean;
  name: string;
  quantity: string;
  category: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  prefill?: ManualPrefill | null;
}

// Ajout manuel d'ingrédients. La saisie est conservée quand la fenêtre est fermée sans enregistrer.
export function ManualAddModal({ visible, onClose, prefill }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [manualIngredients, setManualIngredients] = useState<ManualIngredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  // Date proposée : 7 jours, 3 pour un reste ; tant que l'utilisateur ne l'a pas changée, elle suit le type
  const [isLeftover, setIsLeftover] = useState(false);
  const [newExpiry, setNewExpiry] = useState(() => expiryFromShelfLife(undefined));
  const [expiryChanged, setExpiryChanged] = useState(false);
  // Code-barres de l'ingrédient en cours de saisie
  const [pending, setPending] = useState<{ barcode: string; found: boolean; category: string | null } | null>(null);

  useEffect(() => {
    if (!prefill) return;
    setNewIngredientName(prefill.name);
    setNewIngredientQuantity(prefill.quantity);
    setIsLeftover(false);
    setNewExpiry(expiryForPackagedProduct(prefill.category));
    setExpiryChanged(false);
    setPending({ barcode: prefill.barcode, found: prefill.found, category: prefill.category });
  }, [prefill?.key]);

  const toggleLeftover = (value: boolean) => {
    setIsLeftover(value);
    if (!expiryChanged) setNewExpiry(expiryFromShelfLife(undefined, value ? 'dish' : 'ingredient'));
  };

  const changeExpiry = (iso: string) => {
    setNewExpiry(iso);
    setExpiryChanged(true);
  };

  const addManualIngredient = () => {
    if (!newIngredientName.trim()) return;

    setManualIngredients([
      ...manualIngredients,
      {
        name: newIngredientName.trim(),
        quantity: newIngredientQuantity.trim(),
        kind: isLeftover ? 'dish' : 'ingredient',
        expires_at: newExpiry,
        ...(pending && { barcode: pending.barcode, category: pending.category }),
      },
    ]);
    setPending(null);
    setNewIngredientName('');
    setNewIngredientQuantity('');
    setIsLeftover(false);
    setNewExpiry(expiryFromShelfLife(undefined));
    setExpiryChanged(false);
  };

  const removeManualIngredient = (index: number) => {
    setManualIngredients(manualIngredients.filter((_, i) => i !== index));
  };

  const saveManualIngredients = async () => {
    if (!user || manualIngredients.length === 0) return;

    const ingredientsToInsert = manualIngredients.map((ingredient) => ({
      user_id: user.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      kind: ingredient.kind,
      expires_at: ingredient.expires_at,
      category: ingredient.category ?? null,
      barcode: ingredient.barcode ?? null,
      added_via: ingredient.barcode ? 'barcode' : 'manual',
    }));

    const { error } = await supabase
      .from('ingredients')
      .insert(ingredientsToInsert);

    if (error) {
      alertWriteError(t, 'saving manual ingredients', error);
    } else {
      setManualIngredients([]);
      onClose();
      notifyPantryChanged();
      // Premier ajout d'une date : proposition des rappels avant le message de confirmation
      await maybeAskNotificationPermission();
      Alert.alert(
        t('manual.successTitle'),
        t('scan.addedToPantry', { count: ingredientsToInsert.length }),
        [
          {
            text: t('scan.viewPantry'),
            onPress: () => router.push('/(tabs)/ingredients'),
          },
          { text: t('common.ok'), style: 'cancel' },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={scanModalStyles.modalOverlay}>
        <View style={scanModalStyles.modalContent}>
          <View style={scanModalStyles.modalHeader}>
            <Text style={scanModalStyles.modalTitle}>{t('manual.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {pending && <BarcodeNotice barcode={pending.barcode} found={pending.found} />}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('manual.nameLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('manual.namePlaceholder')}
                value={newIngredientName}
                onChangeText={setNewIngredientName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('manual.quantityLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('manual.quantityPlaceholder')}
                value={newIngredientQuantity}
                onChangeText={setNewIngredientQuantity}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('manual.isLeftover')}</Text>
              <Switch
                value={isLeftover}
                onValueChange={toggleLeftover}
                trackColor={{ true: '#6ee7b7', false: '#d1d5db' }}
                thumbColor={isLeftover ? '#10b981' : '#f9fafb'}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('expiry.label')}</Text>
              <ExpiryPicker value={newExpiry} onChange={changeExpiry} />
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={addManualIngredient}
            >
              <Plus size={20} color="#10b981" />
              <Text style={styles.addButtonText}>{t('manual.addToList')}</Text>
            </TouchableOpacity>

            {manualIngredients.length > 0 && (
              <View style={styles.ingredientList}>
                <Text style={styles.listTitle}>{t('manual.addedList')}</Text>
                {manualIngredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>
                        {ingredient.name}
                      </Text>
                      {ingredient.quantity ? (
                        <Text style={styles.ingredientQuantity}>
                          {ingredient.quantity}
                        </Text>
                      ) : null}
                      <View style={styles.itemBadges}>
                        <ExpiryBadge expiresAt={ingredient.expires_at} />
                        {ingredient.kind === 'dish' && (
                          <Text style={styles.leftoverText}>{t('pantry.leftover')}</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeManualIngredient(index)}
                    >
                      <X size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.saveButton,
              manualIngredients.length === 0 && styles.saveButtonDisabled,
            ]}
            onPress={saveManualIngredients}
            disabled={manualIngredients.length === 0}
          >
            <Check size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {t('manual.saveCount', { count: manualIngredients.length })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  itemBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  leftoverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  ingredientList: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
