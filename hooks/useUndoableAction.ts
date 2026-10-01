import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { TFunction } from 'i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { motion } from '@/constants/theme';
import { showDialog } from '@/lib/dialog';

// Action annulable (suppression, « J'ai cuisiné ça ») : enregistrée tout de suite par une fonction du serveur
// qui garde l'état d'avant (rien ne se perd si l'app passe en arrière-plan, est fermée ou perd la
// connexion). L'élément disparaît pendant l'enregistrement ; en cas d'échec il revient, avec une erreur au
// lieu du message. Réussie : message « Annuler » pendant 10 secondes, affiché de nouveau si l'on revient dans
// l'app dans les 2 minutes. Ensuite, l'action reste rétablissable 24 heures depuis « Récemment retirés ».
// « Annuler » rétablit l'état d'avant en une seule opération (undo_pantry_action, tout ou rien) ; si un autre
// membre du foyer a modifié un aliment entre-temps, rien n'est rétabli et un message l'explique.

export type UndoResult = 'undone' | 'conflict' | 'already_undone' | 'expired' | 'not_found';

// Rétablit une action ; renvoie vrai si c'est fait, sinon explique pourquoi (conflit, délai dépassé, erreur)
export async function undoPantryAction(t: TFunction, actionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('undo_pantry_action', { p_action_id: actionId });
  const result = data as UndoResult | null;
  if (error) {
    console.warn('[annulation]', error.message);
    showDialog(t('undo.failedTitle'), t('undo.failedText'));
    return false;
  }
  if (result === 'conflict') showDialog(t('undo.failedTitle'), t('undo.conflictText'));
  else if (result === 'expired') showDialog(t('undo.failedTitle'), t('undo.expiredText'));
  return result === 'undone';
}

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

interface Done<T> {
  item: T;
  actionId: string;
  at: number;
}

export function useUndoableAction<T extends { id: string }>({ perform, onDone, onUndone, label }: Options<T>) {
  const { t } = useLanguage();
  // Élément dont le message « Annuler » est affiché, avec l'identifiant de l'action
  const [pending, setPending] = useState<Done<T> | null>(null);
  // Éléments cachés pendant l'enregistrement
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dernière action enregistrée, pour réafficher le message au retour dans l'app
  const last = useRef<Done<T> | null>(null);
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

  const show = useCallback((done: Done<T>) => {
    clearTimer();
    setPending(done);
    timer.current = setTimeout(() => setPending(null), motion.undoWindow);
  }, []);

  // Retour dans l'app peu après l'action (message manqué, téléphone lent) : message de nouveau affiché
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const done = last.current;
      if (state === 'active' && done && Date.now() - done.at < motion.undoRedisplay) show(done);
    });
    return () => subscription.remove();
  }, [show]);

  // Renvoie vrai si l'action est enregistrée
  const run = useCallback(async (item: T): Promise<boolean> => {
    setHidden(item.id, true);
    try {
      const actionId = await callbacks.current.perform(item);
      callbacks.current.onDone?.(item);
      last.current = { item, actionId, at: Date.now() };
      show(last.current);
      return true;
    } catch (error) {
      alertWriteError(t, label, error);
      return false;
    } finally {
      setHidden(item.id, false);
    }
  }, [t, label, show]);

  const undo = useCallback(async () => {
    const current = pending;
    clearTimer();
    setPending(null);
    last.current = null;
    if (!current) return;
    if (await undoPantryAction(t, current.actionId)) callbacks.current.onUndone?.(current.item);
  }, [pending, t]);

  return { pending: pending?.item ?? null, hiddenIds, run, undo };
}
