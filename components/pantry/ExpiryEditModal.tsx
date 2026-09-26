import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { expiryFromShelfLife } from '@/lib/expiry';
import { scanModalStyles } from '@/components/scan/scanModalStyles';
import type { PantryIngredient } from './IngredientCard';

interface Props {
  ingredient: PantryIngredient | null;
  saving: boolean;
  onSave: (expiresAt: string | null) => void;
  onClose: () => void;
}

// Modification de la date de péremption d'un ingrédient du garde-manger
export function ExpiryEditModal({ ingredient, saving, onSave, onClose }: Props) {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [value, setValue] = useState(() => expiryFromShelfLife(undefined));

  useEffect(() => {
    if (ingredient) setValue(ingredient.expires_at ?? expiryFromShelfLife(undefined, ingredient.kind));
  }, [ingredient]);

  return (
    <Modal visible={ingredient !== null} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={scanModalStyles.modalOverlay}>
        <View style={[scanModalStyles.modalContent, safe.bottom(24)]}>
          <View style={scanModalStyles.modalHeader}>
            <Text style={styles.title} numberOfLines={2}>{ingredient?.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>{t('expiry.label')}</Text>
          <ExpiryPicker value={value} onChange={setValue} />

          <TouchableOpacity style={styles.saveButton} onPress={() => onSave(value)} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t('expiry.save')}</Text>}
          </TouchableOpacity>
          {ingredient?.expires_at ? (
            <TouchableOpacity style={styles.removeButton} onPress={() => onSave(null)} disabled={saving}>
              <Text style={styles.removeButtonText}>{t('expiry.removeDate')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
