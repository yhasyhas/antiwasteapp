// Mode cuisine : séance en cours (une à la fois), gardée sur le téléphone pour la reprendre à la même étape,
// avec ses minuteurs, même après avoir quitté le mode cuisine ou l'app. Chaque minuteur garde son heure de fin
// et programme une notification locale (son et vibration du canal « Minuteurs »), qui sonne même téléphone
// verrouillé ou app en arrière-plan.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import i18n from '@/i18n';
import * as Notifications from '@/lib/notificationsApi';
import { notificationsSupported } from '@/lib/notifications';
import type { Recipe } from '@/components/recipe/types';

const STORAGE_KEY = 'cooking_session';
const CHANNEL_ID = 'cook-timers';
const NOTIFICATION_PREFIX = 'cook-timer-';

// image_url : photo du plat, montrée sur l'écran « C'est prêt ! »
export type CookingRecipe = Pick<Recipe, 'title' | 'ingredients_used' | 'instructions' | 'servings' | 'image_url'> & { id?: string; language?: string };

export interface CookingTimer {
  id: string;
  // Étape qui l'a lancé (0 = première étape)
  step: number;
  seconds: number;
  // Heure de fin (ms) : le temps restant se calcule toujours à partir d'elle
  endAt: number;
  // Fin déjà signalée dans l'app (vibration), pour ne pas la répéter au retour dans l'app
  alerted?: boolean;
  notificationId?: string | null;
}

export interface CookingSession {
  // Recette (copie : la séance se reprend sans la fiche ouverte)
  recipe: CookingRecipe;
  // Clé de la recette : son identifiant, sinon son titre
  key: string;
  phase: 'prep' | 'steps' | 'done';
  step: number;
  // Ingrédients sortis (mise en place), par indice dans la liste
  prepared: number[];
  timers: CookingTimer[];
  startedAt: number;
}

export const recipeKey = (recipe: { id?: string | null; title: string }) => recipe.id || `title:${recipe.title}`;

// ---------- État partagé (fiche recette, accueil, écran du mode cuisine) ----------

let session: CookingSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

async function persist() {
  try {
    if (session) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[cuisine] séance non enregistrée :', error);
  }
}

function set(next: CookingSession | null) {
  session = next;
  emit();
  persist();
}

export async function loadCookingSession(): Promise<CookingSession | null> {
  if (loaded) return session;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as CookingSession : null;
    // Séance de plus de 24 heures : oubliée
    session = parsed && Date.now() - parsed.startedAt < 24 * 3600 * 1000 ? parsed : null;
  } catch {
    session = null;
  }
  loaded = true;
  emit();
  return session;
}

export function useCookingSession(): CookingSession | null {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    loadCookingSession();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return session;
}

export const currentCookingSession = () => session;

// Nouvelle séance (remplace la précédente et ses minuteurs)
export async function startCooking(recipe: CookingRecipe): Promise<CookingSession> {
  await loadCookingSession();
  if (session) await cancelAllTimers(session);
  const next: CookingSession = {
    recipe: { id: recipe.id, title: recipe.title, ingredients_used: recipe.ingredients_used, instructions: recipe.instructions, servings: recipe.servings, language: recipe.language, image_url: recipe.image_url },
    key: recipeKey(recipe),
    phase: 'prep',
    step: 0,
    prepared: [],
    timers: [],
    startedAt: Date.now(),
  };
  set(next);
  return next;
}

export function updateCooking(changes: Partial<Pick<CookingSession, 'phase' | 'step' | 'prepared'>>) {
  if (session) set({ ...session, ...changes });
}

// Fin de la séance (« C'est prêt ! » fermé, ou abandon) : minuteurs annulés
export async function endCooking() {
  if (!session) return;
  const ending = session;
  set(null);
  await cancelAllTimers(ending);
}

// ---------- Minuteurs ----------

const useOwnChannel = Platform.OS === 'android' && !isRunningInExpoGo();

// Canal Android « Minuteurs de cuisine », distinct de celui du résumé quotidien (« Aliments qui expirent »,
// importance normale) : importance haute (son, vibration, bannière par-dessus l'écran), réglable à part par
// l'utilisateur. Android garde l'importance fixée à la création du canal.
async function ensureChannel() {
  if (!useOwnChannel) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('cook.channelName'),
    importance: Notifications.AndroidImportance.HIGH,
    // Sans « sound » : son de notification par défaut du téléphone
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    enableVibrate: true,
  });
}

// Autorisation demandée au premier minuteur (geste de l'utilisateur) ; refusée : le minuteur sonne seulement
// dans l'app
async function canNotify(): Promise<boolean> {
  if (!notificationsSupported) return false;
  try {
    let { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && canAskAgain) status = (await Notifications.requestPermissionsAsync()).status;
    return status === 'granted';
  } catch {
    return false;
  }
}

async function scheduleTimerNotification(timer: CookingTimer, recipeTitle: string): Promise<string | null> {
  if (!(await canNotify())) return null;
  try {
    await ensureChannel();
    return await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_PREFIX}${timer.id}`,
      content: {
        title: i18n.t('cook.timerDoneTitle'),
        body: i18n.t('cook.timerDoneBody', { step: timer.step + 1, title: recipeTitle }),
        sound: 'default',
        data: { cook: '1' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timer.endAt), ...(useOwnChannel && { channelId: CHANNEL_ID }) },
    });
  } catch (error) {
    console.warn('[cuisine] notification du minuteur impossible :', error);
    return null;
  }
}

async function cancelTimerNotification(timer: CookingTimer) {
  if (!notificationsSupported || !timer.notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(timer.notificationId);
  } catch {
    // Déjà affichée ou annulée
  }
}

async function cancelAllTimers(ended: CookingSession) {
  await Promise.all(ended.timers.map(cancelTimerNotification));
}

export async function startTimer(step: number, seconds: number) {
  if (!session) return;
  const timer: CookingTimer = { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, step, seconds, endAt: Date.now() + seconds * 1000 };
  set({ ...session, timers: [...session.timers, timer] });
  const notificationId = await scheduleTimerNotification(timer, session.recipe.title);
  if (session && notificationId) {
    set({ ...session, timers: session.timers.map((item) => (item.id === timer.id ? { ...item, notificationId } : item)) });
  }
}

// Minuteur arrêté ou fini et vu : retiré (sa notification aussi, s'il n'a pas encore sonné)
export async function removeTimer(id: string) {
  if (!session) return;
  const timer = session.timers.find((item) => item.id === id);
  set({ ...session, timers: session.timers.filter((item) => item.id !== id) });
  if (timer && timer.endAt > Date.now()) await cancelTimerNotification(timer);
}

export function markTimersAlerted(ids: string[]) {
  if (!session || ids.length === 0) return;
  set({ ...session, timers: session.timers.map((item) => (ids.includes(item.id) ? { ...item, alerted: true } : item)) });
}

export const remainingSeconds = (timer: CookingTimer, now = Date.now()) => Math.max(0, (timer.endAt - now) / 1000);
