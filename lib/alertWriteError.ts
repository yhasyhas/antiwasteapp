import { Alert } from 'react-native';

// Signale une écriture en base qui a échoué : trace dans la console et alerte à l'utilisateur,
// pour qu'aucun ajout, suppression ou modification ne se perde en silence.
export function alertWriteError(t: (key: string) => string, context: string, error: unknown) {
  console.error(`Error ${context}:`, error);
  Alert.alert(t('writeErrorTitle'), t('writeErrorText'));
}
