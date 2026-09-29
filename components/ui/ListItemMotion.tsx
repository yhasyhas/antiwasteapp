import React from 'react';
import { Platform } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useIsFocused } from 'expo-router';
import { listMotion, motion } from '@/constants/theme';

// Réarrangement animé des éléments (suppression, changement de groupe) : pas sur Android, où il peut empiler
// les cartes quand la liste change pendant que l'écran n'est pas affiché (aliments ajoutés depuis le Scanner)
const REARRANGE = Platform.OS !== 'android';

// Élément de liste animé : apparaît en glissant légèrement vers le haut (décalé selon sa position), disparaît
// en fondu, et les autres éléments se réarrangent en douceur. Animations seulement quand l'écran est affiché :
// une liste mise à jour en arrière-plan (onglet caché) s'affiche directement à sa place.
export function ListItemMotion({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  const focused = useIsFocused();
  const delay = Math.min(index, listMotion.maxStaggered) * listMotion.stagger;
  return (
    <Animated.View
      entering={focused ? FadeInDown.duration(motion.normal).delay(delay) : undefined}
      exiting={focused ? FadeOut.duration(motion.fast) : undefined}
      layout={focused && REARRANGE ? LinearTransition.duration(motion.normal) : undefined}
    >
      {children}
    </Animated.View>
  );
}
