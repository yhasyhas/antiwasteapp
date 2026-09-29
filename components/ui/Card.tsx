import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, sizes, spacing } from '@/constants/theme';
import { Touchable } from './Touchable';

interface Props {
  children: React.ReactNode;
  // surface : blanche et bordée ; soft : vert doux sans bordure (compteur, invitation)
  variant?: 'surface' | 'soft';
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// Carte de l'app (arrondi 18) ; touchable si onPress est fourni
export function Card({ children, variant = 'surface', onPress, onLongPress, style, accessibilityLabel }: Props) {
  const cardStyle = [styles.card, variant === 'soft' && styles.soft, style];
  if (!onPress && !onLongPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Touchable onPress={onPress} onLongPress={onLongPress} style={cardStyle} accessibilityLabel={accessibilityLabel}>
      {children}
    </Touchable>
  );
}

export const cardStyles = StyleSheet.create({
  divider: {
    height: sizes.borderWidth,
    backgroundColor: colors.border,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  soft: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
});
