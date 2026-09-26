import React, { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLanguage } from '@/contexts/LanguageContext';
import { INVITE_URL } from '@/lib/invite';

// Cloudflare Turnstile (protection anti-robot des connexions, exigée par Supabase quand la protection
// captcha est activée) : la page captcha.html, hébergée avec la page d'invitation, s'affiche dans une
// fenêtre et renvoie un jeton à usage unique. Sans clé de site configurée, aucune vérification.
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const CAPTCHA_URL = process.env.EXPO_PUBLIC_CAPTCHA_URL || (INVITE_URL ? `${INVITE_URL.replace(/\/+$/, '')}/captcha.html` : '');

export const captchaEnabled = SITE_KEY !== '' && CAPTCHA_URL !== '';

export class CaptchaCancelled extends Error {}

// Renvoie getToken() (jeton, ou undefined sans captcha) et la fenêtre à placer dans l'écran
export function useCaptcha() {
  const { t, language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const pending = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

  const getToken = useCallback((): Promise<string | undefined> => {
    if (!captchaEnabled) return Promise.resolve(undefined);
    return new Promise<string>((resolve, reject) => {
      pending.current = { resolve, reject };
      setVisible(true);
    });
  }, []);

  const finish = (result: { token?: string; error?: Error }) => {
    setVisible(false);
    const current = pending.current;
    pending.current = null;
    if (result.token) current?.resolve(result.token);
    else current?.reject(result.error ?? new CaptchaCancelled());
  };

  const onMessage = (data: string) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'token' && typeof message.token === 'string') finish({ token: message.token });
      else if (message.type === 'error') finish({ error: new Error(`Turnstile : ${message.code}`) });
    } catch {
      // message inattendu : ignoré
    }
  };

  const captchaSource = `${CAPTCHA_URL}?sitekey=${encodeURIComponent(SITE_KEY)}&lang=${language}`;

  // Web (Expo web) : la page est dans un cadre et envoie le jeton par postMessage
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const listener = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') onMessage(JSON.stringify(event.data));
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [visible]);

  const captcha = (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => finish({})}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{t('auth.captchaTitle')}</Text>
          {visible && Platform.OS === 'web' && createElement('iframe', { src: captchaSource, style: { border: 0, width: '100%', height: 90 }, title: 'captcha' })}
          {visible && Platform.OS !== 'web' && (
            <WebView
              style={styles.webview}
              source={{ uri: captchaSource }}
              onMessage={(event) => onMessage(event.nativeEvent.data)}
              onError={() => finish({ error: new Error('captcha page unavailable') })}
              javaScriptEnabled
              originWhitelist={['https://*']}
            />
          )}
          <TouchableOpacity onPress={() => finish({})} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return { getToken, captcha };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', textAlign: 'center' },
  webview: { height: 90, backgroundColor: 'transparent' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
});
