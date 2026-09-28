import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useLanguage } from '@/contexts/LanguageContext';
import { KeyboardAvoider } from './KeyboardAvoider';
import { Touchable } from './Touchable';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  // Fond de la feuille (surface blanche par défaut, fond de l'app pour la fiche aliment)
  background?: string;
  style?: StyleProp<ViewStyle>;
  // Hauteur maximale (part de l'écran)
  maxHeight?: `${number}%`;
  // Champ de saisie dans la feuille : elle remonte au-dessus du clavier
  keyboard?: boolean;
}

// Au-delà de ce déplacement de la poignée vers le bas, la feuille se ferme
const DISMISS_DISTANCE = 120;

// Feuille du bas : voile qui apparaît en fondu, feuille qui glisse depuis le bas (arrondi 26 en haut),
// poignée qu'on tire vers le bas pour fermer. Le contenu reste monté pendant l'animation de sortie.
export function BottomSheet({ visible, onClose, children, background = colors.surface, style, maxHeight = '92%', keyboard = false }: Props) {
  const { height } = useWindowDimensions();
  const safe = useSafeSpacing();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      progress.value = withTiming(1, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: motion.normal, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height + drag.value }],
  }));

  const pan = Gesture.Pan()
    .onChange((event) => {
      drag.value = Math.max(0, drag.value + event.changeY);
    })
    .onEnd(() => {
      if (drag.value > DISMISS_DISTANCE) runOnJS(onClose)();
      else drag.value = withTiming(0, { duration: motion.normal });
    });

  if (!mounted) return null;

  const content = (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { backgroundColor: background, maxHeight }, safe.bottom(spacing.xl), sheet, style]}>
        <GestureDetector gesture={pan}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.container}>
        {keyboard ? <KeyboardAvoider>{content}</KeyboardAvoider> : content}
      </GestureHandlerRootView>
    </Modal>
  );
}

// En-tête d'une feuille : titre (et sous-titre), bouton rond de fermeture
export function SheetHeader({ title, subtitle, onClose, leading }: { title: string; subtitle?: string; onClose?: () => void; leading?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <View style={styles.header}>
      {leading}
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onClose ? (
        <Touchable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <X size={sizes.iconLarge} color={colors.text} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title2,
  },
  subtitle: {
    ...typography.secondary,
    fontSize: typography.listTitle.fontSize,
  },
  close: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: colors.scrim,
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.screen,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: sizes.touch - spacing.sm,
  },
  handle: {
    width: sizes.sheetHandle.width,
    height: sizes.sheetHandle.height,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
});
