import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { motion } from '@/constants/theme';

// Action annulable (suppression, « J'ai cuisiné ça ») : enregistrée tout de suite par une fonction du serveur
// qui garde l'état d'avant (rien ne se perd si l'app passe en arrière-plan, est fermée ou perd la
// connexion). L'élément disparaît pendant l'enregistrement ; en cas d'échec il revient, avec une erreur au
// lieu du message. Réussie : message « Annuler » pendant 5 secondes. « Annuler » rétablit l'état d'avant en une
// seule opération (undo_pantry_action, tout ou rien) ; si un autre membre du foyer a modifié un aliment
// entre-temps, rien n'est rétabli et un message l'explique.

type UndoResult = 'undone' | 'conflict' | 'already_undone' | 'expired' | 'not_found';

interface Options<T> {
  // Enregistre l'action et renvoie son identifiant (lève une erreur en cas d'échec)
  perform: (item: T) => Promise<string>;
  // Action enregistrée : mise à jour de l'écran
  onDone?: (item: T) => void;
  // Action annulée : rechargement de l'écran
  onUndone?: (item: T) => void;
  // Contexte de l'erreur dans la console
  label: string;
}

export function useUndoableAction<T extends { id: string }>({ perform, onDone, onUndone, label }: Options<T>) {
  const { t } = useLanguage();
  // Élément dont le message « Annuler » est affiché, avec l'identifiant de l'action
  const [pending, setPending] = useState<{ item: T; actionId: string } | null>(null);
  // Éléments cachés pendant l'enregistrement
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ perform, onDone, onUndone });
  callbacks.current = { perform, onDone, onUndone };

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
  useEffect(() => clearTimer, []);

  // Renvoie vrai si l'action est enregistrée
  const run = useCallback(async (item: T): Promise<boolean> => {
    setHidden(item.id, true);
    try {
      const actionId = await callbacks.current.perform(item);
      callbacks.current.onDone?.(item);
      clearTimer();
      setPending({ item, actionId });
      timer.current = setTimeout(() => setPending(null), motion.undoWindow);
      return true;
    } catch (error) {
      alertWriteError(t, label, error);
      return false;
    } finally {
      setHidden(item.id, false);
    }
  }, [t, label]);

  const undo = useCallback(async () => {
    const current = pending;
    clearTimer();
    setPending(null);
    if (!current) return;
    const { data, error } = await supabase.rpc('undo_pantry_action', { p_action_id: current.actionId });
    const result = data as UndoResult | null;
    if (error) {
      console.warn('[annulation]', error.message);
      Alert.alert(t('undo.failedTitle'), t('undo.failedText'));
    } else if (result === 'undone') {
      callbacks.current.onUndone?.(current.item);
    } else if (result === 'conflict') {
      Alert.alert(t('undo.failedTitle'), t('undo.conflictText'));
    } else if (result === 'expired') {
      Alert.alert(t('undo.failedTitle'), t('undo.expiredText'));
    }
  }, [pending, t]);

  return { pending: pending?.item ?? null, hiddenIds, run, undo };
}
