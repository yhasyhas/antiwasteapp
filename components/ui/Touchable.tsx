import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  // Échelle au toucher (boutons, cartes) ; false : seulement l'opacité (lignes de liste)
  scale?: boolean;
};

// Zone tactile de l'app : retour visuel au toucher (légère réduction et opacité), animé
export function Touchable({ style, scale = true, disabled, onPressIn, onPressOut, children, ...props }: Props) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * (1 - motion.pressedOpacity),
    transform: scale ? [{ scale: 1 - pressed.value * (1 - motion.pressedScale) }] : [],
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled, ...props.accessibilityState }}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: motion.fast });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: motion.normal });
        onPressOut?.(event);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
