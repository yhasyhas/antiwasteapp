import * as Sentry from '@sentry/react-native';

// Remontée des erreurs dans Sentry. Inactif tant que EXPO_PUBLIC_SENTRY_DSN n'est pas défini
// (le DSN est public : il ne permet que d'envoyer des erreurs au projet, pas de les lire).
// Dans Expo Go, seules les erreurs JavaScript remontent ; les plantages natifs demandent un build EAS.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    // Pas d'adresse IP ni d'e-mail : seul l'identifiant (uuid) de l'utilisateur est joint aux erreurs
    sendDefaultPii: false,
  });
}

export function setSentryUser(userId: string | null) {
  if (DSN) Sentry.setUser(userId ? { id: userId } : null);
}

// Erreur volontaire pour vérifier la remontée (bouton visible seulement en développement)
export function sendSentryTestError() {
  Sentry.captureException(new Error(`Test Sentry (erreur volontaire) ${new Date().toISOString()}`));
}

export { Sentry };
