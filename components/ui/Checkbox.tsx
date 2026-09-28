import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radius, sizes } from '@/constants/theme';

interface Props {
  checked: boolean;
  // square : case (courses, scan) ; circle : rond (ingrédients du garde-manger d'une recette) ;
  // dashed : rond en pointillés (ingrédient à acheter)
  shape?: 'square' | 'circle' | 'dashed';
}

// Case à cocher (affichage seul : la ligne entière est la zone tactile)
export function Checkbox({ checked, shape = 'square' }: Props) {
  const round = shape !== 'square';
  return (
    <View
      style={[
        styles.box,
        round && styles.round,
        shape === 'dashed' && styles.dashed,
        checked && styles.checked,
      ]}
    >
      {checked ? <Check size={sizes.iconSmall} color={colors.onPrimary} strokeWidth={3} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: sizes.checkbox,
    height: sizes.checkbox,
    borderRadius: radius.small,
    borderWidth: sizes.borderStrong,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    borderRadius: radius.pill,
  },
  dashed: {
    borderStyle: 'dashed',
    borderWidth: sizes.borderWidth,
    borderColor: colors.textSecondary,
  },
  checked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderStyle: 'solid',
  },
});
