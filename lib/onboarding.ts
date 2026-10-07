import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Premier lancement guidé : affiché une seule fois par compte (profiles.onboarded_at), quel que soit le téléphone.
// Le compte est noté dès l'affichage : même interrompu, le guide ne revient pas. Mémoire locale en plus, pour ne
// pas attendre le réseau aux démarrages suivants.

const cacheKey = (userId: string) => `onboarded:${userId}`;

// Réponse gardée pour la session : l'écran de démarrage et l'invitation en attente (hooks/useHousehold.ts) voient la
// même, même après que le guide a noté le compte
const answers = new Map<string, Promise<boolean>>();

export function needsOnboarding(userId: string): Promise<boolean> {
  if (!answers.has(userId)) answers.set(userId, readOnboarding(userId));
  return answers.get(userId)!;
}

async function readOnboarding(userId: string): Promise<boolean> {
  if ((await AsyncStorage.getItem(cacheKey(userId)).catch(() => null)) === '1') return false;
  const { data, error } = await supabase.from('profiles').select('onboarded_at').eq('id', userId).maybeSingle();
  // Lecture impossible : on ne bloque jamais l'accès à l'app
  if (error) return false;
  if (data?.onboarded_at) {
    await AsyncStorage.setItem(cacheKey(userId), '1').catch(() => {});
    return false;
  }
  // Pas encore de profil (compte tout juste créé) ou guide jamais vu
  return true;
}

export async function markOnboarded(userId: string): Promise<void> {
  // Les demandes déjà faites (invitation en attente) gardent leur réponse ; les suivantes (nouvelle connexion) : non
  answers.set(userId, Promise.resolve(false));
  await AsyncStorage.setItem(cacheKey(userId), '1').catch(() => {});
  const { error } = await supabase.from('profiles').upsert({ id: userId, onboarded_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) console.warn('[premier lancement] enregistrement impossible :', error.message);
}
