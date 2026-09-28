import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Illustrations';
import { colors, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <EmptyState
        kind="recipes"
        title={t('notFound.title')}
        text={t('notFound.text')}
        action={<Button label={t('notFound.goHome')} onPress={() => router.replace('/')} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
    backgroundColor: colors.background,
  },
});
