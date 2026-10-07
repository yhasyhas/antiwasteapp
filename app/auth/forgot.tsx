import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { KeyRound, Mail } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { TextField } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { IconChip } from '@/components/ui/IconChip';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { CaptchaField, captchaEnabled, type CaptchaHandle } from '@/components/auth/Captcha';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from '@/lib/authErrors';
import { INVITE_URL } from '@/lib/invite';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

// Adresse ouverte par le lien de l'e-mail : la page « Nouveau mot de passe » du site (web/invite/reset.html), qui
// ouvre l'app sur téléphone ou laisse choisir le mot de passe dans le navigateur (ordinateur, app absente). Sans
// site configuré : l'écran de l'app directement. Elle doit figurer dans les adresses de redirection autorisées de
// Supabase (Authentication → URL Configuration), sinon le lien mène à l'adresse du site par défaut.
function resetUrl(language: string): string {
  if (INVITE_URL) return `${INVITE_URL.replace(/\/+$/, '')}/reset?lang=${language}`;
  if (Platform.OS === 'web') return Linking.createURL('/auth/reset');
  const scheme = Constants.expoConfig?.scheme;
  return `${Array.isArray(scheme) ? scheme[0] : scheme || 'myapp'}://auth/reset`;
}

// « Mot de passe oublié » : e-mail de réinitialisation (vérification anti-robot comprise). Même réponse que
// l'adresse ait un compte ou non : l'écran ne révèle pas quelles adresses sont inscrites.
export default function ForgotPasswordScreen() {
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
  const waitingForCaptcha = captchaEnabled && !captchaToken;

  const send = async () => {
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    setError('');
    setLoading(true);
    const token = captchaToken ?? undefined;
    if (captchaEnabled) captcha.current?.reset();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: resetUrl(language), captchaToken: token });
    setLoading(false);
    if (resetError) {
      setError(authErrorMessage(t, resetError));
      return;
    }
    setSentTo(address);
  };

  if (sentTo) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: safe.insets.top, paddingBottom: safe.insets.bottom + spacing.xxl }]}>
        <IconChip icon={Mail} size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.checkYourEmail')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetSent', { email: sentTo })}</Text>
        <Button label={t('auth.backToLogin')} onPress={() => router.replace('/auth/login')} style={styles.button} />
      </View>
    );
  }

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader title="" back />
      <ScrollView
        ref={keyboardScroll.scrollRef}
        onScroll={keyboardScroll.onScroll}
        scrollEventThrottle={keyboardScroll.scrollEventThrottle}
        contentContainerStyle={[styles.content, { paddingBottom: safe.insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <IconChip icon={KeyRound} tone="primary" size={sizes.iconChipLarge + spacing.xxl} style={styles.logo} />
        <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.forgotSubtitle')}</Text>

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
          <CaptchaField ref={captcha} onToken={setCaptchaToken} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={t('auth.forgotSend')} onPress={send} loading={loading} disabled={waitingForCaptcha || !email.trim()} />
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
    paddingHorizontal: spacing.screen,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
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
});
