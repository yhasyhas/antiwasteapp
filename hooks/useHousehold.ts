import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { getHousehold, loadHousehold, setHouseholdUser, subscribeHousehold } from '@/lib/household';

// Foyer actif, mis à jour dès qu'il change (arrivée, départ, membres, temps réel)
export function useHousehold() {
  return useSyncExternalStore(subscribeHousehold, getHousehold);
}

// Racine de l'app : foyer de l'utilisateur connecté, rechargé au retour dans l'app (un membre a pu
// être retiré pendant que l'app était en arrière-plan : il ne reçoit plus les messages du foyer)
export function useHouseholdSession(userId: string | null) {
  useEffect(() => setHouseholdUser(userId), [userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadHousehold();
    });
    return () => subscription.remove();
  }, []);
}
