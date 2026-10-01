import React, { useRef } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Info, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Touchable } from '@/components/ui/Touchable';
import { WordClampText } from '@/components/ui/WordClampText';
import { FoodIcon } from './FoodIcon';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import type { FoodKind } from '@/lib/expiry';
import { displayQuantity } from '@/lib/quantity';

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
  // Produit scanné par code-barres (Open Food Facts) ; vides pour les autres aliments
  product_name?: string | null;
  generic_name?: string | null;
  brand?: string | null;
  nova_group?: number | null;
  nutriscore_grade?: string | null;
  off_categories?: string[] | null;
  // Rangement (phase 8) : vides pour un lot rétabli d'avant la phase 8 (valeurs par défaut de lib/storage.ts)
  location?: string | null;
  date_kind?: string | null;
  opened_at?: string | null;
  frozen_at?: string | null;
  thawed_at?: string | null;
  // Date estimée par l'app (scan photo, valeur proposée, congélation…), pas lue sur l'emballage
  expiry_estimated?: boolean | null;
}

interface Props {
  ingredient: PantryIngredient;
  // Nom affiché (celui de la fiche dans la langue de l'app, sinon le nom enregistré)
  displayName?: string;
  onDelete: () => void;
  onEditExpiry: () => void;
  // Foyer partagé : nom de celui qui l'a ajouté (sinon non affiché)
  addedBy?: string;
  // Feuille de l'aliment : ses lots, puis sa fiche
  onOpenFact?: () => void;
  // Produit par code-barres : nom générique, sous le nom
  subtitle?: string | null;
  // Aliment en plusieurs lots : quantité totale et nombre de lots (date : la plus proche)
  quantityLabel?: string;
  lotCount?: number;
}

// Aliment du garde-manger : nom, quantité, auteur, conseil de conservation, badges de date (touchable
// pour la modifier) et de reste. Toucher la carte ouvre la feuille de l'aliment (lots, fiche) ; glisser vers la gauche
// ou appui long : supprimer (ou les autres actions).
export function IngredientCard({ ingredient, displayName, onDelete, onEditExpiry, addedBy, onOpenFact, subtitle, quantityLabel, lotCount = 1 }: Props) {
  const { t, language } = useLanguage();
  const swipeable = useRef<SwipeableMethods>(null);
  const isDish = ingredient.kind === 'dish';
  const name = displayName ?? ingredient.name;
  const openFact = onOpenFact;
  // « ajouté par Awa » : seule la première lettre de la phrase passe en minuscule, le prénom garde sa majuscule
  const details = [quantityLabel ?? displayQuantity(ingredient.quantity, language), lotCount > 1 ? t('lots.count', { count: lotCount }) : null, addedBy ? addedBy.charAt(0).toLowerCase() + addedBy.slice(1) : null].filter(Boolean).join(' · ');

  // Appui long : toutes les actions de l'aliment
  const showActions = () => {
    Alert.alert(name, undefined, [
      ...(openFact ? [{ text: isDish ? t('pantry.viewDetails') : t('pantry.viewFact'), onPress: openFact }] : []),
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
      <Trash2 size={sizes.iconLarge} color={colors.onPrimary} />
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
        accessibilityLabel={openFact ? `${name}, ${isDish ? t('pantry.viewDetails') : t('facts.open')}` : name}
      >
        <FoodIcon category={ingredient.category} kind={ingredient.kind} />
        <View style={styles.body}>
          <Text style={styles.name}>{name}</Text>
          {subtitle ? <WordClampText style={styles.subtitle}>{subtitle}</WordClampText> : null}
          {details ? <Text style={styles.details}>{details}</Text> : null}
          {ingredient.storage_tip ? (
            <View style={styles.tip}>
              <Info size={sizes.iconSmall - 2} color={colors.textSecondary} />
              <Text style={styles.tipText}>{ingredient.storage_tip}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          <ExpiryBadge expiresAt={ingredient.expires_at} dateKind={ingredient.date_kind} location={ingredient.location} onPress={onEditExpiry} />
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
  subtitle: {
    ...typography.secondary,
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
