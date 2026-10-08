// Mode cuisine : séance en cours (une à la fois), gardée sur le téléphone pour la reprendre à la même étape,
// avec ses minuteurs, même après avoir quitté le mode cuisine ou l'app. Chaque minuteur garde son heure de fin
// et programme une notification locale (son et vibration du canal « Minuteurs »), qui sonne même téléphone
// verrouillé ou app en arrière-plan.
// Alarmes exactes (Android 12 et plus, module local modules/exact-alarms) : expo-notifications programme une
// alarme exacte quand elle est permise ; sinon Android peut retarder la notification jusqu'à 75 % de la durée.
// Au premier minuteur sans cette permission, explication et bouton vers « Alarmes et rappels » ; rappel dans le
// mode cuisine tant qu'elle manque ; permission accordée : minuteurs en cours reprogrammés à l'heure exacte.
// App ouverte : vibration et son à l'heure exacte quoi qu'il arrive (useTimerAlerts, monté à la racine).

import { useEffect, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import i18n from '@/i18n';
import * as Notifications from '@/lib/notificationsApi';
import { notificationsSupported } from '@/lib/notifications';
import { showDialog } from '@/lib/dialog';
import { canScheduleExactAlarms, openExactAlarmSettings } from '@/modules/exact-alarms';
import type { Recipe } from '@/components/recipe/types';

const STORAGE_KEY = 'cooking_session';
const CHANNEL_ID = 'cook-timers';
const NOTIFICATION_PREFIX = 'cook-timer-';
// Explication des alarmes exactes déjà montrée (une seule fois, au premier minuteur sans la permission)
const EXACT_EXPLAINED_KEY = 'exact_alarms_explained';
const VIBRATION = [0, 600, 300, 600, 300, 600];
// Fin de minuteur constatée dans l'app moins de 10 s après l'heure : alerte (sinon elle a déjà été donnée)
const FRESH_ALERT_MS = 10_000;

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
    vibrationPattern: VIBRATION,
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

const timerContent = (timer: CookingTimer, recipeTitle: string) => ({
  title: i18n.t('cook.timerDoneTitle'),
  body: i18n.t('cook.timerDoneBody', { step: timer.step + 1, title: recipeTitle }),
  sound: 'default',
  data: { cook: '1' },
});

async function scheduleTimerNotification(timer: CookingTimer, recipeTitle: string): Promise<string | null> {
  if (!(await canNotify())) return null;
  try {
    await ensureChannel();
    return await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_PREFIX}${timer.id}`,
      content: timerContent(timer, recipeTitle),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(timer.endAt), ...(useOwnChannel && { channelId: CHANNEL_ID }) },
    });
  } catch (error) {
    console.warn('[cuisine] notification du minuteur impossible :', error);
    return null;
  }
}

// ---------- Alarmes exactes ----------

// Premier minuteur sans alarmes exactes : explication et bouton vers le réglage d'Android (une seule fois ; le
// rappel du mode cuisine prend le relais)
async function explainExactAlarms() {
  if (canScheduleExactAlarms() !== false) return;
  try {
    if (await AsyncStorage.getItem(EXACT_EXPLAINED_KEY)) return;
    await AsyncStorage.setItem(EXACT_EXPLAINED_KEY, '1');
  } catch {
    return;
  }
  showDialog(i18n.t('cook.exactTitle'), i18n.t('cook.exactText'), [
    { text: i18n.t('cook.exactLater'), style: 'cancel' },
    { text: i18n.t('cook.exactOpen'), onPress: () => openExactAlarmSettings() },
  ]);
}

// Permission accordée pendant la séance : minuteurs en cours reprogrammés (alarmes exactes cette fois)
async function rescheduleRunningTimers() {
  if (!session) return;
  const current = session;
  const running = current.timers.filter((timer) => timer.endAt > Date.now() + 1000);
  for (const timer of running) {
    await cancelTimerNotification(timer);
    await scheduleTimerNotification(timer, current.recipe.title);
  }
}

// État des alarmes exactes, relu au retour dans l'app (réglage d'Android ouvert entre-temps) : true permises,
// false à demander, null inconnu (module absent du build : aucune demande)
export function useExactAlarms(): boolean | null {
  const [allowed, setAllowed] = useState(canScheduleExactAlarms);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = canScheduleExactAlarms();
      setAllowed((before) => {
        if (before === false && now === true) rescheduleRunningTimers().catch(() => undefined);
        return now;
      });
    });
    return () => subscription.remove();
  }, []);
  return allowed;
}

export { openExactAlarmSettings };

// ---------- Fin d'un minuteur, app ouverte ----------

// Vibration, puis son : la notification du minuteur, présentée tout de suite si elle n'a pas encore sonné (alarme
// inexacte en retard) ; sinon seulement la vibration
async function ringNow(timer: CookingTimer, recipeTitle: string) {
  Vibration.vibrate(VIBRATION);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (!notificationsSupported) return;
  const identifier = `${NOTIFICATION_PREFIX}${timer.id}`;
  try {
    // Alarme exacte : elle sonne à la même seconde ; on lui laisse le temps de s'afficher (pas de double son)
    if (canScheduleExactAlarms() !== false) await new Promise((resolve) => setTimeout(resolve, 1500));
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (presented.some((notification) => notification.request.identifier === identifier)) return;
    if (!(await canNotify())) return;
    await cancelTimerNotification(timer);
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: timerContent(timer, recipeTitle),
      trigger: useOwnChannel ? { channelId: CHANNEL_ID } : null,
    });
  } catch (error) {
    console.warn('[cuisine] son du minuteur impossible :', error);
  }
}

// Surveillance des minuteurs tant que l'app est ouverte, quel que soit l'écran (monté à la racine)
export function useTimerAlerts() {
  const current = useCookingSession();
  const pending = (current?.timers ?? []).some((timer) => !timer.alerted);
  useEffect(() => {
    if (!pending) return;
    const tick = () => {
      if (!session) return;
      const now = Date.now();
      const done = session.timers.filter((timer) => !timer.alerted && timer.endAt <= now);
      if (done.length === 0) return;
      const fresh = done.filter((timer) => now - timer.endAt < FRESH_ALERT_MS);
      if (fresh.length > 0) ringNow(fresh[0], session.recipe.title);
      markTimersAlerted(done.map((timer) => timer.id));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [pending]);
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
  await explainExactAlarms();
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
