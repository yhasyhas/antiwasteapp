import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useAuth } from '@/contexts/AuthContext';
import { Globe, ChevronRight, User, LogOut, Users } from 'lucide-react-native';
import { sendSentryTestError, sentryEnabled } from '@/lib/sentry';
import { notificationsSupported, sendTestReminder } from '@/lib/notifications';
import { router } from 'expo-router';

const languages = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

export default function SettingsScreen() {
  const { language, setLanguage, t, loading } = useLanguage();
  const safe = useSafeSpacing();
  const { user, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const handleLanguageChange = async (newLang: 'fr' | 'en' | 'es') => {
    await setLanguage(newLang);
  };

  const testNotification = async () => {
    if (!user) return;
    const result = await sendTestReminder(user.id);
    if (result === 'denied') Alert.alert(t('notifications.deniedTitle'), t('notifications.deniedText'));
    else Alert.alert(t('notifications.testButton'), t('notifications.testSent'));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, safe.top(20)]}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Langue */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          </View>

          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageCard,
                language === lang.code && styles.languageCardActive,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <Text
                style={[
                  styles.languageLabel,
                  language === lang.code && styles.languageLabelActive,
                ]}
              >
                {lang.label}
              </Text>
              {language === lang.code && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
              <ChevronRight
                size={20}
                color={language === lang.code ? '#10b981' : '#9ca3af'}
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Section Compte */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('settings.email')}</Text>
            <Text style={styles.infoValue}>{user?.email || t('settings.notSignedIn')}</Text>
          </View>

          <TouchableOpacity style={styles.householdRow} onPress={() => router.push('/household')}>
            <Users size={20} color="#10b981" />
            <Text style={styles.householdText}>{t('household.open')}</Text>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.logoutText}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
        </View>

        {/* Développement seulement : vérifie que les erreurs remontent dans Sentry */}
        {__DEV__ && sentryEnabled && (
          <TouchableOpacity style={styles.testButton} onPress={sendSentryTestError}>
            <Text style={styles.testButtonText}>{t('settings.sentryTest')}</Text>
          </TouchableOpacity>
        )}
        {/* Développement seulement : compteurs du jour et quotas de fournisseurs épuisés */}
        {__DEV__ && user && (
          <TouchableOpacity style={styles.testButton} onPress={() => router.push('/dev/status')}>
            <Text style={styles.testButtonText}>{t('devStatus.open')}</Text>
          </TouchableOpacity>
        )}
        {/* Développement seulement : le rappel de péremption, sans attendre 9 h */}
        {__DEV__ && notificationsSupported && user && (
          <TouchableOpacity style={styles.testButton} onPress={testNotification}>
            <Text style={styles.testButtonText}>{t('notifications.testButton')}</Text>
          </TouchableOpacity>
        )}

        {/* Section Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('settings.appVersion', { version: '1.0' })}</Text>
          <Text style={styles.footerSubtext}>
            {t('settings.tagline')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  testButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  languageCardActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  languageLabelActive: {
    color: '#10b981',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 'auto',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  householdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  householdText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});