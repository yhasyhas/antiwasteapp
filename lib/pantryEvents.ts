// Signale un changement du garde-manger (ajout, suppression, date modifiée) : les rappels de
// péremption sont alors recalculés (hooks/useExpiryReminders.ts).

type Listener = () => void;
const listeners = new Set<Listener>();

export function onPantryChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyPantryChanged() {
  listeners.forEach((listener) => listener());
}
