// Messages et confirmations dans le design de l'app (petite feuille du bas, DialogHost), à la place des
// alertes du système. Même usage qu'Alert.alert : titre, message, boutons (style « cancel » ou « destructive »),
// options (cancelable, onDismiss). Plusieurs demandes rapprochées s'affichent l'une après l'autre.

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  // Faux : la feuille ne se ferme que par un de ses boutons
  cancelable?: boolean;
  // Feuille fermée sans bouton (voile, poignée, croix)
  onDismiss?: () => void;
}

export interface Dialog {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  options: DialogOptions;
}

let nextId = 1;
let queue: Dialog[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function showDialog(title: string, message?: string, buttons?: DialogButton[], options: DialogOptions = {}) {
  queue = [...queue, { id: nextId++, title, message, buttons: buttons?.length ? buttons : [], options }];
  notify();
}

// Feuille affichée (la première de la file)
export const currentDialog = (): Dialog | null => queue[0] ?? null;

export function subscribeDialogs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Feuille fermée : la suivante s'affiche
export function closeDialog(id: number) {
  queue = queue.filter((dialog) => dialog.id !== id);
  notify();
}
