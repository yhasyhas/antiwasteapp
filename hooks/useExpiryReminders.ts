import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from '@/lib/notificationsApi';
import { router } from 'expo-router';
import { notificationsSupported, rescheduleExpiryReminders, setupNotificationChannel } from '@/lib/notifications';
import { onPantryChanged } from '@/lib/pantryEvents';

// Web : pas de notifications locales
const useLastResponse = notificationsSupported ? Notifications.useLastNotificationResponse : () => undefined;

// Rappels de péremption de l'utilisateur connecté : recalculés à la connexion, au changement de langue,
// au retour dans l'app et à chaque changement du garde-manger. Toucher un rappel ouvre la génération
// avec ses aliments présélectionnés.
export function useExpiryReminders(userId: string | null, language: string) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!notificationsSupported) return;
    setupNotificationChannel();
  }, [language]);

  useEffect(() => {
    if (!notificationsSupported) return;
    rescheduleExpiryReminders(userId);
  }, [userId, language]);

  useEffect(() => {
    if (!notificationsSupported) return;
    const unsubscribe = onPantryChanged(() => rescheduleExpiryReminders(userIdRef.current));
    // Au retour dans l'app : les rappels de la veille sont passés, le garde-manger a pu changer (foyer)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleExpiryReminders(userIdRef.current);
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  const response = useLastResponse();
  useEffect(() => {
    if (!userId || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const priority = response.notification.request.content.data?.priority;
    // Traitée une seule fois, même si l'app est relancée plus tard
    Notifications.clearLastNotificationResponse();
    if (typeof priority !== 'string' || priority === '') return;
    // Au lancement depuis la notification, laisse l'écran d'accueil s'installer avant d'ouvrir la génération
    const timer = setTimeout(() => router.push({ pathname: '/recipe/generate', params: { priority } }), 400);
    return () => clearTimeout(timer);
  }, [response, userId]);
}
