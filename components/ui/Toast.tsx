import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { colors, motion, radius, shadows, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

interface Props {
  // Message affiché (« Aliment retiré »), ou null pour cacher
  message: string | null;
  // Action proposée (« Annuler », « Voir ») ; sans action : simple information
  actionLabel?: string;
  onAction?: () => void;
  // Marges sur les côtés (écran) ; false dans une barre qui a déjà les siennes
  inset?: boolean;
}

// Message temporaire, avec une action (« Annuler », « Voir »). Placé dans la mise en page, en bas de l'écran ou
// de la feuille (pas par-dessus) : il prend sa place au lieu de couvrir du contenu.
export function Toast({ message, actionLabel, onAction, inset = true }: Props) {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(actionLabel ? `${message}. ${actionLabel}` : message);
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View
      key={message}
      entering={FadeInDown.duration(motion.normal)}
      exiting={FadeOutDown.duration(motion.fast)}
      style={[styles.toast, inset && styles.inset, !(actionLabel && onAction) && styles.info]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {actionLabel && onAction ? (
        <Touchable onPress={onAction} style={styles.action} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Touchable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.button + spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.toast.background,
    ...shadows.floating,
  },
  info: {
    paddingRight: spacing.lg,
  },
  inset: {
    marginHorizontal: spacing.screen,
  },
  message: {
    ...typography.bodyMedium,
    color: colors.toast.text,
    flex: 1,
  },
  action: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionText: {
    ...typography.button,
    color: colors.toast.action,
  },
});
