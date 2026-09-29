import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import { IconChip, type IconChipTone } from './IconChip';
import { Touchable } from './Touchable';

interface Props {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconTone?: IconChipTone;
  // Élément à droite (interrupteur, badge) ; sinon chevron si la ligne est touchable
  right?: React.ReactNode;
  onPress?: () => void;
  // Ligne d'action dangereuse (Se déconnecter) : texte rouge
  danger?: boolean;
  // Trait de séparation au-dessus (lignes suivantes d'une carte)
  divider?: boolean;
  accessibilityLabel?: string;
}

// Ligne de liste dans une carte : pastille d'icône, titre, sous-titre, élément à droite
export function ListRow({ title, subtitle, icon, iconTone, right, onPress, danger = false, divider = false, accessibilityLabel }: Props) {
  const content = (
    <>
      {icon ? <IconChip icon={icon} tone={danger ? 'danger' : iconTone} /> : null}
      <View style={styles.text}>
        <Text style={[styles.title, danger && styles.danger]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress && !danger ? <ChevronRight size={sizes.icon} color={colors.textSecondary} /> : null)}
    </>
  );

  return (
    <View>
      {divider ? <View style={styles.divider} /> : null}
      {onPress ? (
        <Touchable onPress={onPress} scale={false} style={styles.row} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
          {content}
        </Touchable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touch + spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    height: sizes.borderWidth,
    backgroundColor: colors.border,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.bodyStrong,
  },
  danger: {
    color: colors.expired.text,
  },
  subtitle: {
    ...typography.secondary,
  },
});
