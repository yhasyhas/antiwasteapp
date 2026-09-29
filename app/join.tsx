import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Leaf } from 'lucide-react-native';
import { IconChip } from '@/components/ui/IconChip';
import { colors, sizes, spacing } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeInviteCode, setPendingInvite } from '@/lib/invite';

// Lien d'invitation (myapp://join?code=ABC234) : « Mon foyer » avec le code prérempli. Sans session, le
// code est gardé et l'écran de connexion s'ouvre (connexion, inscription ou essai sans compte) ; « Mon
// foyer » s'ouvre ensuite (hooks/useHousehold.ts, usePendingInvite).
export default function JoinScreen() {
  const { user, loading } = useAuth();
  const { code: rawCode } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (loading) return;
    const code = normalizeInviteCode(rawCode);
    if (user) {
      router.replace('/(tabs)');
      if (code) setTimeout(() => router.push({ pathname: '/household', params: { code } }), 300);
      return;
    }
    (code ? setPendingInvite(code) : Promise.resolve()).then(() => router.replace('/auth/login'));
  }, [user, loading, rawCode]);

  return (
    <View style={styles.container}>
      <IconChip icon={Leaf} tone="primary" size={sizes.iconChipLarge + spacing.xxl} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
