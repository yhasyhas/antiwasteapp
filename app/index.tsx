import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { IconChip } from '@/components/ui/IconChip';
import { needsOnboarding } from '@/lib/onboarding';
import { colors, sizes, spacing } from '@/constants/theme';

// Démarrage (et retour après connexion, inscription ou essai sans compte) : premier lancement guidé s'il n'a jamais
// été vu, sinon les onglets ; sans session, la connexion. Logo pendant la lecture de la session.
export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    let active = true;
    needsOnboarding(user.id).then((needed) => {
      if (active) router.replace(needed ? '/onboarding' : '/(tabs)');
    });
    return () => {
      active = false;
    };
  }, [user?.id, loading]);

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
