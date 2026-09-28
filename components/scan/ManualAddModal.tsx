import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TextField } from '@/components/ui/Input';
import { useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Touchable } from '@/components/ui/Touchable';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { expiryForPackagedProduct, expiryFromShelfLife, type FoodKind } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
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
  const keyboardScroll = useKeyboardScroll();
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
    <BottomSheet visible={visible} onClose={onClose} keyboard>
      <SheetHeader title={t('manual.title')} onClose={onClose} />

      <ScrollView
        style={styles.body}
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.bodyContent}
      >
        {pending && <BarcodeNotice barcode={pending.barcode} found={pending.found} />}
        <TextField
          label={t('manual.nameLabel')}
          placeholder={t('manual.namePlaceholder')}
          value={newIngredientName}
          onChangeText={setNewIngredientName}
        />
        <TextField
          label={t('manual.quantityLabel')}
          placeholder={t('manual.quantityPlaceholder')}
          value={newIngredientQuantity}
          onChangeText={setNewIngredientQuantity}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('manual.isLeftover')}</Text>
          <Switch value={isLeftover} onValueChange={toggleLeftover} accessibilityLabel={t('manual.isLeftover')} />
        </View>

        <View>
          <Text style={styles.label}>{t('expiry.label')}</Text>
          <ExpiryPicker value={newExpiry} onChange={changeExpiry} />
        </View>

        <Button label={t('manual.addToList')} icon={Plus} variant="outline" size="medium" onPress={addManualIngredient} disabled={!newIngredientName.trim()} />

        {manualIngredients.length > 0 && (
          <View>
            <Text style={styles.label}>{t('manual.addedList')}</Text>
            {manualIngredients.map((ingredient, index) => (
              <View key={index}>
                {index > 0 ? <View style={cardStyles.divider} /> : null}
                <View style={styles.item}>
                  <View style={styles.itemText}>
                    <Text style={styles.itemName}>{ingredient.name}</Text>
                    {ingredient.quantity ? <Text style={styles.itemQuantity}>{ingredient.quantity}</Text> : null}
                  </View>
                  {ingredient.kind === 'dish' && <Badge label={t('pantry.leftover')} tone="leftover" />}
                  <ExpiryBadge expiresAt={ingredient.expires_at} />
                  <Touchable onPress={() => removeManualIngredient(index)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                    <X size={sizes.icon} color={colors.expired.text} />
                  </Touchable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Button
        label={t('manual.saveCount', { count: manualIngredients.length })}
        icon={Check}
        onPress={saveManualIngredients}
        disabled={manualIngredients.length === 0}
        style={styles.save}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: sizes.touch,
  },
  switchLabel: {
    ...typography.bodyMedium,
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    ...typography.listTitle,
  },
  itemQuantity: {
    ...typography.secondary,
  },
  remove: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  save: {
    marginTop: spacing.sm,
  },
});
