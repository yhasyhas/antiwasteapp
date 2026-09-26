import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Barcode } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

// Code-barres scanné, dans l'ajout manuel : produit trouvé (vérifier la date) ou inconnu (le nommer)
export function BarcodeNotice({ barcode, found }: { barcode: string; found: boolean }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.box, !found && styles.boxUnknown]}>
      <View style={styles.row}>
        <Barcode size={18} color="#374151" />
        <Text style={styles.code}>{barcode}</Text>
      </View>
      <Text style={styles.text}>{found ? t('barcode.foundHint') : t('barcode.unknownHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  boxUnknown: {
    backgroundColor: '#fff7ed',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  code: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 1,
  },
  text: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
});
