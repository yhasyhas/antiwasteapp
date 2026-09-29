import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';
import { Card } from './Card';

interface Props {
  width?: DimensionValue;
  height: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}

// Bloc de chargement qui « respire » (à la place d'un indicateur plein écran)
export function Skeleton({ width = '100%', height, rounded = radius.small, style }: Props) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: motion.slow * 3, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.5 }));
  return <Animated.View style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton }, animated, style]} />;
}

// Carte d'aliment ou de ligne en cours de chargement
export function SkeletonRow() {
  return (
    <Card style={styles.row}>
      <Skeleton width={sizes.iconChip} height={sizes.iconChip} rounded={radius.iconChip} />
      <View style={styles.lines}>
        <Skeleton width="60%" height={typography.listTitle.fontSize!} />
        <Skeleton width="40%" height={typography.badge.fontSize!} />
      </View>
      <Skeleton width={sizes.iconChipLarge} height={sizes.iconLarge} rounded={radius.pill} />
    </Card>
  );
}

// Carte de recette en cours de génération ou de chargement
export function SkeletonRecipeCard() {
  return (
    <Card style={styles.recipe}>
      <Skeleton height={sizes.recipeImage} rounded={0} />
      <View style={styles.recipeBody}>
        <Skeleton width="80%" height={typography.title3.fontSize!} />
        <Skeleton width="95%" height={typography.badge.fontSize!} />
        <Skeleton width="50%" height={typography.badge.fontSize!} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lines: {
    flex: 1,
    gap: spacing.sm,
  },
  recipe: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  recipeBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
