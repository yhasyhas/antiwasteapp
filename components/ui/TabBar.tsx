import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Tabs } from 'expo-router';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Touchable } from './Touchable';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

// Écrans rattachés à un onglet visible : la liste de courses (onglet caché) allume « Accueil »
const PARENT_TAB: Record<string, string> = { shopping: 'index' };

// Barre d'onglets : icône et libellé, pilule vert doux derrière l'icône de l'onglet actif ; au-dessus des
// boutons de navigation d'Android (marge du système)
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const safe = useSafeSpacing();
  const activeName = state.routes[state.index]?.name;
  const highlighted = PARENT_TAB[activeName] ?? activeName;

  return (
    <View style={[styles.bar, safe.bottom(spacing.sm)]}>
      {state.routes.map((route) => {
        const { options } = descriptors[route.key];
        // Onglets cachés (href: null) : pas de bouton dans la barre
        if (route.name in PARENT_TAB) return null;
        const focused = route.name === highlighted;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!event.defaultPrevented && route.name !== activeName) navigation.navigate(route.name, route.params);
        };
        return (
          <TabItem key={route.key} focused={focused} label={label} onPress={onPress}>
            {options.tabBarIcon?.({ focused, color: focused ? colors.primary : colors.textSecondary, size: sizes.iconLarge })}
          </TabItem>
        );
      })}
    </View>
  );
}

function TabItem({ focused, label, onPress, children }: { focused: boolean; label: string; onPress: () => void; children: React.ReactNode }) {
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: motion.normal });
  }, [focused]);
  const pill = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.6 + progress.value * 0.4 }],
  }));

  return (
    <Touchable
      onPress={onPress}
      scale={false}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <View style={styles.iconArea}>
        <Animated.View style={[styles.pill, pill]} />
        <View style={styles.icon}>{children}</View>
      </View>
      <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touch,
  },
  iconArea: {
    width: sizes.tabPill.width,
    height: sizes.tabPill.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  icon: {
    zIndex: 1,
  },
  label: {
    ...typography.tab,
    fontFamily: typography.body.fontFamily,
    color: colors.textSecondary,
  },
  labelFocused: {
    color: colors.primary,
    fontFamily: typography.button.fontFamily,
  },
});
