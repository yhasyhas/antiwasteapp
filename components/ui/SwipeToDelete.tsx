import React, { useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { Touchable } from './Touchable';

// Ligne qu'on glisse vers la gauche pour faire apparaître « Supprimer »
export function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const { t } = useLanguage();
  const swipeable = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      overshootRight={false}
      rightThreshold={sizes.fab}
      renderRightActions={() => (
        <Touchable
          onPress={() => {
            swipeable.current?.close();
            onDelete();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Trash2 size={sizes.icon} color={colors.onPrimary} />
          <Text style={styles.text}>{t('common.delete')}</Text>
        </Touchable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: sizes.fab + spacing.xxl,
    borderRadius: radius.control,
    backgroundColor: colors.expired.text,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  text: {
    ...typography.badge,
    color: colors.onPrimary,
  },
});
