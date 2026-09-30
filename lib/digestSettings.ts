import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// Résumé quotidien : interrupteur et heure (profiles.digest_enabled, profiles.digest_hour), respectés par la
// fonction daily-digest (notifications push) et par les rappels locaux (lib/notifications.ts). Gardés aussi
// sur le téléphone : les rappels locaux se recalculent hors connexion.

export interface DigestSettings {
  enabled: boolean;
  hour: number;
}

export const DEFAULT_DIGEST: DigestSettings = { enabled: true, hour: 9 };
// Heures possibles (même plage que la base)
export const DIGEST_HOUR_MIN = 5;
export const DIGEST_HOUR_MAX = 22;
const CACHE_KEY = 'digest_settings';

async function cached(): Promise<DigestSettings> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_DIGEST, ...JSON.parse(raw) } : DEFAULT_DIGEST;
  } catch {
    return DEFAULT_DIGEST;
  }
}

async function remember(settings: DigestSettings) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(settings)).catch(() => undefined);
}

// Réglages de l'utilisateur ; hors connexion, les derniers connus
export async function loadDigestSettings(userId: string): Promise<DigestSettings> {
  const { data, error } = await supabase.from('profiles').select('digest_enabled, digest_hour').eq('id', userId).maybeSingle();
  if (error || !data) return cached();
  const settings = { enabled: data.digest_enabled !== false, hour: typeof data.digest_hour === 'number' ? data.digest_hour : DEFAULT_DIGEST.hour };
  await remember(settings);
  return settings;
}

// Renvoie l'erreur d'enregistrement, ou null
export async function saveDigestSettings(userId: string, settings: DigestSettings) {
  const { error } = await supabase.from('profiles').update({ digest_enabled: settings.enabled, digest_hour: settings.hour }).eq('id', userId);
  if (!error) await remember(settings);
  return error;
}

// « 9 h » (français), « 9:00 » (espagnol), « 9 am » (anglais)
export function formatHour(hour: number, language: string): string {
  if (language === 'en') return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'am' : 'pm'}`;
  if (language === 'es') return `${hour}:00`;
  return `${hour} h`;
}
