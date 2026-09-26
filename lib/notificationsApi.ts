// Fonctions de notifications LOCALES d'expo-notifications, importées une par une.
// Ne pas importer 'expo-notifications' directement : son point d'entrée charge l'enregistrement du jeton
// de notifications distantes (DevicePushTokenAutoRegistration.fx), qui lève une erreur au démarrage dans
// Expo Go sur Android (SDK 53 et suivants) et empêche l'app de s'ouvrir. Les notifications locales,
// elles, fonctionnent dans Expo Go. Metro choisit les variantes .android / .ios de chaque fichier.

export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export { useLastNotificationResponse } from 'expo-notifications/build/useLastNotificationResponse';
export { DEFAULT_ACTION_IDENTIFIER, clearLastNotificationResponse } from 'expo-notifications/build/NotificationsEmitter';
export { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
