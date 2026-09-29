import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Info } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DetectedIngredient } from '@/hooks/useScan';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { RecipePlaceholder } from '@/components/ui/Illustrations';
import { Touchable } from '@/components/ui/Touchable';
import { ExistingFoodChoice, type AddChoice } from '@/components/pantry/ExistingFoodChoice';
import { QuantityField } from '@/components/pantry/QuantityField';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import { shortDuration } from '@/lib/expiry';
import { existingFor } from '@/lib/pantry';
import { capitalizeFirst } from '@/lib/foodNames';
import type { LotGroup } from '@/lib/pantryLots';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  ingredients: DetectedIngredient[];
  // Photo analysée (vignette « Ta photo »)
  photo?: string | null;
  onToggle: (index: number) => void;
  onExpiryChange: (index: number, expiresAt: string) => void;
  onQuantityChange: (index: number, quantity: string) => void;
  onChoiceChange: (index: number, choice: AddChoice) => void;
  // Garde-manger du foyer : aliments déjà présents
  groups: LotGroup<PantryIngredient>[];
  saving?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Aliments détectés sur la photo : l'utilisateur décoche ceux qu'il ne veut pas ajouter, corrige la quantité
// (+ et − pour ce qui se compte) et peut changer la durée de conservation proposée (toucher la pastille de
// durée). Aliment déjà dans le garde-manger : ajouter aux existants, séparément ou pas du tout.
export function ConfirmIngredientsModal({ visible, ingredients, photo, onToggle, onExpiryChange, onQuantityChange, onChoiceChange, groups, saving, onConfirm, onClose }: Props) {
  const { t, language } = useLanguage();
  // Aliment dont la date est en cours de modification
  const [editing, setEditing] = useState<number | null>(null);
  const confirmedCount = ingredients.filter((i) => i.confirmed).length;

  const thumbnail = (
    <View style={styles.thumbnail}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
      ) : (
        <RecipePlaceholder compact style={styles.photo} />
      )}
      <Text style={styles.photoLabel}>{t('scan.yourPhoto')}</Text>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboard>
      <SheetHeader
        leading={thumbnail}
        title={t('scan.foundCount', { count: ingredients.length })}
        subtitle={t('scan.foundSubtitle')}
      />

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {ingredients.map((ing, index) => {
          const existing = existingFor(groups, ing, language);
          return (
          <View key={index}>
            <View style={cardStyles.divider} />
            <View style={styles.item}>
              <Touchable
                onPress={() => onToggle(index)}
                scale={false}
                style={styles.itemMain}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ing.confirmed }}
                accessibilityLabel={capitalizeFirst(ing.name)}
              >
                <Checkbox checked={ing.confirmed} />
                <View style={styles.itemText}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, !ing.confirmed && styles.unchecked]}>{capitalizeFirst(ing.name)}</Text>
                    {ing.kind === 'dish' && <Badge label={t('pantry.leftover')} tone="leftover" />}
                  </View>
                  {!ing.confirmed && ing.quantity !== '' && <Text style={styles.quantity}>{ing.quantity}</Text>}
                  {ing.storage_tip ? (
                    <View style={styles.tip}>
                      <Info size={sizes.iconSmall - 2} color={colors.textSecondary} />
                      <Text style={styles.tipText}>{ing.storage_tip}</Text>
                    </View>
                  ) : null}
                </View>
              </Touchable>
              {ing.confirmed && (
                <Touchable
                  onPress={() => setEditing(editing === index ? null : index)}
                  style={[styles.duration, editing === index && styles.durationActive]}
                  accessibilityRole="button"
                  accessibilityLabel={t('expiry.edit')}
                >
                  <Text style={styles.durationText}>{shortDuration(t, ing.expires_at)}</Text>
                </Touchable>
              )}
            </View>
            {ing.confirmed && editing === index && (
              <View style={styles.picker}>
                <ExpiryPicker value={ing.expires_at} onChange={(iso) => onExpiryChange(index, iso)} />
              </View>
            )}
            {ing.confirmed || existing ? (
              <View style={styles.extra}>
                {ing.confirmed ? (
                  <QuantityField
                    value={ing.quantity}
                    onChange={(quantity) => onQuantityChange(index, quantity)}
                    itemName={ing.name}
                    placeholder={t('manual.quantityPlaceholder')}
                  />
                ) : null}
                {existing ? (
                  <ExistingFoodChoice
                    group={existing.group}
                    choice={ing.confirmed ? (existing.mergedTotal === null ? 'separate' : ing.choice) : 'skip'}
                    mergedTotal={existing.mergedTotal}
                    onChange={(choice) => onChoiceChange(index, choice)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
          );
        })}
      </ScrollView>

      {/* Rien à ajouter : « Terminer » ferme la feuille */}
      {confirmedCount > 0 ? (
        <Button label={t('scan.addCount', { count: confirmedCount })} icon={Check} onPress={onConfirm} loading={saving} style={styles.confirm} />
      ) : (
        <Button label={t('scan.finish')} variant="outline" onPress={onConfirm} style={styles.confirm} />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: sizes.thumbnail,
    height: sizes.thumbnail,
    borderRadius: radius.control,
    overflow: 'hidden',
    backgroundColor: colors.illustration.background,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  photoLabel: {
    ...typography.badge,
    color: colors.primary,
    backgroundColor: colors.illustration.background,
    alignSelf: 'stretch',
    textAlign: 'center',
    paddingVertical: spacing.xxs,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    minHeight: sizes.touch,
  },
  itemText: {
    flex: 1,
    gap: spacing.xxs,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.cardTitle,
  },
  unchecked: {
    color: colors.textSecondary,
  },
  quantity: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  tipText: {
    ...typography.secondary,
    flex: 1,
  },
  duration: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  durationActive: {
    borderColor: colors.primary,
  },
  durationText: {
    ...typography.button,
  },
  picker: {
    paddingLeft: sizes.checkbox + spacing.lg,
    paddingBottom: spacing.md,
  },
  confirm: {
    marginTop: spacing.md,
  },
  extra: {
    gap: spacing.md,
    paddingLeft: sizes.checkbox + spacing.lg,
    paddingBottom: spacing.md,
  },
});
