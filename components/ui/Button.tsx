import React from 'react';
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'soft' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  // large : bouton principal (54 px) ; medium : 48 px ; small : 44 px (boutons dans une ligne)
  size?: 'large' | 'medium' | 'small';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const VARIANTS: Record<ButtonVariant, { background: string; text: string; border: string }> = {
  primary: { background: colors.primary, text: colors.onPrimary, border: colors.primary },
  accent: { background: colors.accent, text: colors.onAccent, border: colors.accent },
  outline: { background: colors.surface, text: colors.primary, border: colors.primary },
  soft: { background: colors.primarySoft, text: colors.primary, border: colors.primarySoft },
  ghost: { background: colors.transparent, text: colors.primary, border: colors.transparent },
  danger: { background: colors.transparent, text: colors.expired.text, border: colors.transparent },
};

const HEIGHTS = { large: sizes.primaryButton, medium: sizes.button, small: sizes.touch } as const;

// Bouton de l'app : principal (vert), accent (citron vert), contour, doux, texte seul, danger
export function Button({ label, onPress, variant = 'primary', size = 'large', icon: Icon, loading, disabled, style, accessibilityLabel }: Props) {
  const tone = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.button,
        { minHeight: HEIGHTS[size], backgroundColor: tone.background, borderColor: tone.border },
        size !== 'large' && styles.compact,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <>
          {Icon ? <Icon size={sizes.icon} color={tone.text} /> : null}
          {/* Grandes tailles de texte : deux lignes plutôt qu'un libellé tronqué */}
          <Text style={[styles.label, { color: tone.text }]} numberOfLines={2}>{label}</Text>
        </>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
  },
  compact: {
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  label: {
    ...typography.button,
    flexShrink: 1,
    textAlign: 'center',
  },
});
