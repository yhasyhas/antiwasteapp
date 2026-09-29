import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  // Coche devant le libellé quand la puce est choisie (ingrédients de la génération)
  showCheck?: boolean;
  icon?: LucideIcon;
  // Couleur d'une icône non choisie (ex. point de péremption)
  iconColor?: string;
  accessibilityLabel?: string;
}

// Puce de filtre (arrondi complet, 44 px de haut) : choisie en vert plein, sinon blanche bordée
export function Chip({ label, selected = false, onPress, showCheck = false, icon: Icon, iconColor, accessibilityLabel }: Props) {
  const textColor = selected ? colors.onPrimary : colors.text;
  return (
    <Touchable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected && styles.selected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {selected && showCheck ? <Check size={sizes.iconSmall} color={textColor} /> : null}
      {Icon && !(selected && showCheck) ? <Icon size={sizes.iconSmall} color={selected ? textColor : iconColor ?? colors.primary} /> : null}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.listTitle,
  },
});
