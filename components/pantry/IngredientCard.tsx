import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Trash2 } from 'lucide-react-native';

export interface PantryIngredient {
  id: string;
  name: string;
  quantity: string;
  added_via: string;
  created_at: string;
}

interface Props {
  ingredient: PantryIngredient;
  deleting: boolean;
  onDelete: () => void;
}

// Ingrédient du garde-manger : nom, quantité, origine (scan ou ajout manuel), suppression
export function IngredientCard({ ingredient, deleting, onDelete }: Props) {
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
          <View
            style={[
              styles.badge,
              ingredient.added_via === 'camera'
                ? styles.badgeCamera
                : styles.badgeManual,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                ingredient.added_via === 'camera'
                  ? styles.badgeTextCamera
                  : styles.badgeTextManual,
              ]}
            >
              {ingredient.added_via === 'camera'
                ? 'Scanned'
                : 'Manual'}
            </Text>
          </View>
        </View>
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
    alignItems: 'center',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeCamera: {
    backgroundColor: '#ede9fe',
  },
  badgeManual: {
    backgroundColor: '#dbeafe',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextCamera: {
    color: '#7c3aed',
  },
  badgeTextManual: {
    color: '#2563eb',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
  },
});
