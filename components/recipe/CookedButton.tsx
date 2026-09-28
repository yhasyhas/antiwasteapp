import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { cardStyles } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Touchable } from '@/components/ui/Touchable';
import { colors, sizes, spacing, typography } from '@/constants/theme';

interface Props {
  // Ingrédients de la recette ; pantry_id relie un ingrédient à celui du garde-manger (depuis la phase 3)
  ingredientsUsed: Array<{ name: string; pantry_id?: string | null }> | null | undefined;
  // Conteneur du bouton (barre fixée en bas de la fiche recette)
  style?: StyleProp<ViewStyle>;
}

interface PantryRow {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
}

// « J'ai cuisiné ça » : liste les ingrédients du garde-manger utilisés par la recette, tous cochés ;
// l'utilisateur décoche ce qu'il lui reste, puis les ingrédients cochés sont retirés du garde-manger
export function CookedButton({ ingredientsUsed, style }: Props) {
  const { t } = useLanguage();
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
    // Retirés et comptés « sauvés » (compteur anti-gaspi)
    const { error } = await supabase.rpc('cook_ingredients', { p_ids: ids });
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
    <View style={style}>
      <Button label={t('cooked.button')} icon={Check} onPress={open} loading={loading} />

      <BottomSheet visible={rows !== null} onClose={() => setRows(null)}>
        <SheetHeader title={t('cooked.title')} subtitle={t('cooked.subtitle')} onClose={() => setRows(null)} />
        <ScrollView style={styles.list}>
          {(rows ?? []).map((row, index) => (
            <View key={row.id}>
              {index > 0 ? <View style={cardStyles.divider} /> : null}
              <Touchable
                scale={false}
                style={styles.item}
                onPress={() => toggle(row.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.checked }}
              >
                <Checkbox checked={row.checked} />
                <View style={styles.itemText}>
                  <Text style={[styles.name, !row.checked && styles.kept]}>{row.name}</Text>
                  {row.quantity ? <Text style={styles.quantity}>{row.quantity}</Text> : null}
                </View>
                {!row.checked && <Text style={styles.keptLabel}>{t('cooked.kept')}</Text>}
              </Touchable>
            </View>
          ))}
        </ScrollView>
        <Button
          label={checkedCount > 0 ? t('cooked.confirm', { count: checkedCount }) : t('cooked.keepAll')}
          onPress={confirm}
          loading={removing}
          style={styles.confirm}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: sizes.touch + spacing.md,
  },
  itemText: {
    flex: 1,
  },
  name: {
    ...typography.listTitle,
  },
  kept: {
    color: colors.textSecondary,
  },
  quantity: {
    ...typography.secondary,
  },
  keptLabel: {
    ...typography.badge,
    color: colors.primary,
  },
  confirm: {
    marginTop: spacing.lg,
  },
});
