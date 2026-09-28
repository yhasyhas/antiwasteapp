import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { IconChip } from '@/components/ui/IconChip';
import { colors, sizes, spacing, typography } from '@/constants/theme';

// Écran affiché tant que l'accès à la caméra n'est pas accordé
export function PermissionRequest({ onRequest, onManualAdd }: { onRequest: () => void; onManualAdd: () => void }) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <IconChip icon={Camera} size={sizes.iconChipLarge + spacing.xxl} />
      <Text style={styles.title}>{t('scan.permissionTitle')}</Text>
      <Text style={styles.text}>{t('scan.permissionText')}</Text>
      <View style={styles.actions}>
        <Button label={t('scan.grantPermission')} onPress={onRequest} />
        <Button label={t('scan.addManuallyInstead')} icon={Plus} variant="outline" onPress={onManualAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.title2,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
