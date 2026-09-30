import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, sizes } from '@/constants/theme';

// soft : vert doux ; accent : citron vert doux ; danger : rouge doux ; primary : vert plein (logo)
export type IconChipTone = 'soft' | 'accent' | 'danger' | 'primary';

const TONES: Record<IconChipTone, { background: string; icon: string }> = {
  soft: { background: colors.primarySoft, icon: colors.primary },
  accent: { background: colors.accentSoft, icon: colors.primary },
  danger: { background: colors.expired.background, icon: colors.expired.text },
  primary: { background: colors.primary, icon: colors.accent },
};

interface Props {
  icon: LucideIcon;
  tone?: IconChipTone;
  // Couleurs précises (jetons du thème), à la place du ton : pastilles des aliments par famille
  palette?: { background: string; icon: string };
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Pastille d'icône (carré arrondi 12) devant une ligne ou dans une carte
export function IconChip({ icon: Icon, tone = 'soft', palette, size = sizes.iconChip, style }: Props) {
  const colorsOf = palette ?? TONES[tone];
  return (
    <View style={[styles.chip, { width: size, height: size, backgroundColor: colorsOf.background }, style]}>
      <Icon size={Math.round(size * 0.5)} color={colorsOf.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.iconChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
