import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { getCalendars } from 'expo-localization';
import * as Notifications from '@/lib/notificationsApi';
import { supabase } from '@/lib/supabase';

// Notifications push : le résumé de 9 h est calculé et envoyé par le serveur (Edge Function daily-digest,
// Expo Push). L'appareil enregistre son jeton, son fuseau horaire et la langue de l'app. Sans jeton
// (Expo Go, web, émulateur, projet EAS ou Firebase pas encore configuré, autorisation refusée), l'app
// garde les rappels locaux : un appareil reçoit l'un ou l'autre, jamais les deux.

let registered: { userId: string; language: string; token: string } | null = null;

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function timeZone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

// Vrai si le serveur enverra le résumé à cet appareil (jeton enregistré pour cet utilisateur)
export async function ensurePushRegistration(userId: string, language: string): Promise<boolean> {
  if (Platform.OS === 'web' || isRunningInExpoGo() || !Device.isDevice) return false;
  const id = projectId();
  if (!id) return false;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return false;
  if (registered?.userId === userId && registered.language === language) return true;

  try {
    // Chargé ici seulement : ce module enregistre le jeton au chargement, ce qui plante Expo Go
    // (voir lib/notificationsApi.ts)
    const { getExpoPushTokenAsync } = require('expo-notifications/build/getExpoPushTokenAsync') as typeof import('expo-notifications/build/getExpoPushTokenAsync');
    const { data: token } = await getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
      p_timezone: timeZone(),
      p_language: language,
    });
    if (error) throw new Error(error.message);
    registered = { userId, language, token };
    return true;
  } catch (error) {
    // Hors connexion, Firebase absent… : rappels locaux, nouvel essai au prochain recalcul
    console.warn('[push] jeton non enregistré, rappels locaux :', error);
    return false;
  }
}

// Déconnexion : l'appareil ne reçoit plus les résumés de ce compte (avant la fin de la session)
export async function unregisterPush(): Promise<void> {
  if (!registered) return;
  const { token } = registered;
  registered = null;
  const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
  if (error) console.warn('[push] désinscription impossible :', error.message);
}
