import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Combine, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Touchable } from '@/components/ui/Touchable';
import { addedWhen, expiryFromShelfLife, expiryLabel } from '@/lib/expiry';
import { lotLabel, mergeableLots, totalLabel, type LotGroup } from '@/lib/pantryLots';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import type { PantryIngredient } from './IngredientCard';

interface Props {
  group: LotGroup<PantryIngredient>;
  // Foyer partagé : « Ajouté par … » d'un lot (sinon null)
  addedBy: (lot: PantryIngredient) => string | null;
  onRemoveLot: (lot: PantryIngredient) => void;
  onRemoveAll: () => void;
  // Renvoie vrai si la date est enregistrée
  onSaveExpiry: (lot: PantryIngredient, expiresAt: string | null) => Promise<boolean>;
  onMerge: (lots: PantryIngredient[]) => void;
}

// « Dans ton garde-manger », en haut de la feuille d'un aliment : ses lots, du plus ancien au plus récent (même
// un seul), avec quantité, date (touchable pour la modifier), auteur et date d'ajout ; retirer un lot,
// fusionner les lots de même date et même unité, retirer l'aliment entier
export function PantryLotsSection({ group, addedBy, onRemoveLot, onRemoveAll, onSaveExpiry, onMerge }: Props) {
  const { t, language } = useLanguage();
  // Lot dont la date est en cours de modification
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { lots } = group;
  const multiple = lots.length > 1;

  const saveExpiry = async (lot: PantryIngredient, expiresAt: string | null) => {
    setSaving(true);
    const saved = await onSaveExpiry(lot, expiresAt);
    setSaving(false);
    if (saved) setEditing(null);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('lots.inPantry')}</Text>
        {multiple ? (
          <Text style={styles.total}>{[t('lots.total', { quantity: totalLabel(lots, language) }), t('lots.count', { count: lots.length })].join(' · ')}</Text>
        ) : null}
        {multiple ? <Text style={styles.hint}>{t('lots.order')}</Text> : null}
      </View>

      {lots.map((lot) => {
        const by = addedBy(lot);
        const when = addedWhen(t, lot.created_at, language);
        const isEditing = editing?.id === lot.id;
        return (
          <View key={lot.id}>
            <View style={cardStyles.divider} />
            <View style={styles.lot}>
              <View style={styles.lotText}>
                <Text style={styles.quantity}>{lotLabel(lot, lots, language) || lot.name}</Text>
                <Text style={styles.details}>{by ? `${by} · ${when}` : t('lots.addedWhen', { when })}</Text>
              </View>
              <ExpiryBadge
                expiresAt={lot.expires_at}
                onPress={() => setEditing(isEditing ? null : { id: lot.id, value: lot.expires_at ?? expiryFromShelfLife(undefined, lot.kind) })}
              />
              {multiple ? (
                <Touchable onPress={() => onRemoveLot(lot)} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('lots.remove')}>
                  <Trash2 size={sizes.icon} color={colors.expired.text} />
                </Touchable>
              ) : null}
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
        <Button label={t('pantry.removeFromPantry')} icon={Trash2} variant="danger" size="medium" onPress={onRemoveAll} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.cardTitle,
  },
  total: {
    ...typography.bodyMedium,
  },
  hint: {
    ...typography.secondary,
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
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
