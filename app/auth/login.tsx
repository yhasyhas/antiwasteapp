import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Input, PasswordInput } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { CaptchaCancelled, captchaEnabled, useCaptcha } from '@/components/auth/Captcha';
import { hasPendingInvite } from '@/lib/invite';
import { authErrorMessage } from '@/lib/authErrors';
import { ChefHat } from 'lucide-react-native';

export default function LoginScreen() {
  const { signIn, signInAnonymously } = useAuth();
  const { getToken, captcha } = useCaptcha();
  // Lien d'invitation ouvert sans session : message d'accueil
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    hasPendingInvite().then(setInvited);
  }, []);

  // Jeton anti-robot (Turnstile) ; null si l'utilisateur a fermé la vérification
  const captchaToken = async (): Promise<string | undefined | null> => {
    try {
      return await getToken();
    } catch (error) {
      if (!(error instanceof CaptchaCancelled)) setError(t('auth.captchaFailed'));
      return null;
    }
  };

  const tryWithoutAccount = async () => {
    setError('');
    const token = await captchaToken();
    if (token === null) return;
    setLoading(true);
    const { error: anonymousError } = await signInAnonymously(token);
    setLoading(false);
    if (anonymousError) {
      setError(authErrorMessage(t, anonymousError));
      return;
    }
    router.replace('/(tabs)');
  };
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    setError('');
    const token = await captchaToken();
    if (token === null) return;
    setLoading(true);

    const { error: signInError } = await signIn(email, password, token);
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: safe.insets.top + 24, paddingBottom: safe.insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <ChefHat size={48} color="#10b981" strokeWidth={2} />
          </View>
          <Text style={styles.title}>FreshPlate</Text>
          <Text style={styles.subtitle}>
            {t('auth.tagline')}
          </Text>
        </View>

        {invited && <Text style={styles.invited}>{t('auth.invitedBanner')}</Text>}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <Input
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <PasswordInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/auth/signup')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              {t('auth.noAccount')}<Text style={styles.linkBold}>{t('auth.signUp')}</Text>
            </Text>
          </TouchableOpacity>

          {/* Essai sans compte : seulement avec la protection anti-robot configurée */}
          {captchaEnabled && (
            <TouchableOpacity style={styles.guestButton} onPress={tryWithoutAccount} disabled={loading}>
              <Text style={styles.guestText}>{t('auth.tryWithoutAccount')}</Text>
              <Text style={styles.guestHint}>{t('auth.tryWithoutAccountHint')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      {captcha}
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
  },
  linkBold: {
    color: '#10b981',
    fontWeight: '600',
  },
  invited: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    color: '#047857',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  guestButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  guestText: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '600',
  },
  guestHint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
});
