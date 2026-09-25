import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Lightbulb, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
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
}

interface Props {
  ingredient: PantryIngredient;
  deleting: boolean;
  onDelete: () => void;
  onEditExpiry: () => void;
}

const ORIGIN_STYLES: Record<string, { background: string; text: string; labelKey: 'pantry.scanned' | 'pantry.manual' | 'pantry.barcode' }> = {
  camera: { background: '#ede9fe', text: '#7c3aed', labelKey: 'pantry.scanned' },
  barcode: { background: '#e0e7ff', text: '#4338ca', labelKey: 'pantry.barcode' },
  manual: { background: '#dbeafe', text: '#2563eb', labelKey: 'pantry.manual' },
};

// Ingrédient du garde-manger : nom, quantité, date de péremption (badge de couleur, modifiable),
// reste de plat, origine, conseil de conservation, suppression
export function IngredientCard({ ingredient, deleting, onDelete, onEditExpiry }: Props) {
  const { t } = useLanguage();
  const origin = ORIGIN_STYLES[ingredient.added_via] ?? ORIGIN_STYLES.manual;

  return (
    <View style={styles.ingredientCard}>
      <View style={styles.ingredientInfo}>
        <Text style={styles.ingredientName}>{ingredient.name}</Text>
        {ingredient.quantity ? (
          <Text style={styles.ingredientQuantity}>
            {ingredient.quantity}
          </Text>
        ) : null}
        <View style={styles.ingredientMeta}>
          <ExpiryBadge expiresAt={ingredient.expires_at} onPress={onEditExpiry} />
          {ingredient.kind === 'dish' && (
            <View style={[styles.badge, styles.badgeLeftover]}>
              <Text style={[styles.badgeText, styles.badgeTextLeftover]}>{t('pantry.leftover')}</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: origin.background }]}>
            <Text style={[styles.badgeText, { color: origin.text }]}>{t(origin.labelKey)}</Text>
          </View>
        </View>
        {ingredient.storage_tip ? (
          <View style={styles.tip}>
            <Lightbulb size={14} color="#6b7280" />
            <Text style={styles.tipText}>{ingredient.storage_tip}</Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onDelete}
        disabled={deleting}
        style={styles.deleteButton}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#ef4444" />
        ) : (
          <Trash2 size={20} color="#ef4444" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  ingredientCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  ingredientMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeLeftover: {
    backgroundColor: '#fef3c7',
  },
  badgeTextLeftover: {
    color: '#b45309',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
  },
});
