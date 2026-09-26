import { Alert, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from '@/lib/notificationsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import { addDays, fromISODate, todayISO } from '@/lib/expiry';
import { notifyPantryChanged } from '@/lib/pantryEvents';

// Rappels de péremption : notifications locales (aucun serveur), une seule par jour à 9 h, qui regroupe
// les aliments qui expirent ce jour-là ou le lendemain. Aucune notification les jours où rien n'expire.
// Les rappels des 14 prochains jours sont programmés à l'avance et recalculés à chaque changement du
// garde-manger, à l'ouverture de l'app et au changement de langue.
// Expo Go : les notifications locales fonctionnent (seules les notifications distantes en sont retirées).

export const notificationsSupported = Platform.OS !== 'web';

const REMINDER_HOUR = 9;
const HORIZON_DAYS = 14;
const ID_PREFIX = 'expiry-';
const CHANNEL_ID = 'expiry';
// Au plus ce nombre de noms dans la notification, puis « et N autres »
const MAX_NAMES = 3;
// Explication déjà montrée avant la demande d'autorisation (elle ne l'est qu'une fois)
const EXPLAINED_KEY = 'notifications_permission_explained';

if (notificationsSupported) {
  // Notification affichée même si l'app est ouverte
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

interface ReminderItem {
  id: string;
  name: string;
  expires_at: string | null;
}

// Même règle que generate-recipes : 1 recette pour 1 ou 2 ingrédients, 2 jusqu'à 5, sinon 3
function recipeCount(pantrySize: number): number {
  return pantrySize <= 2 ? 1 : pantrySize <= 5 ? 2 : 3;
}

function listNames(items: ReminderItem[]): string {
  const t = i18n.t;
  const names = items.map((item) => item.name);
  if (names.length > MAX_NAMES) {
    return t('notifications.andMore', { items: names.slice(0, MAX_NAMES).join(', '), count: names.length - MAX_NAMES });
  }
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} ${t('notifications.and')} ${names[names.length - 1]}`;
}

// « Aujourd'hui : crème fraîche. Demain : tomates et reste de riz. 3 recettes t'attendent. »
export function reminderContent(today: ReminderItem[], tomorrow: ReminderItem[], pantrySize: number) {
  const t = i18n.t;
  const parts: string[] = [];
  if (today.length > 0) parts.push(t('notifications.today', { items: listNames(today) }));
  if (tomorrow.length > 0) parts.push(t('notifications.tomorrow', { items: listNames(tomorrow) }));
  parts.push(t('notifications.recipes', { count: recipeCount(pantrySize) }));
  return {
    title: t('notifications.title'),
    body: parts.join(' '),
    // Identifiants présélectionnés dans l'écran de génération quand on touche la notification
    data: { priority: [...today, ...tomorrow].map((item) => item.id).join(',') },
  };
}

// Canal Android « Aliments qui expirent », créé normalement dans le build de développement et les builds
// suivants, au démarrage : il sert aux notifications locales comme aux notifications push du serveur.
// Seule exception, Expo Go : setNotificationChannelAsync y plante (NullPointerException dans
// NotificationsChannelsProvider), on y garde le canal par défaut.
const useOwnChannel = Platform.OS === 'android' && !isRunningInExpoGo();

async function ensureChannel() {
  if (!useOwnChannel) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: i18n.t('notifications.channelName'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Au démarrage et au changement de langue (nom du canal traduit)
export function setupNotificationChannel(): void {
  ensureChannel().catch((error) => console.warn('[rappels] canal impossible à créer :', error));
}

// Canal à indiquer dans le déclencheur : aucun (canal par défaut) si le nôtre n'est pas créé
const channel = () => (useOwnChannel ? { channelId: CHANNEL_ID } : {});

async function cancelReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((request) => request.identifier.startsWith(ID_PREFIX))
    .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
}

async function loadPantry(userId: string): Promise<ReminderItem[] | null> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, expires_at')
    .eq('user_id', userId);
  if (error) {
    console.warn('[rappels] garde-manger illisible :', error.message);
    return null;
  }
  return data ?? [];
}

async function scheduleReminders(userId: string | null) {
  if (!notificationsSupported) return;
  if (!userId) {
    await cancelReminders();
    return;
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const pantry = await loadPantry(userId);
  // Hors connexion : on garde les rappels déjà programmés
  if (!pantry) return;
  await cancelReminders();
  await ensureChannel();

  const now = Date.now();
  const firstDay = todayISO();
  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const day = addDays(firstDay, offset);
    const fireAt = fromISODate(day);
    fireAt.setHours(REMINDER_HOUR, 0, 0, 0);
    if (fireAt.getTime() <= now) continue;

    const today = pantry.filter((item) => item.expires_at === day);
    const tomorrow = pantry.filter((item) => item.expires_at === addDays(day, 1));
    if (today.length === 0 && tomorrow.length === 0) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}${day}`,
      content: reminderContent(today, tomorrow, pantry.length),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, ...channel() },
    });
  }
}

// Les recalculs sont faits l'un après l'autre (deux changements rapprochés ne se mélangent pas)
let queue: Promise<void> = Promise.resolve();

export function rescheduleExpiryReminders(userId: string | null): Promise<void> {
  queue = queue
    .then(() => scheduleReminders(userId))
    .catch((error) => console.warn('[rappels] programmation impossible :', error));
  return queue;
}

// Au premier ajout d'une date : explication, puis demande d'autorisation du système. Une seule fois ;
// jamais au lancement de l'app. Se termine quand l'utilisateur a répondu.
export async function maybeAskNotificationPermission(): Promise<void> {
  if (!notificationsSupported) return;
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    // Déjà autorisé (Android 12 et avant : autorisé d'office) ou refusé : rien à demander
    if (status !== 'undetermined' || !canAskAgain) return;
    if (await AsyncStorage.getItem(EXPLAINED_KEY)) return;
    await AsyncStorage.setItem(EXPLAINED_KEY, '1');

    const t = i18n.t;
    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('notifications.permissionTitle'),
        t('notifications.permissionText'),
        [
          { text: t('notifications.permissionLater'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('notifications.permissionAccept'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!accepted) return;
    const result = await Notifications.requestPermissionsAsync();
    if (result.status === 'granted') notifyPantryChanged();
  } catch (error) {
    console.warn('[rappels] demande d\'autorisation impossible :', error);
  }
}

// Développement : la notification du jour (ou, si rien n'expire, les aliments les plus proches de leur
// date) envoyée dans 5 secondes
export async function sendTestReminder(userId: string): Promise<'sent' | 'denied'> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  await ensureChannel();

  const pantry = (await loadPantry(userId)) ?? [];
  const day = todayISO();
  let today = pantry.filter((item) => item.expires_at === day);
  let tomorrow = pantry.filter((item) => item.expires_at === addDays(day, 1));
  if (today.length === 0 && tomorrow.length === 0) {
    // Rien n'expire : les deux aliments datés les plus proches, présentés comme expirant demain
    tomorrow = pantry
      .filter((item) => item.expires_at)
      .sort((a, b) => a.expires_at!.localeCompare(b.expires_at!))
      .slice(0, 2);
    if (tomorrow.length === 0) tomorrow = pantry.slice(0, 2);
    today = [];
  }
  await Notifications.scheduleNotificationAsync({
    identifier: 'test-reminder',
    content: reminderContent(today, tomorrow, pantry.length),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, ...channel() },
  });
  return 'sent';
}
