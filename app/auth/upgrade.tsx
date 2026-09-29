import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { authErrorMessage } from '@/lib/authErrors';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';

// Essai sans compte → vrai compte : adresse et mot de passe ajoutés au compte anonyme. L'identifiant ne
// change pas : garde-manger, foyer, recettes et favoris sont conservés.
export default function UpgradeAccountScreen() {
  const { upgradeAccount } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email || !password || !confirmPassword) return setError(t('auth.fillAllFields'));
    if (password !== confirmPassword) return setError(t('auth.passwordsDontMatch'));
    if (password.length < 6) return setError(t('auth.passwordTooShort'));
    setError('');
    setLoading(true);
    const { error: upgradeError } = await upgradeAccount(email.trim(), password);
    setLoading(false);
    if (upgradeError) return setError(authErrorMessage(t, upgradeError));
    Alert.alert(t('upgrade.doneTitle'), t('upgrade.doneText'), [{ text: t('common.ok'), onPress: () => router.back() }]);
  };

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader title={t('upgrade.title')} back />
      <ScrollView
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        contentContainerStyle={[styles.content, safe.bottom(spacing.xxl)]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>{t('upgrade.intro')}</Text>
        <TextField label={t('auth.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
        <TextField label={t('auth.password')} password value={password} onChangeText={setPassword} placeholder="••••••••" editable={!loading} />
        <TextField label={t('auth.confirmPassword')} password value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" editable={!loading} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={t('upgrade.submit')} onPress={submit} loading={loading} />
      </ScrollView>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    gap: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
  },
  error: {
    ...typography.body,
    color: colors.expired.text,
  },
});
