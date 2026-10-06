import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Camera, ChevronRight, Leaf, PenLine, ShieldCheck, Users, type LucideIcon } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconChip } from '@/components/ui/IconChip';
import { Touchable } from '@/components/ui/Touchable';
import { CuisinePicker } from '@/components/recipe/CuisinePicker';
import { ServingsStepper } from '@/components/recipe/PreferenceControls';
import { dietaryOptions } from '@/components/recipe/options';
import { hasPendingInvite, takePendingInvite } from '@/lib/invite';
import { markOnboarded } from '@/lib/onboarding';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import type { Cuisine } from '@/components/recipe/types';
import { colors, motion, radius, sizes, spacing, typography } from '@/constants/theme';

interface Slide {
  icon: LucideIcon;
  title: string;
  text: string;
}

type Step = { kind: 'intro'; index: number } | { kind: 'questions' } | { kind: 'action' };

interface Answers {
  dietary: string[];
  cuisine: Cuisine;
  cuisineOther: string | null;
  servings: number | null;
}

// Premier lancement guidé, une seule fois par compte : trois écrans courts qu'on peut passer (ce que fait l'app, le
// garde-manger partagé, les recettes sûres), quelques questions facultatives (régimes, cuisine préférée, nombre de
// personnes), puis une première action (scanner ou ajouter à la main). Arrivée par un lien d'invitation : un seul
// écran, les questions, puis « Mon foyer » avec le code (le garde-manger du foyer est déjà rempli).
export default function OnboardingScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  // null : pas encore su (lecture de l'invitation en attente)
  const [invited, setInvited] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'intro', index: 0 });
  const [answers, setAnswers] = useState<Answers>({ dietary: [], cuisine: 'any', cuisineOther: null, servings: null });
  const [answered, setAnswered] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hasPendingInvite().then(setInvited);
    // Noté dès l'affichage : le guide ne revient jamais, même interrompu
    if (user) markOnboarded(user.id);
  }, [user?.id]);

  const slides: Slide[] = invited
    ? [{ icon: Users, title: t('onboarding.invitedTitle'), text: t('onboarding.invitedText') }]
    : [
      { icon: Leaf, title: t('onboarding.slide1Title'), text: t('onboarding.slide1Text') },
      { icon: Users, title: t('onboarding.slide2Title'), text: t('onboarding.slide2Text') },
      { icon: ShieldCheck, title: t('onboarding.slide3Title'), text: t('onboarding.slide3Text') },
    ];

  const answer = (changes: Partial<Answers>) => {
    setAnswers((current) => ({ ...current, ...changes }));
    setAnswered(true);
  };

  // Réponses enregistrées dans les préférences (seulement si l'utilisateur a répondu)
  const saveAnswers = async () => {
    if (!user || !answered) return;
    try {
      const current = await loadPreferences(user.id);
      if (current) await savePreferences(user.id, { ...current, ...answers });
    } catch (error) {
      console.warn('[premier lancement] préférences non enregistrées :', error);
    }
  };

  // Fin du guide pour une personne invitée : « Mon foyer » avec le code de l'invitation
  const finishInvited = async () => {
    const code = await takePendingInvite();
    router.replace('/(tabs)');
    if (code) setTimeout(() => router.push({ pathname: '/household', params: { code } }), 400);
  };

  const afterQuestions = async (save: boolean) => {
    if (save) {
      setSaving(true);
      await saveAnswers();
      setSaving(false);
    }
    if (invited) finishInvited();
    else setStep({ kind: 'action' });
  };

  if (invited === null) return <View style={styles.container} />;

  // ---------- Écrans de présentation ----------
  if (step.kind === 'intro') {
    const slide = slides[step.index];
    const last = step.index === slides.length - 1;
    return (
      <View style={[styles.container, safe.top(spacing.md), safe.bottom(spacing.lg)]}>
        <View style={styles.topBar}>
          <View style={styles.dots} accessibilityLabel={t('onboarding.progress', { step: step.index + 1, total: slides.length })}>
            {slides.map((_, index) => <View key={index} style={[styles.dot, index === step.index && styles.dotActive]} />)}
          </View>
          <Touchable onPress={() => setStep({ kind: 'questions' })} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Touchable>
        </View>
        <Animated.View key={step.index} entering={FadeIn.duration(motion.normal)} style={styles.slide}>
          <IconChip icon={slide.icon} tone="primary" size={sizes.illustration} style={styles.slideIcon} />
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.text}>{slide.text}</Text>
        </Animated.View>
        <Button
          label={last ? t('onboarding.continue') : t('onboarding.next')}
          onPress={() => setStep(last ? { kind: 'questions' } : { kind: 'intro', index: step.index + 1 })}
          style={styles.footerButton}
        />
      </View>
    );
  }

  // ---------- Questions facultatives ----------
  if (step.kind === 'questions') {
    return (
      <View style={[styles.container, safe.top(spacing.md)]}>
        <View style={styles.topBar}>
          <View />
          <Touchable onPress={() => afterQuestions(false)} style={styles.skip} accessibilityRole="button">
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Touchable>
        </View>
        <ScrollView contentContainerStyle={styles.questions} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{t('onboarding.questionsTitle')}</Text>
          <Text style={styles.text}>{t('onboarding.questionsText')}</Text>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('generate.dietary')}</Text>
            <View style={styles.grid}>
              {dietaryOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={t(option.labelKey)}
                  showCheck
                  selected={answers.dietary.includes(option.value)}
                  onPress={() => answer({ dietary: answers.dietary.includes(option.value) ? answers.dietary.filter((d) => d !== option.value) : [...answers.dietary, option.value] })}
                />
              ))}
            </View>
          </Card>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('preferences.cuisine')}</Text>
            <CuisinePicker value={answers.cuisine} other={answers.cuisineOther} onChange={(cuisine, cuisineOther) => answer({ cuisine, cuisineOther })} />
          </Card>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('preferences.servings')}</Text>
            <ServingsStepper value={answers.servings} onChange={(servings) => answer({ servings })} />
          </Card>
        </ScrollView>
        <View style={[styles.footer, safe.bottom(spacing.lg)]}>
          <Button label={t('onboarding.continue')} onPress={() => afterQuestions(true)} loading={saving} />
        </View>
      </View>
    );
  }

  // ---------- Première action ----------
  return (
    <View style={[styles.container, safe.top(spacing.xxl), safe.bottom(spacing.lg)]}>
      <Animated.View entering={FadeIn.duration(motion.normal)} style={styles.action}>
        <Text style={styles.title}>{t('onboarding.actionTitle')}</Text>
        <Text style={styles.text}>{t('onboarding.actionText')}</Text>
        <ActionCard icon={Camera} title={t('onboarding.actionScan')} text={t('onboarding.actionScanText')} onPress={() => router.replace('/(tabs)/camera')} />
        <ActionCard
          icon={PenLine}
          title={t('onboarding.actionManual')}
          text={t('onboarding.actionManualText')}
          onPress={() => router.replace({ pathname: '/(tabs)/camera', params: { manual: '1', at: String(Date.now()) } })}
        />
      </Animated.View>
      <Button label={t('onboarding.later')} variant="ghost" onPress={() => router.replace('/(tabs)')} style={styles.footerButton} />
    </View>
  );
}

function ActionCard({ icon, title, text, onPress }: { icon: LucideIcon; title: string; text: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.actionCard} accessibilityLabel={title}>
      <IconChip icon={icon} tone="primary" />
      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{text}</Text>
      </View>
      <ChevronRight size={sizes.iconLarge} color={colors.primary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touch,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: spacing.xl,
    backgroundColor: colors.primary,
  },
  skip: {
    minHeight: sizes.touch,
    minWidth: sizes.touch,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  slideIcon: {
    borderRadius: radius.card * 2,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.hero,
    textAlign: 'left',
  },
  text: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  footerButton: {
    marginTop: spacing.lg,
  },
  questions: {
    gap: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.cardTitle,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footer: {
    paddingTop: spacing.md,
  },
  action: {
    flex: 1,
    gap: spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionText: {
    flex: 1,
    gap: spacing.xxs,
  },
  actionTitle: {
    ...typography.listTitle,
  },
  actionSubtitle: {
    ...typography.secondary,
  },
});
