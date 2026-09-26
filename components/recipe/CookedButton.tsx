import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Check, CookingPot, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { scanModalStyles } from '@/components/scan/scanModalStyles';

interface Props {
  // Ingrédients de la recette ; pantry_id relie un ingrédient à celui du garde-manger (depuis la phase 3)
  ingredientsUsed: Array<{ name: string; pantry_id?: string | null }> | null | undefined;
}

interface PantryRow {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
}

// « J'ai cuisiné ça » : liste les ingrédients du garde-manger utilisés par la recette, tous cochés ;
// l'utilisateur décoche ce qu'il lui reste, puis les ingrédients cochés sont retirés du garde-manger
export function CookedButton({ ingredientsUsed }: Props) {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [rows, setRows] = useState<PantryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const pantryIds = [...new Set((ingredientsUsed ?? []).map((i) => i?.pantry_id).filter((id): id is string => !!id))];
  // Recettes d'avant la phase 3 : pas d'identifiants, rien à retirer
  if (pantryIds.length === 0) return null;

  const open = async () => {
    setLoading(true);
    // Seulement ceux encore présents (d'autres ont pu être retirés entre-temps)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, quantity')
      .in('id', pantryIds);
    setLoading(false);
    if (error) {
      Alert.alert(t('common.error'), t('errors.writeText'));
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert(t('cooked.button'), t('cooked.nothingLeft'));
      return;
    }
    setRows(data.map((row) => ({ ...row, checked: true })));
  };

  const toggle = (id: string) => {
    setRows((current) => current?.map((row) => row.id === id ? { ...row, checked: !row.checked } : row) ?? null);
  };

  const confirm = async () => {
    const ids = (rows ?? []).filter((row) => row.checked).map((row) => row.id);
    if (ids.length === 0) {
      setRows(null);
      return;
    }
    setRemoving(true);
    const { error } = await supabase.from('ingredients').delete().in('id', ids);
    setRemoving(false);
    if (error) {
      alertWriteError(t, 'removing cooked ingredients', error);
      return;
    }
    setRows(null);
    notifyPantryChanged();
    Alert.alert(t('cooked.doneTitle'), t('cooked.doneText', { count: ids.length }));
  };

  const checkedCount = (rows ?? []).filter((row) => row.checked).length;

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={open} disabled={loading}>
        {loading ? <ActivityIndicator color="#047857" /> : <CookingPot size={20} color="#047857" />}
        <Text style={styles.buttonText}>{t('cooked.button')}</Text>
      </TouchableOpacity>

      <Modal visible={rows !== null} animationType="slide" transparent={true} onRequestClose={() => setRows(null)}>
        <View style={scanModalStyles.modalOverlay}>
          <View style={[scanModalStyles.modalContent, safe.bottom(24)]}>
            <View style={scanModalStyles.modalHeader}>
              <Text style={scanModalStyles.modalTitle}>{t('cooked.title')}</Text>
              <TouchableOpacity onPress={() => setRows(null)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{t('cooked.subtitle')}</Text>

            <ScrollView style={styles.list}>
              {(rows ?? []).map((row) => (
                <TouchableOpacity key={row.id} style={styles.item} onPress={() => toggle(row.id)}>
                  <View style={[styles.checkbox, row.checked && styles.checkboxChecked]}>
                    {row.checked && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={[styles.itemText, !row.checked && styles.itemTextKept]}>{row.name}</Text>
                  {row.quantity ? <Text style={styles.itemQuantity}>{row.quantity}</Text> : null}
                  {!row.checked && <Text style={styles.kept}>{t('cooked.kept')}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.confirmButton} onPress={confirm} disabled={removing}>
              {removing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {checkedCount > 0 ? t('cooked.confirm', { count: checkedCount }) : t('cooked.keepAll')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    marginTop: 12,
  },
  buttonText: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  list: {
    maxHeight: 360,
    marginBottom: 16,
  },
  item: {
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
  itemText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  itemTextKept: {
    color: '#6b7280',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  kept: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
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
