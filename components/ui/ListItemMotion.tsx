import React from 'react';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { listMotion, motion } from '@/constants/theme';

// Élément de liste animé : apparaît en glissant légèrement vers le haut (décalé selon sa position), disparaît
// en fondu, et les autres éléments se réarrangent en douceur (suppression, changement de groupe)
export function ListItemMotion({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  const delay = Math.min(index, listMotion.maxStaggered) * listMotion.stagger;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.normal).delay(delay)}
      exiting={FadeOut.duration(motion.fast)}
      layout={LinearTransition.duration(motion.normal)}
    >
      {children}
    </Animated.View>
  );
}
