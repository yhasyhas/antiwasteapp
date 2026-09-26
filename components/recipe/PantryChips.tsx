import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, Soup } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { EXPIRY_COLORS, expiryStatus, type FoodKind } from '@/lib/expiry';

export interface ChipIngredient {
  id: string;
  name: string;
  expires_at: string | null;
  kind: FoodKind;
}

interface Props {
  ingredients: ChipIngredient[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

const COLLAPSED_COUNT = 8;

// Ingrédients du garde-manger (triés par urgence) : pastille de couleur selon la date, icône pour les
// restes. Toucher des ingrédients les sélectionne : la génération ne cuisine alors qu'avec eux.
export function PantryChips({ ingredients, selectedIds, onToggle, onClear }: Props) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  // Les ingrédients choisis restent visibles même repliés
  const visible = expanded
    ? ingredients
    : ingredients.filter((ing, i) => i < COLLAPSED_COUNT || selectedIds.includes(ing.id));
  const hidden = ingredients.length - visible.length;

  return (
    <View>
      <View style={styles.hintRow}>
        <Text style={styles.hint}>
          {selectedIds.length > 0 ? t('generate.selectionActive', { count: selectedIds.length }) : t('generate.priorityHint')}
        </Text>
        {selectedIds.length > 0 && (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={styles.clear}>{t('generate.clearSelection')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.grid}>
        {visible.map((ingredient) => {
          const selected = selectedIds.includes(ingredient.id);
          const status = expiryStatus(ingredient.expires_at);
          return (
            <TouchableOpacity
              key={ingredient.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onToggle(ingredient.id)}
              accessibilityState={{ selected }}
            >
              {selected ? (
                <Check size={14} color="#fff" />
              ) : status === 'expired' || status === 'soon' ? (
                <View style={[styles.dot, { backgroundColor: EXPIRY_COLORS[status].text }]} />
              ) : null}
              {ingredient.kind === 'dish' && <Soup size={14} color={selected ? '#fff' : '#b45309'} />}
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{ingredient.name}</Text>
            </TouchableOpacity>
          );
        })}
        {hidden > 0 && (
          <TouchableOpacity style={styles.chip} onPress={() => setExpanded(true)}>
            <Text style={styles.chipText}>{t('generate.more', { count: hidden })}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  clear: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  chipSelected: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
