import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Combine, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Touchable } from '@/components/ui/Touchable';
import { addedWhen, expiryFromShelfLife, expiryLabel } from '@/lib/expiry';
import { lotLabel, mergeableLots, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import type { PantryIngredient } from './IngredientCard';

interface Props {
  group: LotGroup<PantryIngredient> | null;
  displayName: string;
  // Foyer partagé : « Ajouté par … » d'un lot (sinon null)
  addedBy: (lot: PantryIngredient) => string | null;
  onClose: () => void;
  onRemoveLot: (lot: PantryIngredient) => void;
  onRemoveAll: () => void;
  // Renvoie vrai si la date est enregistrée
  onSaveExpiry: (lot: PantryIngredient, expiresAt: string | null) => Promise<boolean>;
  onMerge: (lots: PantryIngredient[]) => void;
  onOpenFact?: () => void;
  // Message « Annuler » affiché au-dessus de la feuille
  toast?: React.ReactNode;
}

// Détail d'un aliment en plusieurs lots : quantité, date (touchable pour la modifier), auteur et date d'ajout
// de chaque lot, du plus ancien au plus récent ; retirer un lot, fusionner les lots de même date et même
// unité, fiche de l'aliment, retirer l'aliment entier
export function LotsSheet({ group, displayName, addedBy, onClose, onRemoveLot, onRemoveAll, onSaveExpiry, onMerge, onOpenFact, toast }: Props) {
  const { t, language } = useLanguage();
  // Lot dont la date est en cours de modification
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Contenu gardé pendant l'animation de fermeture
  const [shown, setShown] = useState<{ group: LotGroup<PantryIngredient>; name: string } | null>(null);

  useEffect(() => {
    if (group) setShown({ group, name: displayName });
    else setEditing(null);
  }, [group, displayName]);

  const current = shown?.group;
  const lots = current?.lots ?? [];

  const saveExpiry = async (lot: PantryIngredient, expiresAt: string | null) => {
    setSaving(true);
    const saved = await onSaveExpiry(lot, expiresAt);
    setSaving(false);
    if (saved) setEditing(null);
  };

  return (
    <BottomSheet visible={group !== null} onClose={onClose}>
      {toast}
      <SheetHeader
        title={shown?.name ?? ''}
        subtitle={current ? [t('lots.total', { quantity: totalLabel(lots, language) }), t('lots.count', { count: lots.length })].join(' · ') : undefined}
        onClose={onClose}
      />
      <Text style={styles.hint}>{t('lots.order')}</Text>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {lots.map((lot, index) => {
          const by = addedBy(lot);
          const when = addedWhen(t, lot.created_at, language);
          const isEditing = editing?.id === lot.id;
          return (
            <View key={lot.id}>
              {index > 0 ? <View style={cardStyles.divider} /> : null}
              <View style={styles.lot}>
                <View style={styles.lotText}>
                  <Text style={styles.quantity}>{lotLabel(lot, lots, language) || shown?.name}</Text>
                  <Text style={styles.details}>{by ? `${by} · ${when}` : t('lots.addedWhen', { when })}</Text>
                </View>
                <ExpiryBadge
                  expiresAt={lot.expires_at}
                  onPress={() => setEditing(isEditing ? null : { id: lot.id, value: lot.expires_at ?? expiryFromShelfLife(undefined, lot.kind) })}
                />
                <Touchable onPress={() => onRemoveLot(lot)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('lots.remove')}>
                  <Trash2 size={sizes.icon} color={colors.expired.text} />
                </Touchable>
              </View>
              {isEditing ? (
                <View style={styles.editor}>
                  <ExpiryPicker value={editing.value} onChange={(value) => setEditing({ id: lot.id, value })} />
                  <View style={styles.editorActions}>
                    <Button label={t('expiry.save')} size="small" onPress={() => saveExpiry(lot, editing.value)} loading={saving} />
                    {lot.expires_at ? (
                      <Button label={t('expiry.removeDate')} size="small" variant="ghost" onPress={() => saveExpiry(lot, null)} disabled={saving} />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        {mergeableLots(lots).map((same) => (
          <Button
            key={same.map((lot) => lot.id).join(',')}
            label={t('lots.merge', { count: same.length, date: expiryLabel(t, same[0].expires_at, language) })}
            icon={Combine}
            variant="soft"
            size="medium"
            onPress={() => onMerge(same)}
          />
        ))}
        {onOpenFact ? <Button label={t('pantry.viewFact')} icon={BookOpen} variant="outline" size="medium" onPress={onOpenFact} /> : null}
        <Button label={t('pantry.removeFromPantry')} variant="danger" size="medium" onPress={onRemoveAll} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.secondary,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  lot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  lotText: {
    flex: 1,
    gap: spacing.xxs,
  },
  quantity: {
    ...typography.listTitle,
  },
  details: {
    ...typography.secondary,
  },
  remove: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editor: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
