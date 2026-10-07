import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Sentry from '@sentry/react-native';
import { buildInfo } from './buildInfo';
import { sentryEnvironment, technicalVersion } from './buildLabel';

// Remontée des erreurs dans Sentry. Inactif tant que EXPO_PUBLIC_SENTRY_DSN n'est pas défini
// (le DSN est public : il ne permet que d'envoyer des erreurs au projet, pas de les lire).
// Dans Expo Go, seules les erreurs JavaScript remontent ; les plantages natifs demandent un build EAS.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // development (serveur de développement), preview (build de test des amis) ou production
    environment: sentryEnvironment(buildInfo, __DEV__),
    // Pas d'adresse IP ni d'e-mail : seul l'identifiant (uuid) de l'utilisateur est joint aux erreurs
    sendDefaultPii: false,
  });
  // Numéro du build de test (« 1.0, test 3 ») sur chaque erreur
  Sentry.setTag('build', technicalVersion(buildInfo));
}

export function setSentryUser(userId: string | null) {
  if (DSN) Sentry.setUser(userId ? { id: userId } : null);
}

// Erreur volontaire pour vérifier la remontée (bouton visible seulement en développement)
export function sendSentryTestError() {
  Sentry.captureException(new Error(`Test Sentry (erreur volontaire) ${new Date().toISOString()}`));
}

// Caméra du Scanner qui ne démarre pas (aperçu vide) : modèle du téléphone et version du système, pour
// repérer les appareils concernés. stage : 'restart' (relancée automatiquement) ou 'error' (message affiché).
export function reportCameraIssue(stage: 'restart' | 'error', reason: string, message?: string) {
  if (!DSN) return;
  Sentry.captureMessage(`Caméra du Scanner : ${stage === 'restart' ? 'relancée automatiquement' : 'erreur affichée'} (${reason})`, {
    level: 'warning',
    tags: {
      camera_stage: stage,
      camera_reason: reason,
      device_brand: Device.brand ?? 'inconnu',
      device_model: Device.modelName ?? 'inconnu',
      os: `${Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    },
    extra: message ? { message } : undefined,
  });
}

export { Sentry };
