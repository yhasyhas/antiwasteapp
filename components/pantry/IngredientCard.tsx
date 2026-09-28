import React, { useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Info, Leaf, Trash2, UtensilsCrossed } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { Touchable } from '@/components/ui/Touchable';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import type { FoodKind } from '@/lib/expiry';

export interface PantryIngredient {
  id: string;
  name: string;
  quantity: string;
  added_via: string;
  created_at: string;
  expires_at: string | null;
  category: string | null;
  kind: FoodKind;
  storage_tip: string | null;
  barcode: string | null;
  // Auteur (null : compte supprimé)
  user_id: string | null;
  // Identifiant standard (fiche aliment) ; null avant la première ouverture de la fiche
  food_key?: string | null;
}

interface Props {
  ingredient: PantryIngredient;
  deleting: boolean;
  onDelete: () => void;
  onEditExpiry: () => void;
  // Foyer partagé : nom de celui qui l'a ajouté (sinon non affiché)
  addedBy?: string;
  // Fiche de l'aliment (pas pour un plat cuisiné)
  onOpenFact?: () => void;
}

// Aliment du garde-manger : nom, quantité, auteur, conseil de conservation, badges de date (touchable
// pour la modifier) et de reste. Toucher la carte ouvre la fiche de l'aliment ; glisser vers la gauche
// ou appui long : supprimer (ou les autres actions).
export function IngredientCard({ ingredient, deleting, onDelete, onEditExpiry, addedBy, onOpenFact }: Props) {
  const { t } = useLanguage();
  const swipeable = useRef<SwipeableMethods>(null);
  const isDish = ingredient.kind === 'dish';
  const openFact = onOpenFact && !isDish ? onOpenFact : undefined;
  const details = [ingredient.quantity, addedBy ? t('household.addedBy', { name: addedBy }).toLowerCase() : null].filter(Boolean).join(' · ');

  // Appui long : toutes les actions de l'aliment
  const showActions = () => {
    Alert.alert(ingredient.name, undefined, [
      ...(openFact ? [{ text: t('pantry.viewFact'), onPress: openFact }] : []),
      { text: t('expiry.edit'), onPress: onEditExpiry },
      { text: t('common.delete'), style: 'destructive' as const, onPress: onDelete },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const deleteAction = () => (
    <Touchable
      onPress={() => {
        swipeable.current?.close();
        onDelete();
      }}
      style={styles.deleteAction}
      accessibilityRole="button"
      accessibilityLabel={t('common.delete')}
    >
      {deleting ? <ActivityIndicator color={colors.onPrimary} /> : <Trash2 size={sizes.iconLarge} color={colors.onPrimary} />}
      <Text style={styles.deleteText}>{t('common.delete')}</Text>
    </Touchable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      renderRightActions={deleteAction}
      rightThreshold={sizes.fab}
      overshootRight={false}
      containerStyle={styles.swipe}
    >
      <Card
        onPress={openFact ?? showActions}
        onLongPress={showActions}
        style={styles.card}
        accessibilityLabel={openFact ? `${ingredient.name}, ${t('facts.open')}` : ingredient.name}
      >
        <IconChip icon={isDish ? UtensilsCrossed : Leaf} tone={isDish ? 'accent' : 'soft'} />
        <View style={styles.body}>
          <Text style={styles.name}>{ingredient.name}</Text>
          {details ? <Text style={styles.details}>{details}</Text> : null}
          {ingredient.storage_tip ? (
            <View style={styles.tip}>
              <Info size={sizes.iconSmall - 2} color={colors.textSecondary} />
              <Text style={styles.tipText}>{ingredient.storage_tip}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          <ExpiryBadge expiresAt={ingredient.expires_at} onPress={onEditExpiry} />
          {isDish ? <Badge label={t('pantry.leftover')} tone="leftover" /> : null}
        </View>
      </Card>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  swipe: {
    marginBottom: spacing.md,
    borderRadius: radius.card,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.cardTitle,
  },
  details: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  tipText: {
    ...typography.secondary,
    flex: 1,
  },
  badges: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  deleteAction: {
    width: sizes.fab + spacing.xxl,
    marginLeft: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.expired.text,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  deleteText: {
    ...typography.badge,
    color: colors.onPrimary,
  },
});
