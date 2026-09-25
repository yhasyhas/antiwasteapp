// En premier : Sentry doit être initialisé avant le reste de l'app
import { Sentry, setSentryUser } from '@/lib/sentry';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useExpiryReminders } from '@/hooks/useExpiryReminders';

function RootNavigator() {
  const { user } = useAuth();
  const { language } = useLanguage();

  // Les erreurs remontées portent l'identifiant de l'utilisateur (jamais son e-mail)
  useEffect(() => setSentryUser(user?.id ?? null), [user?.id]);
  // Rappels de péremption (notifications locales) et ouverture de la génération depuis un rappel
  useExpiryReminders(user?.id ?? null, language);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/signup" />
      {/* Sans session (déconnexion, session expirée), ces écrans deviennent inaccessibles :
          expo-router renvoie vers index, qui redirige vers la connexion */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/generate" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <LanguageProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </LanguageProvider>
    </AuthProvider>
  );
}

// Sentry.wrap capte aussi les erreurs de rendu (sans effet tant que Sentry n'est pas configuré)
export default Sentry.wrap(RootLayout);
