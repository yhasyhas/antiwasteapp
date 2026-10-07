import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Barcode, Camera, ReceiptText } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Touchable } from '@/components/ui/Touchable';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

export type ScanMode = 'photo' | 'receipt' | 'barcode';

// Choix du type de scan : photo des aliments (IA), ticket de caisse (IA, produits alimentaires seulement) ou code-barres
// d'un produit (Open Food Facts)
export function ScanModeToggle({ mode, onChange }: { mode: ScanMode; onChange: (mode: ScanMode) => void }) {
  const { t } = useLanguage();
  const options = [
    { value: 'photo' as const, label: t('barcode.modePhoto'), Icon: Camera },
    { value: 'receipt' as const, label: t('barcode.modeReceipt'), Icon: ReceiptText },
    { value: 'barcode' as const, label: t('barcode.modeBarcode'), Icon: Barcode },
  ];

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        const color = active ? colors.onPrimary : colors.text;
        return (
          <Touchable
            key={value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Icon size={sizes.icon} color={color} />
            {/* Trois choix sur une ligne : le texte rétrécit plutôt que de passer à la ligne (grandes tailles de texte) */}
            <Text style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.control + spacing.xs,
    padding: spacing.xs,
  },
  option: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    borderRadius: radius.control,
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.button,
    flexShrink: 1,
  },
});
