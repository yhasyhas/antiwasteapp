import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { KeyboardAvoider, useKeyboardScroll } from '@/components/ui/KeyboardAvoider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import { CookTimeChoice, ExcludedEditor, ServingsStepper } from '@/components/recipe/PreferenceControls';
import { dietaryOptions } from '@/components/recipe/options';
import { CuisinePicker } from '@/components/recipe/CuisinePicker';
import { BasicsEditor } from '@/components/recipe/BasicsEditor';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from '@/lib/preferences';
import { showDialog } from '@/lib/dialog';

// Préférences de génération : régimes, aliments exclus (allergies, goûts), « Mes basiques », temps maximum, cuisine
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
      showDialog(t('errors.writeTitle'), t('errors.writeText'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoider style={styles.container}>
      <ScreenHeader title={t('preferences.title')} back />
      {!preferences ? (
        <View style={styles.content}>
          {[0, 1, 2].map((row) => <SkeletonRow key={row} />)}
        </View>
      ) : (
        <>
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
                {dietaryOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={t(option.labelKey)}
                    showCheck
                    selected={preferences.dietary.includes(option.value)}
                    onPress={() => update({ dietary: preferences.dietary.includes(option.value) ? preferences.dietary.filter((d) => d !== option.value) : [...preferences.dietary, option.value] })}
                  />
                ))}
              </View>
            </Section>

            <Section title={t('preferences.excluded')} hint={t('preferences.excludedHint')}>
              <ExcludedEditor value={preferences.excluded} onChange={(excluded) => update({ excluded })} />
            </Section>

            <Section title={t('preferences.basics')} hint={t('preferences.basicsHint')}>
              <BasicsEditor value={preferences.basics} onChange={(basics) => update({ basics })} />
            </Section>

            <Section title={t('preferences.maxTime')}>
              <CookTimeChoice value={preferences.maxCookTime} onChange={(maxCookTime) => update({ maxCookTime })} />
            </Section>

            <Section title={t('preferences.cuisine')}>
              <CuisinePicker value={preferences.cuisine} other={preferences.cuisineOther} onChange={(cuisine, cuisineOther) => update({ cuisine, cuisineOther })} />
            </Section>

            <Section title={t('preferences.servings')}>
              <ServingsStepper value={preferences.servings} onChange={(servings) => update({ servings })} />
            </Section>
          </ScrollView>
          <View style={[styles.footer, safe.bottom(spacing.lg)]}>
            <Button label={t('preferences.save')} onPress={save} loading={saving} />
          </View>
        </>
      )}
    </KeyboardAvoider>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  intro: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.cardTitle,
  },
  hint: {
    ...typography.secondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
});
