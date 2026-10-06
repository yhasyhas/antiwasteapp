import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { IconChip } from '@/components/ui/IconChip';
import { Touchable } from '@/components/ui/Touchable';
import { CaptchaField, captchaEnabled, type CaptchaHandle } from '@/components/auth/Captcha';
import { hasPendingInvite } from '@/lib/invite';
import { authErrorMessage } from '@/lib/authErrors';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn, signInAnonymously } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Jeton anti-robot (Turnstile), à usage unique : nouvelle vérification après chaque essai
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
  const waitingForCaptcha = captchaEnabled && !captchaToken;
  // Lien d'invitation ouvert sans session : message d'accueil
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    hasPendingInvite().then(setInvited);
  }, []);

  // Jeton envoyé avec la demande, puis consommé
  const consumeToken = () => {
    const token = captchaToken ?? undefined;
    if (captchaEnabled) captcha.current?.reset();
    return token;
  };

  const tryWithoutAccount = async () => {
    setError('');
    setLoading(true);
    const { error: anonymousError } = await signInAnonymously(consumeToken());
    setLoading(false);
    if (anonymousError) {
      setError(authErrorMessage(t, anonymousError));
      return;
    }
    router.replace('/(tabs)');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    setError('');
    setLoading(true);
    const { error: signInError } = await signIn(email, password, consumeToken());
    setLoading(false);

    if (signInError) {
      // Compte créé mais lien de confirmation pas encore ouvert : message explicite plutôt que l'erreur brute
      setError(authErrorMessage(t, signInError));
      return;
    }

    // L'écran index (qui redirige selon la session) n'est plus monté ici : on navigue nous-mêmes
    router.replace('/(tabs)');
  };

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
        <Text style={styles.title}>{t('auth.headline')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        {invited && <Text style={styles.invited}>{t('auth.invitedBanner')}</Text>}

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
          <TextField
            label={t('auth.password')}
            password
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            editable={!loading}
          />
          <Touchable
            onPress={() => router.push({ pathname: '/auth/forgot', params: email.trim() ? { email: email.trim() } : {} })}
            disabled={loading}
            style={styles.forgot}
            accessibilityRole="link"
          >
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </Touchable>

          <CaptchaField ref={captcha} onToken={setCaptchaToken} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label={t('auth.signIn')} onPress={handleLogin} loading={loading} disabled={waitingForCaptcha} />

          {/* Essai sans compte : seulement avec la protection anti-robot configurée */}
          {captchaEnabled && (
            <>
              <View style={styles.or}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{t('auth.or')}</Text>
                <View style={styles.orLine} />
              </View>
              <Button label={t('auth.tryWithoutAccount')} variant="outline" onPress={tryWithoutAccount} disabled={loading || waitingForCaptcha} />
              <Text style={styles.hint}>{t('auth.tryWithoutAccountHint')}</Text>
            </>
          )}
        </View>

        <Touchable onPress={() => router.push('/auth/signup')} disabled={loading} style={styles.signup} accessibilityRole="link">
          <Text style={styles.signupText}>
            {t('auth.noAccount')}<Text style={styles.signupStrong}>{t('auth.createAccount')}</Text>
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
  invited: {
    ...typography.body,
    fontSize: typography.listTitle.fontSize,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.accentSoft,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  forgot: {
    alignSelf: 'flex-end',
    minHeight: sizes.touch,
    justifyContent: 'center',
    marginTop: -spacing.md,
  },
  forgotText: {
    ...typography.secondaryStrong,
    color: colors.primary,
  },
  error: {
    ...typography.body,
    fontSize: typography.listTitle.fontSize,
    color: colors.expired.text,
    textAlign: 'center',
  },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  orLine: {
    flex: 1,
    height: sizes.borderWidth,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.secondary,
  },
  hint: {
    ...typography.secondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  signup: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
    minHeight: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signupStrong: {
    fontFamily: typography.button.fontFamily,
    color: colors.primary,
  },
});
