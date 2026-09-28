import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Touchable } from './Touchable';

interface Props {
  title: string;
  subtitle?: string;
  // Bouton retour (écrans ouverts par-dessus les onglets)
  back?: boolean;
  onBack?: () => void;
  // Boutons carrés à droite (foyer, courses)
  actions?: React.ReactNode;
}

// En-tête d'écran : retour (carré blanc), grand titre, sous-titre, actions ; sous la barre d'état
export function ScreenHeader({ title, subtitle, back = false, onBack, actions }: Props) {
  const safe = useSafeSpacing();
  const { t } = useLanguage();
  return (
    <View style={[styles.header, safe.top(spacing.xl)]}>
      {back ? (
        <SquareButton icon={ChevronLeft} label={t('common.back')} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')))} />
      ) : null}
      <View style={styles.titles}>
        <Text style={back ? styles.titleCompact : styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

// Bouton carré blanc bordé (retour, foyer, courses)
export function SquareButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Touchable onPress={onPress} style={styles.square} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={sizes.iconLarge} color={colors.primary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title1,
  },
  titleCompact: {
    ...typography.title2,
  },
  subtitle: {
    ...typography.secondary,
    fontSize: typography.body.fontSize,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  square: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
