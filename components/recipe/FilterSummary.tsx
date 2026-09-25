import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Filter, Globe } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { cuisineOptions, getMealTypeIcon, getMealTypeLabel, mealTypes } from './options';
import type { Filters } from './types';

// Bouton « Preferences » et aperçu des filtres actifs
export function FilterSummary({ filters, onOpen }: { filters: Filters; onOpen: () => void }) {
  const { t } = useLanguage();

  return (
    <View style={styles.filterSection}>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={onOpen}
      >
        <Filter size={20} color="#10b981" />
        <Text style={styles.filterButtonText}>Preferences</Text>
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>
            {filters.dietary.length + 2} {/* +2 pour mealType et difficulty */}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Affichage rapide des filtres actifs */}
      <View style={styles.activeFilters}>
        <View style={[styles.activeFilterChip, { backgroundColor: mealTypes.find(m => m.value === filters.mealType)?.color || '#10b981' }]}>
          {React.createElement(getMealTypeIcon(filters.mealType), { size: 14, color: '#fff' })}
          <Text style={styles.activeFilterText}>{getMealTypeLabel(filters.mealType)}</Text>
        </View>
        <View style={styles.activeFilterChip}>
          <Text style={styles.activeFilterText}>{filters.difficulty}</Text>
        </View>
        <View style={styles.activeFilterChip}>
          <Globe size={14} color="#fff" />
          <Text style={styles.activeFilterText}>{filters.language.toUpperCase()}</Text>
        </View>
        {filters.cuisine !== 'any' && (
          <View style={styles.activeFilterChip}>
            <Text style={styles.activeFilterText}>
              {t(cuisineOptions.find((c) => c.value === filters.cuisine)?.labelKey || 'cuisineAny')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterSection: {
    marginBottom: 24,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  filterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  filterBadge: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
