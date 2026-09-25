import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { difficultyLabel } from '@/lib/labels';
import { cuisineOptions, dietaryOptions, difficultyOptions, languages, mealTypes } from './options';
import { modalStyles } from './modalStyles';
import type { Filters } from './types';

interface Props {
  visible: boolean;
  filters: Filters;
  onChange: (filters: Filters) => void;
  onToggleDietary: (option: string) => void;
  onClose: () => void;
}

// Fenêtre des préférences de génération : type de repas, cuisine, langue, régimes, difficulté
export function FiltersModal({ visible, filters, onChange, onToggleDietary, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContent}>
          <View style={modalStyles.modalHeader}>
            <Text style={modalStyles.modalTitle}>{t('generate.filtersTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Type de repas */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>{t('generate.mealType')}</Text>
              <View style={styles.mealTypeGrid}>
                {mealTypes.map((meal) => (
                  <TouchableOpacity
                    key={meal.value}
                    style={[
                      styles.mealTypeCard,
                      filters.mealType === meal.value && styles.mealTypeCardSelected,
                      { borderColor: meal.color }
                    ]}
                    onPress={() => onChange({ ...filters, mealType: meal.value })}
                  >
                    <View style={[styles.mealTypeIcon, { backgroundColor: meal.color + '20' }]}>
                      <meal.icon size={24} color={meal.color} />
                    </View>
                    <Text style={[
                      styles.mealTypeLabel,
                      filters.mealType === meal.value && styles.mealTypeLabelSelected
                    ]}>
                      {t(meal.labelKey)}
                    </Text>
                    {filters.mealType === meal.value && (
                      <View style={[styles.checkBadge, { backgroundColor: meal.color }]}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cuisines du monde */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>{t('cuisine.title')}</Text>
              <View style={styles.optionGrid}>
                {cuisineOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionChip,
                      filters.cuisine === option.value && styles.optionChipSelected,
                    ]}
                    onPress={() => onChange({ ...filters, cuisine: option.value })}
                  >
                    {filters.cuisine === option.value && (
                      <Check size={16} color="#fff" />
                    )}
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.cuisine === option.value && styles.optionChipTextSelected,
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Langue des recettes */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>{t('generate.recipeLanguage')}</Text>
              <View style={styles.languageRow}>
                {languages.map((lang) => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[
                      styles.languageChip,
                      filters.language === lang.value && styles.languageChipSelected,
                    ]}
                    onPress={() => onChange({ ...filters, language: lang.value })}
                  >
                    <Text style={styles.languageFlag}>{lang.flag}</Text>
                    <Text style={[
                      styles.languageText,
                      filters.language === lang.value && styles.languageTextSelected
                    ]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Préférences diététiques */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>{t('generate.dietary')}</Text>
              <View style={styles.optionGrid}>
                {dietaryOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionChip,
                      filters.dietary.includes(option.value) &&
                        styles.optionChipSelected,
                    ]}
                    onPress={() => onToggleDietary(option.value)}
                  >
                    {filters.dietary.includes(option.value) && (
                      <Check size={16} color="#fff" />
                    )}
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.dietary.includes(option.value) &&
                          styles.optionChipTextSelected,
                      ]}
                    >
                      {t(option.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Difficulté */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>{t('generate.difficulty')}</Text>
              <View style={styles.optionGrid}>
                {difficultyOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionChip,
                      filters.difficulty === option &&
                        styles.optionChipSelected,
                    ]}
                    onPress={() =>
                      onChange({ ...filters, difficulty: option })
                    }
                  >
                    {filters.difficulty === option && (
                      <Check size={16} color="#fff" />
                    )}
                    <Text
                      style={[
                        styles.optionChipText,
                        filters.difficulty === option &&
                          styles.optionChipTextSelected,
                      ]}
                    >
                      {difficultyLabel(t, option)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={onClose}
          >
            <Text style={styles.applyButtonText}>{t('generate.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterGroup: {
    marginBottom: 24,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealTypeCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    gap: 8,
  },
  mealTypeCardSelected: {
    backgroundColor: '#fff',
    borderWidth: 3,
  },
  mealTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  mealTypeLabelSelected: {
    color: '#111827',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  languageChipSelected: {
    backgroundColor: '#10b981',
  },
  languageFlag: {
    fontSize: 20,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  languageTextSelected: {
    color: '#fff',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  optionChipSelected: {
    backgroundColor: '#10b981',
  },
  optionChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#fff',
  },
  applyButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
