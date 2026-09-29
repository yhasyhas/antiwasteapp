import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Barcode } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

// Code-barres scanné, dans l'ajout manuel : produit trouvé (vérifier la date) ou inconnu (le nommer)
export function BarcodeNotice({ barcode, found }: { barcode: string; found: boolean }) {
  const { t } = useLanguage();

  return (
    <View style={[styles.box, !found && styles.boxUnknown]}>
      <View style={styles.row}>
        <Barcode size={sizes.icon} color={colors.text} />
        <Text style={styles.code}>{barcode}</Text>
      </View>
      <Text style={styles.text}>{found ? t('barcode.foundHint') : t('barcode.unknownHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: spacing.sm,
  },
  boxUnknown: {
    backgroundColor: colors.soon.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  code: {
    ...typography.bodyStrong,
    letterSpacing: spacing.xxs,
  },
  text: {
    ...typography.secondary,
    color: colors.text,
  },
});
