import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { CookTimeChoice, ExcludedEditor, ServingsStepper } from '@/components/recipe/PreferenceControls';
import { cuisineOptions, dietaryOptions } from '@/components/recipe/options';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from '@/lib/preferences';

// Préférences de génération : régimes, aliments exclus (allergies, goûts), temps maximum, cuisine
// préférée, nombre de personnes. Appliquées par défaut à chaque génération (modifiables dans les filtres).
export default function PreferencesScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const keyboardScroll = useKeyboardScroll();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPreferences(user.id).then((loaded) => setPreferences(loaded ?? DEFAULT_PREFERENCES));
  }, [user]);

  const update = (changes: Partial<Preferences>) => setPreferences((current) => (current ? { ...current, ...changes } : current));

  const save = async () => {
    if (!user || !preferences) return;
    setSaving(true);
    try {
      await savePreferences(user.id, preferences);
      router.back();
    } catch (error) {
      console.warn('[préférences]', error);
      Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
    } finally {
      setSaving(false);
    }
  };

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      {selected && <Check size={16} color="#fff" />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('preferences.title') }} />
      {!preferences ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#10b981" /></View>
      ) : (
        <KeyboardAvoider style={styles.container}>
          <ScrollView
            ref={keyboardScroll.scrollRef}
            onScroll={keyboardScroll.onScroll}
            scrollEventThrottle={keyboardScroll.scrollEventThrottle}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.intro}>{t('preferences.intro')}</Text>

            <Section title={t('generate.dietary')}>
              <View style={styles.grid}>
                {dietaryOptions.map((option) => chip(option.value, t(option.labelKey), preferences.dietary.includes(option.value), () =>
                  update({ dietary: preferences.dietary.includes(option.value) ? preferences.dietary.filter((d) => d !== option.value) : [...preferences.dietary, option.value] })))}
              </View>
            </Section>

            <Section title={t('preferences.excluded')} hint={t('preferences.excludedHint')}>
              <ExcludedEditor value={preferences.excluded} onChange={(excluded) => update({ excluded })} />
            </Section>

            <Section title={t('preferences.maxTime')}>
              <CookTimeChoice value={preferences.maxCookTime} onChange={(maxCookTime) => update({ maxCookTime })} />
            </Section>

            <Section title={t('preferences.cuisine')}>
              <View style={styles.grid}>
                {cuisineOptions.map((option) => chip(option.value, t(option.labelKey), preferences.cuisine === option.value, () => update({ cuisine: option.value })))}
              </View>
            </Section>

            <Section title={t('preferences.servings')}>
              <ServingsStepper value={preferences.servings} onChange={(servings) => update({ servings })} />
            </Section>
          </ScrollView>
          <View style={[styles.footer, safe.bottom(16)]}>
            <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('preferences.save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoider>
      )}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, gap: 20 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  saveButton: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
