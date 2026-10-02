import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

// expired / soon / ok : états de péremption ; leftover : « Reste » (citron vert doux) ;
// soft : vert doux (difficulté, catégorie) ; neutral : sans date ; outline : pastille bordée (durée) ;
// frozen : au congélateur (bleu frais)
export type BadgeTone = 'expired' | 'soon' | 'ok' | 'leftover' | 'soft' | 'neutral' | 'outline' | 'frozen';

const TONES: Record<BadgeTone, { background: string; text: string; border: string }> = {
  expired: { background: colors.expired.background, text: colors.expired.text, border: colors.expired.background },
  soon: { background: colors.soon.background, text: colors.soon.text, border: colors.soon.background },
  ok: { background: colors.ok.background, text: colors.ok.text, border: colors.ok.background },
  leftover: { background: colors.accentSoft, text: colors.onAccent, border: colors.accentSoft },
  soft: { background: colors.primarySoft, text: colors.primary, border: colors.primarySoft },
  neutral: { background: colors.primarySoft, text: colors.textSecondary, border: colors.primarySoft },
  outline: { background: colors.background, text: colors.text, border: colors.border },
  frozen: { background: colors.foodFamilies.cold.background, text: colors.foodFamilies.cold.icon, border: colors.foodFamilies.cold.background },
};

interface Props {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// Badge en pilule (texte 12 px)
export function Badge({ label, tone = 'soft', icon: Icon, onPress, accessibilityLabel, style }: Props) {
  const colorsOf = TONES[tone];
  const content = (
    <>
      {Icon ? <Icon size={sizes.iconSmall - 2} color={colorsOf.text} /> : null}
      <Text style={[styles.text, { color: colorsOf.text }]} numberOfLines={1}>{label}</Text>
    </>
  );
  const badgeStyle = [styles.badge, { backgroundColor: colorsOf.background, borderColor: colorsOf.border }, style];
  if (!onPress) return <View style={badgeStyle}>{content}</View>;
  return (
    // La pilule reste petite, la zone tactile fait 44 px (hitSlop)
    <Touchable onPress={onPress} style={badgeStyle} hitSlop={spacing.md} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
      {content}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
  },
  text: {
    ...typography.badge,
  },
});
