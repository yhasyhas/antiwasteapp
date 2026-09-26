import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import type { DetectedIngredient } from '@/hooks/useScan';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { scanModalStyles } from './scanModalStyles';

interface Props {
  visible: boolean;
  ingredients: DetectedIngredient[];
  onToggle: (index: number) => void;
  onExpiryChange: (index: number, expiresAt: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

// Ingrédients détectés sur la photo : l'utilisateur décoche ceux qu'il ne veut pas ajouter et peut
// changer la date de péremption proposée (toucher le badge de date)
export function ConfirmIngredientsModal({ visible, ingredients, onToggle, onExpiryChange, onConfirm, onClose }: Props) {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  // Ingrédient dont la date est en cours de modification
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={scanModalStyles.modalOverlay}>
        <View style={[scanModalStyles.modalContent, safe.bottom(24)]}>
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
              <View key={index} style={styles.confirmationItem}>
                <TouchableOpacity style={styles.confirmationRow} onPress={() => onToggle(index)}>
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
                {ing.confirmed && (
                  <View style={styles.details}>
                    <View style={styles.badges}>
                      <ExpiryBadge expiresAt={ing.expires_at} onPress={() => setEditing(editing === index ? null : index)} />
                      {ing.kind === 'dish' && (
                        <View style={styles.leftoverBadge}>
                          <Text style={styles.leftoverText}>{t('pantry.leftover')}</Text>
                        </View>
                      )}
                    </View>
                    {editing === index && (
                      <View style={styles.picker}>
                        <ExpiryPicker value={ing.expires_at} onChange={(iso) => onExpiryChange(index, iso)} />
                      </View>
                    )}
                  </View>
                )}
              </View>
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
    maxHeight: 420,
    marginBottom: 16,
  },
  confirmationItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  details: {
    marginLeft: 36,
    marginTop: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  leftoverBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
  },
  leftoverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
  picker: {
    marginTop: 10,
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
