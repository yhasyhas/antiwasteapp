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
import { alertWriteError } from '@/lib/alertWriteError';
import { expiryForPackagedProduct, expiryFromShelfLife, type FoodKind } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { linkPantryFoodKeys } from '@/lib/foodNames';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { LocationChoice } from '@/components/pantry/LocationChoice';
import { defaultDateKind, defaultLocation, frozenExpiry, type DateKind, type StorageLocation } from '@/lib/storage';
import { BarcodeNotice } from './BarcodeNotice';
import { ExistingFoodChoice, type AddChoice } from '@/components/pantry/ExistingFoodChoice';
import { QuantityField } from '@/components/pantry/QuantityField';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { addPantryItems, defaultChoice, existingFor, loadPantry, PantryConflictError, pantryGroups } from '@/lib/pantry';
import { capitalizeFirst } from '@/lib/foodNames';
import { displayQuantity } from '@/lib/quantity';
import type { LotGroup } from '@/lib/pantryLots';

interface ManualIngredient {
  name: string;
  quantity: string;
  kind: FoodKind;
  expires_at: string;
  // Produit scanné par code-barres
  barcode?: string;
  category?: string | null;
  // Produit Open Food Facts (code-barres)
  product?: ProductInfo | null;
  // Déjà dans le garde-manger : ajouté aux existants, séparément, ou pas du tout
  choice: AddChoice;
  location: StorageLocation;
  date_kind: DateKind;
  // Date proposée par l'app (non changée par l'utilisateur)
  expiry_estimated: boolean;
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
  product: ProductInfo | null;
}

// Informations d'Open Food Facts gardées avec le produit
export interface ProductInfo {
  product_name: string;
  generic_name: string | null;
  brand: string | null;
  nova_group: number | null;
  nutriscore_grade: string | null;
  off_categories: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  prefill?: ManualPrefill | null;
  // « Terminer » sans rien enregistrer : message « Aucun aliment ajouté » sur le Scanner
  onNothingAdded?: () => void;
}

// Ajout manuel d'ingrédients. La saisie est conservée quand la fenêtre est fermée sans enregistrer.
export function ManualAddModal({ visible, onClose, prefill, onNothingAdded }: Props) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  // Garde-manger du foyer, relu à chaque ouverture : aliments déjà présents
  const [groups, setGroups] = useState<LotGroup<PantryIngredient>[]>([]);
  const [saving, setSaving] = useState(false);
  const keyboardScroll = useKeyboardScroll();
  const [manualIngredients, setManualIngredients] = useState<ManualIngredient[]>([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  // Date proposée : 7 jours, 3 pour un reste ; tant que l'utilisateur ne l'a pas changée, elle suit le type
  const [isLeftover, setIsLeftover] = useState(false);
  const [newExpiry, setNewExpiry] = useState(() => expiryFromShelfLife(undefined));
  const [expiryChanged, setExpiryChanged] = useState(false);
  // Emplacement choisi (null : proposé selon l'aliment)
  const [newLocation, setNewLocation] = useState<StorageLocation | null>(null);
  // Code-barres de l'ingrédient en cours de saisie
  const [pending, setPending] = useState<{ barcode: string; found: boolean; category: string | null; product: ProductInfo | null } | null>(null);

  useEffect(() => {
    if (visible) loadPantry().then((rows) => rows && setGroups(pantryGroups(rows)));
  }, [visible]);

  useEffect(() => {
    if (!prefill) return;
    setNewIngredientName(prefill.name);
    setNewIngredientQuantity(prefill.quantity);
    setIsLeftover(false);
    setNewExpiry(expiryForPackagedProduct(prefill.category));
    setExpiryChanged(false);
    setPending({ barcode: prefill.barcode, found: prefill.found, category: prefill.category, product: prefill.product });
  }, [prefill?.key]);

  const newKind: FoodKind = isLeftover ? 'dish' : 'ingredient';
  const location = newLocation ?? defaultLocation(pending?.category, newKind, null);
  // Au congélateur : date de congélation estimée, tant que l'utilisateur n'a pas choisi la date
  const changeLocation = (value: StorageLocation) => {
    setNewLocation(value);
    if (expiryChanged) return;
    if (value === 'freezer') setNewExpiry(frozenExpiry(pending?.category, newKind));
    else if (location === 'freezer') setNewExpiry(pending ? expiryForPackagedProduct(pending.category) : expiryFromShelfLife(undefined, newKind));
  };

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

    const ingredient = {
      name: newIngredientName.trim(),
      quantity: newIngredientQuantity.trim(),
      kind: (isLeftover ? 'dish' : 'ingredient') as FoodKind,
      expires_at: newExpiry,
      location,
      date_kind: location === 'freezer' ? 'best_before' as const : defaultDateKind(pending?.category, newKind),
      expiry_estimated: !expiryChanged,
      ...(pending && { barcode: pending.barcode, category: pending.category, product: pending.product }),
    };
    setManualIngredients([...manualIngredients, { ...ingredient, choice: defaultChoice(groups, ingredient, language) }]);
    setPending(null);
    setNewIngredientName('');
    setNewIngredientQuantity('');
    setIsLeftover(false);
    setNewExpiry(expiryFromShelfLife(undefined));
    setExpiryChanged(false);
    setNewLocation(null);
  };

  const removeManualIngredient = (index: number) => {
    setManualIngredients(manualIngredients.filter((_, i) => i !== index));
  };

  const setChoice = (index: number, choice: AddChoice) => {
    setManualIngredients((current) => current.map((item, i) => (i === index ? { ...item, choice } : item)));
  };

  // Aliments à enregistrer (« Ne pas ajouter » exclus)
  const toSave = manualIngredients.filter((ingredient) => ingredient.choice !== 'skip');

  // Rien à enregistrer (tout en « Ne pas ajouter » ou retiré, aucune saisie en cours) : « Terminer »
  const nothingToSave = toSave.length === 0 && !newIngredientName.trim();
  const finish = () => {
    setManualIngredients([]);
    setPending(null);
    onClose();
    onNothingAdded?.();
  };

  const saveManualIngredients = async () => {
    if (!user || toSave.length === 0) return;

    setSaving(true);
    let error: unknown = null;
    try {
      await addPantryItems(toSave.map(({ product, ...ingredient }) => ({
        ...ingredient,
        ...product,
        barcode: ingredient.barcode ?? null,
        choice: ingredient.choice === 'merge' ? 'merge' : 'separate',
        added_via: ingredient.barcode ? 'barcode' : 'manual',
      })), groups, language);
    } catch (caught) {
      error = caught;
    }
    setSaving(false);

    if (error instanceof PantryConflictError) {
      // Un membre du foyer vient de changer un lot : garde-manger relu, choix à vérifier
      loadPantry().then((rows) => rows && setGroups(pantryGroups(rows)));
      Alert.alert(t('existing.conflictTitle'), t('existing.conflictText'));
    } else if (error) {
      alertWriteError(t, 'saving manual ingredients', error);
    } else {
      setManualIngredients([]);
      onClose();
      notifyPantryChanged();
      // Reliés à leur fiche en arrière-plan (nom dans la langue de l'app)
      linkPantryFoodKeys();
      // Premier ajout d'une date : proposition des rappels avant le message de confirmation
      await maybeAskNotificationPermission();
      Alert.alert(
        t('manual.successTitle'),
        t('scan.addedToPantry', { count: toSave.length }),
        [
          {
            text: t('scan.viewPantry'),
            onPress: () => router.navigate('/(tabs)/ingredients'),
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
        <QuantityField
          label={t('manual.quantityLabel')}
          placeholder={t('manual.quantityPlaceholder')}
          value={newIngredientQuantity}
          onChange={setNewIngredientQuantity}
          itemName={newIngredientName}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('manual.isLeftover')}</Text>
          <Switch value={isLeftover} onValueChange={toggleLeftover} accessibilityLabel={t('manual.isLeftover')} />
        </View>

        <View>
          <Text style={styles.label}>{t('storage.location')}</Text>
          <LocationChoice value={location} onChange={changeLocation} />
        </View>

        <View>
          <Text style={styles.label}>{t('expiry.label')}</Text>
          <ExpiryPicker value={newExpiry} onChange={changeExpiry} />
        </View>

        <Button label={t('manual.addToList')} icon={Plus} variant="outline" size="medium" onPress={addManualIngredient} disabled={!newIngredientName.trim()} />

        {manualIngredients.length > 0 && (
          <View>
            <Text style={styles.label}>{t('manual.addedList')}</Text>
            {manualIngredients.map((ingredient, index) => {
              const existing = existingFor(groups, ingredient, language);
              return (
                <View key={index}>
                  {index > 0 ? <View style={cardStyles.divider} /> : null}
                  <View style={styles.item}>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemName, ingredient.choice === 'skip' && styles.skipped]}>{capitalizeFirst(ingredient.name)}</Text>
                      {ingredient.quantity ? <Text style={styles.itemQuantity}>{displayQuantity(ingredient.quantity, language)}</Text> : null}
                    </View>
                    {ingredient.kind === 'dish' && <Badge label={t('pantry.leftover')} tone="leftover" />}
                    <ExpiryBadge expiresAt={ingredient.expires_at} dateKind={ingredient.date_kind} location={ingredient.location} />
                    <Touchable onPress={() => removeManualIngredient(index)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                      <X size={sizes.icon} color={colors.expired.text} />
                    </Touchable>
                  </View>
                  {existing ? (
                    <ExistingFoodChoice
                      group={existing.group}
                      choice={ingredient.choice === 'merge' && existing.mergedTotal === null ? 'separate' : ingredient.choice}
                      mergedTotal={existing.mergedTotal}
                      onChange={(choice) => setChoice(index, choice)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {nothingToSave ? (
        <Button label={t('scan.finish')} variant="outline" onPress={finish} style={styles.save} />
      ) : (
        <Button
          label={t('manual.saveCount', { count: toSave.length })}
          icon={Check}
          onPress={saveManualIngredients}
          loading={saving}
          disabled={toSave.length === 0}
          style={styles.save}
        />
      )}
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
  skipped: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
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
