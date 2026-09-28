import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { motion } from '@/constants/theme';

// Suppression qu'on peut annuler : l'élément disparaît tout de suite de l'écran, mais n'est supprimé pour
// de bon qu'après le délai du message « Annuler » (ou plus tôt : autre suppression, écran quitté, app mise
// en arrière-plan). Une suppression annulée ne touche donc jamais la base (ni le compteur anti-gaspi,
// alimenté à la suppression d'un aliment).
export function useUndoableDelete<T extends { id: string }>(commit: (item: T) => Promise<void>) {
  // Élément dont le message « Annuler » est affiché
  const [pending, setPending] = useState<T | null>(null);
  // Éléments cachés : en attente, ou en cours de suppression (réaffichés si elle échoue)
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const setHidden = (id: string, hidden: boolean) =>
    setHiddenIds((current) => {
      const next = new Set(current);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Supprime maintenant l'élément en attente
  const flush = useCallback(() => {
    clearTimer();
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (!item) return;
    commitRef.current(item)
      .catch(() => {})
      .finally(() => setHidden(item.id, false));
  }, []);

  const remove = useCallback((item: T) => {
    flush();
    pendingRef.current = item;
    setPending(item);
    setHidden(item.id, true);
    timer.current = setTimeout(flush, motion.undoWindow);
  }, [flush]);

  const undo = useCallback(() => {
    clearTimer();
    const item = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (item) setHidden(item.id, false);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [flush]);

  return { pending, hiddenIds, remove, undo };
}
