import React from 'react';
import { StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Touchable } from '@/components/ui/Touchable';
import { colors, opacity, radius, sizes } from '@/constants/theme';

// Bouton rond « + » ou « − » des quantités
export function StepButton({ icon: Icon, label, disabled = false, onPress }: { icon: LucideIcon; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={sizes.icon} color={colors.primary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
