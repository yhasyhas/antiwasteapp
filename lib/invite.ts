import AsyncStorage from '@react-native-async-storage/async-storage';

// Invitation par lien : https://<page d'invitation>/?code=ABC234 ouvre l'app sur myapp://join?code=ABC234
// (route app/join.tsx). Sans session, le code est gardé le temps de se connecter, de créer un compte ou
// d'essayer sans compte, puis « Mon foyer » s'ouvre avec le code prérempli.

const PENDING_KEY = 'pending_household_invite';

// Adresse de la page d'invitation (Cloudflare Pages) ; sans elle, le message de partage ne contient que le code
export const INVITE_URL = process.env.EXPO_PUBLIC_INVITE_URL || '';

// Code à 6 caractères, sans 0, O, 1, I (comme les codes créés par le serveur)
export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
}

export function inviteLink(code: string): string | null {
  if (!INVITE_URL) return null;
  return `${INVITE_URL.replace(/\/+$/, '')}/?code=${encodeURIComponent(code)}`;
}

export async function setPendingInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, code).catch(() => {});
}

export async function hasPendingInvite(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(PENDING_KEY).catch(() => null));
}

// Code en attente, retiré une fois lu
export async function takePendingInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
  if (code) await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  return normalizeInviteCode(code);
}
