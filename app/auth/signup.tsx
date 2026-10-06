import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Leaf, Mail } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { IconChip } from '@/components/ui/IconChip';
import { Touchable } from '@/components/ui/Touchable';
import { CaptchaField, captchaEnabled, type CaptchaHandle } from '@/components/auth/Captcha';
import { authErrorMessage } from '@/lib/authErrors';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // Jeton anti-robot (Turnstile), à usage unique : nouvelle vérification après chaque essai
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError(t('auth.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setError('');
    const token = captchaToken ?? undefined;
    if (captchaEnabled) captcha.current?.reset();
    setLoading(true);

    const { error: signUpError, needsEmailConfirmation } = await signUp(email, password, token);
    setLoading(false);

    if (signUpError) {
      setError(authErrorMessage(t, signUpError));
      return;
    }

    if (needsEmailConfirmation) {
      // Pas de session tant que l'email n'est pas confirmé : les onglets seraient inutilisables
      setAwaitingConfirmation(true);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.replace('/');
    }, 1000);
  };

  if (awaitingConfirmation) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: safe.insets.top, paddingBottom: safe.insets.bottom + spacing.xxl }]}>
        <IconChip icon={Mail} size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.checkYourEmail')}</Text>
        <Text style={styles.subtitle}>{t('auth.checkYourEmailText', { email })}</Text>
        <Button label={t('auth.backToLogin')} onPress={() => router.replace('/auth/login')} style={styles.confirmationButton} />
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
        <IconChip icon={Leaf} tone="primary" size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.createAccount')}</Text>
        <Text style={styles.subtitle}>{t('auth.signUpSubtitle')}</Text>

        <View style={styles.form}>
          <TextField
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />
          <TextField label={t('auth.password')} password placeholder="••••••••" value={password} onChangeText={setPassword} editable={!loading} />
          <TextField label={t('auth.confirmPassword')} password placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} editable={!loading} />

          <CaptchaField ref={captcha} onToken={setCaptchaToken} />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{t('auth.accountCreated')}</Text> : null}

          <Button label={t('auth.createAccount')} onPress={handleSignUp} loading={loading} disabled={captchaEnabled && !captchaToken} />
        </View>

        <Touchable onPress={() => router.push('/auth/login')} disabled={loading} style={styles.switch} accessibilityRole="link">
          <Text style={styles.switchText}>
            {t('auth.haveAccount')}<Text style={styles.switchStrong}>{t('auth.signIn')}</Text>
          </Text>
        </Touchable>
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
  success: {
    ...typography.bodyStrong,
    color: colors.primary,
    textAlign: 'center',
  },
  confirmationButton: {
    marginTop: spacing.xxl,
  },
  switch: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
    minHeight: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  switchStrong: {
    fontFamily: typography.button.fontFamily,
    color: colors.primary,
  },
});
