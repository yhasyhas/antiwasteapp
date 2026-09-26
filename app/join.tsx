import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
