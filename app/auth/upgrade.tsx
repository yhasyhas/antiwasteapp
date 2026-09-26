import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { authErrorMessage } from '@/lib/authErrors';
import { Input, PasswordInput } from '@/components/ui/Input';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';

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
    <>
      <Stack.Screen options={{ headerShown: true, title: t('upgrade.title') }} />
      <KeyboardAvoider style={styles.container}>
        <ScrollView
          ref={keyboardScroll.scrollRef}
          onScroll={keyboardScroll.onScroll}
          scrollEventThrottle={keyboardScroll.scrollEventThrottle}
          contentContainerStyle={[styles.content, safe.bottom(24)]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.intro}>{t('upgrade.intro')}</Text>
          <View style={styles.group}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <Input style={styles.input} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <PasswordInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" editable={!loading} />
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
            <PasswordInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" editable={!loading} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('upgrade.submit')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoider>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, gap: 16 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  group: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { color: '#ef4444', fontSize: 14 },
  button: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
