import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Barcode, Camera } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

export type ScanMode = 'photo' | 'barcode';

// Choix du type de scan : photo des aliments (IA) ou code-barres d'un produit (Open Food Facts)
export function ScanModeToggle({ mode, onChange }: { mode: ScanMode; onChange: (mode: ScanMode) => void }) {
  const { t } = useLanguage();
  const options = [
    { value: 'photo' as const, label: t('barcode.modePhoto'), Icon: Camera },
    { value: 'barcode' as const, label: t('barcode.modeBarcode'), Icon: Barcode },
  ];

  return (
    <View style={styles.container}>
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(value)}
            accessibilityState={{ selected: active }}
          >
            <Icon size={18} color={active ? '#fff' : '#374151'} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: '#10b981',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  labelActive: {
    color: '#fff',
  },
});
