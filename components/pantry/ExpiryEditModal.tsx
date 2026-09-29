import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { ExpiryPicker } from '@/components/expiry/ExpiryPicker';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { expiryFromShelfLife } from '@/lib/expiry';
import { spacing, typography } from '@/constants/theme';
import type { PantryIngredient } from './IngredientCard';

interface Props {
  ingredient: PantryIngredient | null;
  saving: boolean;
  onSave: (expiresAt: string | null) => void;
  onClose: () => void;
}

// Modification de la date de péremption d'un ingrédient du garde-manger (feuille du bas)
export function ExpiryEditModal({ ingredient, saving, onSave, onClose }: Props) {
  const { t } = useLanguage();
  const [value, setValue] = useState(() => expiryFromShelfLife(undefined));
  // Nom gardé pendant l'animation de fermeture
  const [name, setName] = useState('');

  useEffect(() => {
    if (!ingredient) return;
    setName(ingredient.name);
    setValue(ingredient.expires_at ?? expiryFromShelfLife(undefined, ingredient.kind));
  }, [ingredient]);

  return (
    <BottomSheet visible={ingredient !== null} onClose={onClose}>
      <SheetHeader title={name} onClose={onClose} />
      <Text style={styles.label}>{t('expiry.label')}</Text>
      <ExpiryPicker value={value} onChange={setValue} />
      <View style={styles.actions}>
        <Button label={t('expiry.save')} onPress={() => onSave(value)} loading={saving} />
        {ingredient?.expires_at ? (
          <Button label={t('expiry.removeDate')} variant="ghost" onPress={() => onSave(null)} disabled={saving} />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
});
