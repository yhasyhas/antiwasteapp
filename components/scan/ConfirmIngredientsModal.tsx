import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DetectedIngredient } from '@/hooks/useScan';
import { scanModalStyles } from './scanModalStyles';

interface Props {
  visible: boolean;
  ingredients: DetectedIngredient[];
  onToggle: (index: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

// Ingrédients détectés sur la photo : l'utilisateur décoche ceux qu'il ne veut pas ajouter
export function ConfirmIngredientsModal({ visible, ingredients, onToggle, onConfirm, onClose }: Props) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={scanModalStyles.modalOverlay}>
        <View style={scanModalStyles.modalContent}>
          <View style={scanModalStyles.modalHeader}>
            <Text style={scanModalStyles.modalTitle}>{t('scan.confirmTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.confirmationSubtitle}>
            {t('scan.confirmSubtitle')}
          </Text>

          <ScrollView style={styles.confirmationList}>
            {ingredients.map((ing, index) => (
              <TouchableOpacity
                key={index}
                style={styles.confirmationItem}
                onPress={() => onToggle(index)}
              >
                <View style={[styles.checkbox, ing.confirmed && styles.checkboxChecked]}>
                  {ing.confirmed && <Check size={16} color="#fff" />}
                </View>
                <Text style={[styles.confirmationText, !ing.confirmed && styles.confirmationTextUnchecked]}>
                  {ing.name}
                </Text>
                {ing.quantity !== '' && (
                  <Text style={styles.confirmationQuantity}>{ing.quantity}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onConfirm}
          >
            <Text style={styles.confirmButtonText}>
              {t('scan.addCount', { count: ingredients.filter(i => i.confirmed).length })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  confirmationSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmationList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  confirmationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  confirmationText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  confirmationTextUnchecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  confirmationQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
