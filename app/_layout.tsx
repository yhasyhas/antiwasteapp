// En premier : Sentry doit être initialisé avant le reste de l'app
import { Sentry, setSentryUser } from '@/lib/sentry';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { DialogHost } from '@/components/ui/DialogHost';
import { useExpiryReminders } from '@/hooks/useExpiryReminders';
import { useHouseholdSession } from '@/hooks/useHousehold';
import { loadPreferences } from '@/lib/preferences';
import { useTimerAlerts } from '@/lib/cookingSession';
import { colors, motion } from '@/constants/theme';

// Écran de démarrage gardé jusqu'au chargement des polices (pas d'affichage avec la police du système)
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user } = useAuth();
  const { language } = useLanguage();

  // Les erreurs remontées portent l'identifiant de l'utilisateur (jamais son e-mail)
  useEffect(() => setSentryUser(user?.id ?? null), [user?.id]);
  // Foyer actif (garde-manger partagé) et ses mises à jour en temps réel
  useHouseholdSession(user?.id ?? null);
  // Rappels de péremption (notifications locales) et ouverture de la génération depuis un rappel
  useExpiryReminders(user?.id ?? null, language);
  // Minuteurs du mode cuisine : vibration et son à l'heure exacte tant que l'app est ouverte, quel que soit l'écran
  useTimerAlerts();
  // « Mes basiques » chargés dès la connexion : « Faisable maintenant » et « À acheter » en tiennent compte partout
  useEffect(() => {
    if (user?.id) loadPreferences(user.id);
  }, [user?.id]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Transitions douces : glissement depuis la droite, fond de l'app pendant l'animation
        animation: 'slide_from_right',
        animationDuration: motion.screen,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth/signup" />
      {/* Mot de passe oublié : demande de l'e-mail, puis « Nouveau mot de passe » ouvert par le lien (sans session au départ) */}
      <Stack.Screen name="auth/forgot" />
      <Stack.Screen name="auth/reset" options={{ animation: 'fade' }} />
      {/* Sans session (déconnexion, session expirée), ces écrans deviennent inaccessibles :
          expo-router renvoie vers index, qui redirige vers la connexion */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        {/* Premier lancement guidé : une seule fois par compte, sans retour en arrière */}
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="recipe/generate" />
        <Stack.Screen name="household" />
        <Stack.Screen name="preferences" />
        <Stack.Screen name="impact" />
        {/* Mode cuisine : plein écran, glissement vers le haut */}
        <Stack.Screen name="cook" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="language" />
        <Stack.Screen name="auth/upgrade" />
        {/* Développement seulement (l'écran redirige ailleurs hors développement) */}
        <Stack.Screen name="dev/status" />
      </Stack.Protected>
      {/* Lien d'invitation : accessible sans session (le code est gardé le temps de se connecter) */}
      <Stack.Screen name="join" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function RootLayout() {
  useFrameworkReady();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError) console.warn('[polices] chargement impossible :', fontError.message);
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <LanguageProvider>
          <RootNavigator />
          <DialogHost />
          <StatusBar style="dark" />
        </LanguageProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

// Sentry.wrap capte aussi les erreurs de rendu (sans effet tant que Sentry n'est pas configuré)
export default Sentry.wrap(RootLayout);
