import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Alarmes exactes d'Android (module local, android/) : null quand le module n'est pas dans le build installé
// (build de développement antérieur, Expo Go, web, iOS) ; l'app garde alors le fonctionnement sans alarme exacte.
interface ExactAlarmsModule {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): boolean;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<ExactAlarmsModule>('ExactAlarms') : null;

// true : permises ; false : à demander ; null : inconnu (module absent), aucune demande
export function canScheduleExactAlarms(): boolean | null {
  if (!native) return null;
  try {
    return native.canScheduleExactAlarms();
  } catch {
    return null;
  }
}

export function openExactAlarmSettings(): boolean {
  if (!native) return false;
  try {
    return native.openExactAlarmSettings();
  } catch {
    return false;
  }
}
