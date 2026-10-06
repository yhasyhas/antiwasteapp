import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { KeyRound, TriangleAlert } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { IconChip } from '@/components/ui/IconChip';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/authErrors';
import { parseRecoveryLink } from '@/lib/recoveryLink';
import { showDialog } from '@/lib/dialog';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

type Phase = 'opening' | 'form' | 'invalid';

// « Nouveau mot de passe », ouvert par le lien de l'e-mail de réinitialisation : la session du lien est ouverte,
// puis le nouveau mot de passe enregistré. Lien expiré ou déjà utilisé : message et retour à « Mot de passe oublié ».
export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const url = Linking.useURL();
  const [phase, setPhase] = useState<Phase>('opening');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const link = parseRecoveryLink(url);
    if (link.kind === 'error') {
      setPhase('invalid');
      return;
    }
    if (link.kind !== 'session') {
      // Adresse pas encore connue (démarrage) : on attend ; ouvert sans lien : rien à réinitialiser
      if (url) setPhase('invalid');
      return;
    }
    supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken }).then(({ error: sessionError }) => {
      setPhase(sessionError ? 'invalid' : 'form');
    });
  }, [url]);

  const save = async () => {
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }
    setError('');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(authErrorMessage(t, updateError));
      return;
    }
    showDialog(t('auth.resetDoneTitle'), t('auth.resetDoneText'));
    router.replace('/');
  };

  if (phase === 'opening') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (phase === 'invalid') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: safe.insets.top, paddingBottom: safe.insets.bottom + spacing.xxl }]}>
        <IconChip icon={TriangleAlert} size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.resetInvalidTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetInvalidText')}</Text>
        <Button label={t('auth.forgotPassword')} onPress={() => router.replace('/auth/forgot')} style={styles.button} />
        <Button label={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/auth/login')} style={styles.secondButton} />
      </View>
    );
  }

  return (
    <KeyboardAvoider style={styles.container}>
      <ScrollView
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        contentContainerStyle={[styles.content, { paddingTop: safe.insets.top + spacing.xxxl * 2, paddingBottom: safe.insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <IconChip icon={KeyRound} tone="primary" size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.resetTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>
        <View style={styles.form}>
          <TextField label={t('auth.newPassword')} password placeholder="••••••••" value={password} onChangeText={setPassword} autoComplete="new-password" editable={!loading} />
          <TextField label={t('auth.confirmPassword')} password placeholder="••••••••" value={confirm} onChangeText={setConfirm} autoComplete="new-password" editable={!loading} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={t('auth.resetSave')} onPress={save} loading={loading} disabled={!password || !confirm} />
        </View>
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: spacing.screen,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
  },
  logo: {
    borderRadius: radius.card + spacing.xs,
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.hero,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  error: {
    ...typography.body,
    fontSize: typography.listTitle.fontSize,
    color: colors.expired.text,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xxl,
  },
  secondButton: {
    marginTop: spacing.sm,
  },
});
