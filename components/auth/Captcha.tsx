import React, { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { RefreshCw } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { INVITE_URL } from '@/lib/invite';
import { Checkbox } from '@/components/ui/Checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

// Cloudflare Turnstile (protection anti-robot des connexions, exigée par Supabase quand la protection
// captcha est activée) : la page captcha (captcha.html), hébergée avec la page d'invitation, s'affiche dans le
// formulaire et renvoie un jeton à usage unique. Sans clé de site configurée, aucune vérification.
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const CAPTCHA_URL = process.env.EXPO_PUBLIC_CAPTCHA_URL || (INVITE_URL ? `${INVITE_URL.replace(/\/+$/, '')}/captcha` : '');

export const captchaEnabled = SITE_KEY !== '' && CAPTCHA_URL !== '';

// Délai pour que la page affiche la vérification (sinon erreur avec « Réessayer »)
const READY_TIMEOUT_MS = 20_000;
// Widget Turnstile : 300 × 65 (normal), 150 × 140 (compact, écrans étroits)
const NORMAL_WIDGET_WIDTH = 300;

type Phase = { kind: 'loading' } | { kind: 'widget' } | { kind: 'done' } | { kind: 'error'; code: string };

export interface CaptchaHandle {
  // Jeton utilisé (usage unique) : nouvelle vérification pour l'essai suivant
  reset: () => void;
}

interface Props {
  // Jeton reçu (ou null : pas encore, expiré, consommé)
  onToken: (token: string | null) => void;
}

// Champ « Vérification de sécurité » du formulaire : widget Turnstile, puis « Vérification réussie »
export const CaptchaField = forwardRef<CaptchaHandle, Props>(function CaptchaField({ onToken }, ref) {
  const { t, language } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  // Change à chaque essai : recharge la page
  const [attempt, setAttempt] = useState(0);
  const [pageState, setPageState] = useState('');
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  // Largeur du cadre : écran moins les marges de l'écran de connexion
  const frameWidth = screenWidth - 2 * spacing.screen - 2 * sizes.borderWidth;
  const widgetSize = frameWidth >= NORMAL_WIDGET_WIDTH ? 'normal' : 'compact';
  // Hauteur posée sur le conteneur de la WebView (sinon il s'écrase à quelques pixels)
  const frameHeight = sizes.captchaFrame[widgetSize];

  const restart = () => {
    onTokenRef.current(null);
    setPageState('');
    setPhase({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  useImperativeHandle(ref, () => ({ reset: restart }), []);

  const fail = (code: string) => {
    console.warn(`[captcha] ${code}`);
    onTokenRef.current(null);
    setPhase({ kind: 'error', code });
  };

  const onMessage = (data: string) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'token' && typeof message.token === 'string') {
        onTokenRef.current(message.token);
        setPhase({ kind: 'done' });
      } else if (message.type === 'ready') {
        setPhase((current) => (current.kind === 'loading' ? { kind: 'widget' } : current));
      } else if (message.type === 'expired') {
        // Jeton expiré : la page relance la vérification
        onTokenRef.current(null);
        setPhase({ kind: 'widget' });
      } else if (message.type === 'error') {
        fail(String(message.code));
      } else if (message.type === 'state') {
        setPageState(String(message.code));
      }
    } catch {
      // message inattendu : ignoré
    }
  };

  // Page qui ne répond pas
  useEffect(() => {
    if (!captchaEnabled || phase.kind !== 'loading') return;
    const timer = setTimeout(() => fail('timeout'), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase.kind, attempt]);

  // Web (Expo web) : la page est dans un cadre et envoie le jeton par postMessage
  useEffect(() => {
    if (!captchaEnabled || Platform.OS !== 'web') return;
    const listener = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') onMessage(JSON.stringify(event.data));
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  if (!captchaEnabled) return null;

  const source = `${CAPTCHA_URL}?sitekey=${encodeURIComponent(SITE_KEY)}&lang=${language}&size=${widgetSize}&attempt=${attempt}`;
  // En attente ou vérification réussie : la page reste chargée (cachée), pour signaler l'expiration du jeton
  const hidden = phase.kind === 'done' || phase.kind === 'loading';

  return (
    <View style={styles.box}>
      {phase.kind === 'done' ? (
        <View style={styles.row}>
          <Checkbox checked />
          <Text style={styles.text}>{t('auth.captchaDone')}</Text>
        </View>
      ) : phase.kind === 'error' ? (
        <View style={styles.row}>
          <View style={styles.errorText}>
            <Text style={styles.error}>{t('auth.captchaFailed')}</Text>
            <Text style={styles.code}>{phase.code}</Text>
          </View>
          <Touchable onPress={restart} style={styles.retry} accessibilityRole="button" accessibilityLabel={t('auth.captchaRetry')}>
            <RefreshCw size={sizes.icon} color={colors.primary} />
            <Text style={styles.retryText}>{t('auth.captchaRetry')}</Text>
          </Touchable>
        </View>
      ) : phase.kind === 'loading' ? (
        <View style={styles.row}>
          <Skeleton width={sizes.checkbox} height={sizes.checkbox} rounded={radius.small} />
          <Text style={styles.text}>{t('auth.captchaTitle')}</Text>
        </View>
      ) : null}

      {phase.kind !== 'error' && (
        <View style={hidden ? styles.offscreen : { height: frameHeight }}>
          {Platform.OS === 'web'
            ? createElement('iframe', { key: attempt, src: source, style: { border: 0, width: '100%', height: frameHeight }, title: 'captcha' })
            : (
              <WebView
                key={attempt}
                containerStyle={{ height: frameHeight }}
                style={styles.webview}
                source={{ uri: source }}
                onMessage={(event) => onMessage(event.nativeEvent.data)}
                onError={(event) => fail(`network: ${event.nativeEvent.description}`)}
                onHttpError={(event) => fail(`http ${event.nativeEvent.statusCode}`)}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                originWhitelist={['https://*']}
              />
            )}
        </View>
      )}
      {__DEV__ && pageState !== '' && phase.kind === 'widget' ? <Text style={styles.code}>{pageState}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  errorText: {
    flex: 1,
  },
  error: {
    ...typography.bodyMedium,
    color: colors.expired.text,
  },
  code: {
    ...typography.secondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: sizes.touch,
  },
  retryText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  // Page chargée mais cachée : le conteneur garde sa hauteur (la page doit pouvoir s'afficher), il est
  // simplement sorti de l'écran
  offscreen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -sizes.captchaFrame.compact * 2,
    height: sizes.captchaFrame.compact,
    opacity: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
