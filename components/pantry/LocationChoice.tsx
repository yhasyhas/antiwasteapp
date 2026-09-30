import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Chip } from '@/components/ui/Chip';
import { LOCATIONS, type StorageLocation } from '@/lib/storage';
import { spacing } from '@/constants/theme';

// Emplacement d'un aliment à l'ajout (scan, saisie) : frigo, congélateur ou placard, proposé selon l'aliment
export function LocationChoice({ value, onChange }: { value: StorageLocation; onChange: (location: StorageLocation) => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.row} accessibilityLabel={t('storage.location')}>
      {LOCATIONS.map((location) => (
        <Chip key={location} label={t(`storage.${location}`)} selected={value === location} onPress={() => onChange(location)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
