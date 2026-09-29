import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { IconChip } from '@/components/ui/IconChip';
import { colors, sizes, spacing } from '@/constants/theme';

// Démarrage : vers les onglets ou la connexion selon la session (logo pendant la lecture de la session)
export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <IconChip icon={Leaf} tone="primary" size={sizes.iconChipLarge + spacing.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
