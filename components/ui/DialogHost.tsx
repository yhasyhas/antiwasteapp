import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { closeDialog, currentDialog, subscribeDialogs, type Dialog, type DialogButton } from '@/lib/dialog';
import { motion, spacing, typography } from '@/constants/theme';
import { BottomSheet, SheetHeader } from './BottomSheet';
import { Button, type ButtonVariant } from './Button';

// Feuille des messages de l'app (lib/dialog.ts), montée une fois à la racine. Boutons empilés : action
// principale en plein, plusieurs actions (menu) en doux, action destructrice en rouge, « Annuler » en dernier.
export function DialogHost() {
  const { t } = useLanguage();
  const current = useSyncExternalStore(subscribeDialogs, currentDialog);
  // Feuille gardée pendant l'animation de sortie
  const [shown, setShown] = useState<Dialog | null>(current);
  const [visible, setVisible] = useState(!!current);
  // Bouton touché : son action passe après la fermeture (une autre feuille peut s'ouvrir ensuite)
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (current && current.id !== shown?.id) {
      setShown(current);
      setVisible(true);
    }
  }, [current?.id]);

  const finish = (action?: () => void) => {
    if (!shown) return;
    const dialog = shown;
    setVisible(false);
    pending.current = action ?? null;
    // Après l'animation de sortie : action, puis feuille suivante
    setTimeout(() => {
      closeDialog(dialog.id);
      const run = pending.current;
      pending.current = null;
      run?.();
    }, motion.normal);
  };

  if (!shown) return null;
  const { buttons, options } = shown;
  const actions = buttons.length > 0 ? buttons : [{ text: t('common.ok') } as DialogButton];
  const cancel = actions.find((button) => button.style === 'cancel');
  const others = actions.filter((button) => button.style !== 'cancel');
  const defaults = others.filter((button) => button.style !== 'destructive');
  const variantOf = (button: DialogButton): ButtonVariant => {
    if (button.style === 'destructive') return 'danger';
    return defaults.length === 1 ? 'primary' : 'soft';
  };
  const dismissable = options.cancelable !== false;
  const dismiss = () => {
    if (!dismissable) return;
    finish(options.onDismiss ?? cancel?.onPress);
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss} maxHeight="70%">
      <SheetHeader title={shown.title} onClose={dismissable ? dismiss : undefined} />
      {shown.message ? <Text style={styles.message}>{shown.message}</Text> : null}
      <View style={styles.buttons}>
        {others.map((button) => (
          <Button key={button.text} label={button.text} variant={variantOf(button)} size="medium" onPress={() => finish(button.onPress)} />
        ))}
        {cancel ? <Button label={cancel.text} variant="ghost" size="medium" onPress={() => finish(cancel.onPress)} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  buttons: {
    gap: spacing.sm,
  },
});
