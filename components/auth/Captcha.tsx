import React, { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLanguage } from '@/contexts/LanguageContext';
import { INVITE_URL } from '@/lib/invite';

// Cloudflare Turnstile (protection anti-robot des connexions, exigée par Supabase quand la protection
// captcha est activée) : la page captcha (captcha.html), hébergée avec la page d'invitation, s'affiche dans une
// fenêtre et renvoie un jeton à usage unique. Sans clé de site configurée, aucune vérification.
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const CAPTCHA_URL = process.env.EXPO_PUBLIC_CAPTCHA_URL || (INVITE_URL ? `${INVITE_URL.replace(/\/+$/, '')}/captcha` : '');

export const captchaEnabled = SITE_KEY !== '' && CAPTCHA_URL !== '';

// Délais : page qui n'affiche pas la vérification, puis vérification qui ne renvoie pas de jeton
// (sinon erreur avec « Réessayer »)
const READY_TIMEOUT_MS = 20_000;
const TOKEN_TIMEOUT_MS = 90_000;

// Widget Turnstile : 300 × 65 (normal), 150 × 140 (compact, écrans étroits)
const OVERLAY_PADDING = 16;
const BOX_PADDING = 12;
const NORMAL_WIDGET_WIDTH = 300;

export class CaptchaCancelled extends Error {}

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; code: string };

// Renvoie getToken() (jeton, ou undefined sans captcha) et la fenêtre à placer dans l'écran
export function useCaptcha() {
  const { t, language } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const frameWidth = screenWidth - 2 * OVERLAY_PADDING - 2 * BOX_PADDING - 2;
  const widgetSize = frameWidth >= NORMAL_WIDGET_WIDTH ? 'normal' : 'compact';
  // Hauteur du cadre posée sur le conteneur de la WebView (sinon il s'écrase à quelques pixels)
  const frameHeight = widgetSize === 'normal' ? 80 : 150;
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  // Change à chaque essai : recharge la page
  const [attempt, setAttempt] = useState(0);
  // Dernier état signalé par la page (affiché en développement, joint aux erreurs)
  const [pageState, setPageState] = useState('');
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  const getToken = useCallback((): Promise<string | undefined> => {
    if (!captchaEnabled) return Promise.resolve(undefined);
    return new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
      setStatus({ kind: 'loading' });
      setPageState('');
      setAttempt((n) => n + 1);
      setVisible(true);
    });
  }, []);

  const finish = (token?: string) => {
    setVisible(false);
    const current = pending.current;
    pending.current = null;
    if (token) current?.resolve(token);
    else current?.reject(new CaptchaCancelled());
  };

  // Erreur affichée dans la fenêtre (avec son code) plutôt qu'une fermeture silencieuse
  const fail = (code: string) => {
    console.warn(`[captcha] ${code}`);
    setStatus({ kind: 'error', code });
  };

  const retry = () => {
    setStatus({ kind: 'loading' });
    setPageState('');
    setAttempt((n) => n + 1);
  };

  const onMessage = (data: string) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'token' && typeof message.token === 'string') finish(message.token);
      else if (message.type === 'ready') setStatus((s) => (s.kind === 'loading' ? { kind: 'ready' } : s));
      else if (message.type === 'error') fail(String(message.code));
      else if (message.type === 'state') setPageState(String(message.code));
    } catch {
      // message inattendu : ignoré
    }
  };

  // Page qui ne répond pas, ou vérification sans jeton
  useEffect(() => {
    if (!visible || status.kind === 'error') return;
    const loading = status.kind === 'loading';
    const timer = setTimeout(
      () => fail(loading ? 'timeout' : `no-token${pageState ? ` (${pageState})` : ''}`),
      loading ? READY_TIMEOUT_MS : TOKEN_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [visible, status.kind, attempt, pageState]);

  const captchaSource = `${CAPTCHA_URL}?sitekey=${encodeURIComponent(SITE_KEY)}&lang=${language}&size=${widgetSize}&attempt=${attempt}`;

  // Web (Expo web) : la page est dans un cadre et envoie le jeton par postMessage
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const listener = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') onMessage(JSON.stringify(event.data));
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [visible]);

  const showPage = visible && status.kind !== 'error';

  const captcha = (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => finish()}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{t('auth.captchaTitle')}</Text>
          {status.kind === 'loading' && <ActivityIndicator color="#10b981" />}
          {status.kind === 'error' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{t('auth.captchaFailed')}</Text>
              <Text style={styles.errorCode}>{status.code}</Text>
              <TouchableOpacity onPress={retry} style={styles.retry}>
                <Text style={styles.retryText}>{t('auth.captchaRetry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {showPage && Platform.OS === 'web' && createElement('iframe', { key: attempt, src: captchaSource, style: { border: 0, width: '100%', height: frameHeight }, title: 'captcha' })}
          {showPage && Platform.OS !== 'web' && (
            <WebView
              key={attempt}
              containerStyle={[styles.webviewFrame, { height: frameHeight }]}
              style={styles.webview}
              source={{ uri: captchaSource }}
              onMessage={(event) => onMessage(event.nativeEvent.data)}
              onError={(event) => fail(`network: ${event.nativeEvent.description}`)}
              onHttpError={(event) => fail(`http ${event.nativeEvent.statusCode}`)}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              originWhitelist={['https://*']}
            />
          )}
          {__DEV__ && showPage && pageState !== '' && <Text style={styles.errorCode}>{pageState}</Text>}
          <TouchableOpacity onPress={() => finish()} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return { getToken, captcha };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: OVERLAY_PADDING },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: BOX_PADDING, gap: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' },
  // Fond opaque et fenêtre sans animation : une WebView transparente ou animée dans une fenêtre
  // superposée peut rester vide sur Android
  webviewFrame: { flex: 0, width: '100%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#fff' },
  errorBox: { alignItems: 'center', gap: 6 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
  errorCode: { color: '#6b7280', fontSize: 12, textAlign: 'center' },
  retry: { backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
});
