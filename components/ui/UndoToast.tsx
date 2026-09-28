import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, motion, radius, shadows, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

interface Props {
  // Message affiché (« Aliment retiré »), ou null pour cacher
  message: string | null;
  onUndo: () => void;
  // Hauteur au-dessus du bas de l'écran (pour laisser voir un bouton flottant)
  bottom?: number;
}

// Message temporaire en bas de l'écran, avec « Annuler »
export function UndoToast({ message, onUndo, bottom = spacing.xl }: Props) {
  const { t } = useLanguage();

  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(`${message}. ${t('common.undo')}`);
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View
      key={message}
      entering={FadeInDown.duration(motion.normal)}
      exiting={FadeOutDown.duration(motion.fast)}
      style={[styles.toast, { bottom }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      <Touchable onPress={onUndo} style={styles.action} accessibilityRole="button">
        <Text style={styles.actionText}>{t('common.undo')}</Text>
      </Touchable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.button + spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.toast.background,
    ...shadows.floating,
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
