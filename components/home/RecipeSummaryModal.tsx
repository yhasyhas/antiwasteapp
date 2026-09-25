import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import type { RecentRecipe } from './RecentRecipeCard';

// Résumé d'une recette récente (accueil)
export function RecipeSummaryModal({ recipe, onClose }: { recipe: RecentRecipe; onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={!!recipe}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{recipe.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.modalDescription}>
              {recipe.description}
            </Text>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Time & Difficulty</Text>
              <Text style={styles.modalText}>
                Prep: {recipe.prep_time} min | Cook:{' '}
                {recipe.cook_time} min
              </Text>
              <Text style={styles.modalText}>
                Difficulty: {recipe.difficulty}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  modalClose: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
