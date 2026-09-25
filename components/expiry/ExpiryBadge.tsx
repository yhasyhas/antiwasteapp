import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { EXPIRY_COLORS, expiryLabel, expiryStatus } from '@/lib/expiry';

interface Props {
  expiresAt: string | null | undefined;
  onPress?: () => void;
}

// Badge de couleur : expiré (rouge), bientôt (orange), OK (vert), sans date (gris)
export function ExpiryBadge({ expiresAt, onPress }: Props) {
  const { t, language } = useLanguage();
  const colors = EXPIRY_COLORS[expiryStatus(expiresAt)];
  const content = (
    <>
      <Clock size={12} color={colors.text} />
      <Text style={[styles.text, { color: colors.text }]}>{expiryLabel(t, expiresAt, language)}</Text>
    </>
  );

  if (!onPress) return <View style={[styles.badge, { backgroundColor: colors.background }]}>{content}</View>;
  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: colors.background }]}
      onPress={onPress}
      accessibilityLabel={t('expiry.edit')}
      hitSlop={8}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
