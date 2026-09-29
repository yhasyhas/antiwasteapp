import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Leaf, Sparkles, Trash2, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchFoodFact, reportFoodFact, type FoodFactResult } from '@/lib/foodFacts';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconChip } from '@/components/ui/IconChip';
import { TextField } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Touchable } from '@/components/ui/Touchable';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

interface FactIngredient {
  id: string;
  name: string;
  food_key?: string | null;
  expires_at?: string | null;
  category?: string | null;
}

interface Props {
  ingredient: FactIngredient | null;
  onClose: () => void;
  // « Retirer du garde-manger » (suppression annulable, gérée par l'écran)
  onRemove?: () => void;
}

const CATEGORIES = ['fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other'] as const;

// Fiche d'un aliment du garde-manger : description, origine, saison, atouts nutritionnels, astuces
// anti-gaspi, « Cuisiner cet aliment ». Informations générales seulement (mention en bas), avec
// « Signaler une erreur ».
export function FoodFactSheet({ ingredient, onClose, onRemove }: Props) {
  const { t, language } = useLanguage();
  const [result, setResult] = useState<FoodFactResult | null>(null);
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Aliment gardé pendant l'animation de fermeture
  const [shown, setShown] = useState<FactIngredient | null>(null);

  useEffect(() => {
    if (!ingredient) return;
    setShown(ingredient);
    setResult(null);
    setReporting(false);
    setMessage('');
    let active = true;
    fetchFoodFact(ingredient).then((loaded) => active && setResult(loaded));
    return () => {
      active = false;
    };
  }, [ingredient?.id]);

  const lang = (['fr', 'en', 'es'].includes(language) ? language : 'fr') as 'fr' | 'en' | 'es';
  const section = result?.ok ? result.fact[lang] : null;
  const category = CATEGORIES.find((value) => value === shown?.category);

  const sendReport = async () => {
    if (!result?.ok) return;
    setSending(true);
    const sent = await reportFoodFact(result.foodKey, lang, message);
    setSending(false);
    if (!sent) return Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
    setReporting(false);
    setMessage('');
    Alert.alert(t('facts.reportedTitle'), t('facts.reportedText'));
  };

  const cook = () => {
    if (!shown) return;
    onClose();
    router.push({ pathname: '/recipe/generate', params: { priority: shown.id } });
  };

  const remove = () => {
    onClose();
    onRemove?.();
  };

  // Toujours proposé, même si la fiche ne se charge pas
  const removeButton = onRemove
    ? <Button label={t('pantry.removeFromPantry')} icon={Trash2} variant="danger" size="medium" onPress={remove} />
    : null;

  const errorText = result && !result.ok
    ? result.reason === 'not_food' ? t('facts.notFood')
      : result.reason === 'user_quota' ? t('facts.userQuota')
        : result.reason === 'provider_quota' ? t('facts.providerQuota')
          : t('facts.unavailable')
    : null;

  return (
    <BottomSheet visible={ingredient !== null} onClose={onClose} background={colors.background} keyboard>
      <View style={styles.header}>
        <IconChip icon={Leaf} tone="accent" size={sizes.iconChipLarge + spacing.sm} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{capitalize(section?.name ?? shown?.name ?? '')}</Text>
          <View style={styles.badges}>
            {category ? <Badge label={t(`category.${category}`)} tone="soft" /> : null}
            {shown?.expires_at ? <ExpiryBadge expiresAt={shown.expires_at} /> : null}
          </View>
        </View>
        <Touchable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <X size={sizes.iconLarge} color={colors.text} />
        </Touchable>
      </View>

      {!result ? (
        <View style={styles.loading}>
          <Skeleton height={typography.body.fontSize!} />
          <Skeleton width="85%" height={typography.body.fontSize!} />
          <Skeleton width="60%" height={typography.body.fontSize!} />
          <Text style={styles.loadingText}>{t('facts.loading')}</Text>
        </View>
      ) : errorText ? (
        <Text style={styles.error}>{errorText}</Text>
      ) : section ? (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <Text style={styles.description}>{section.description}</Text>

          <View style={styles.facts}>
            <Card style={styles.fact}>
              <Text style={styles.factLabel}>{t('facts.origin')}</Text>
              <Text style={styles.factValue}>{section.origin}</Text>
            </Card>
            <Card style={styles.fact}>
              <Text style={styles.factLabel}>{t('facts.season')}</Text>
              <Text style={styles.factValue}>{section.season}</Text>
            </Card>
          </View>

          {section.nutrition.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>{t('facts.highlights')}</Text>
              <View style={styles.chips}>
                {section.nutrition.map((item, index) => <Chip key={index} label={item} />)}
              </View>
            </View>
          )}

          {section.tips.length > 0 && (
            <Card style={styles.tipsCard}>
              <Text style={[styles.groupTitle, styles.tipsTitle]}>{t('facts.tips')}</Text>
              {section.tips.map((tip, index) => (
                <View key={index}>
                  <View style={cardStyles.divider} />
                  <View style={styles.tip}>
                    <IconChip icon={Leaf} tone="accent" size={sizes.iconChip - spacing.sm} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <Button label={t('facts.cook')} icon={Sparkles} onPress={cook} />
          {removeButton}

          {reporting ? (
            <View style={styles.report}>
              <TextField
                value={message}
                onChangeText={setMessage}
                placeholder={t('facts.reportPlaceholder')}
                maxLength={500}
                multiline
                style={styles.reportInput}
              />
              <View style={styles.reportActions}>
                <Button label={t('common.cancel')} variant="ghost" size="small" onPress={() => setReporting(false)} />
                <Button label={t('facts.reportSend')} size="small" onPress={sendReport} loading={sending} />
              </View>
            </View>
          ) : (
            <View style={styles.footer}>
              <Text style={styles.disclaimer}>{t('facts.disclaimer')}</Text>
              <Touchable onPress={() => setReporting(true)} style={styles.reportLink} accessibilityRole="button">
                <Text style={styles.reportLinkText}>{t('facts.report')}</Text>
              </Touchable>
            </View>
          )}
        </ScrollView>
      ) : null}
      {section ? null : removeButton}
    </BottomSheet>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    ...typography.title1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  close: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    ...typography.secondary,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  facts: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fact: {
    flex: 1,
    gap: spacing.xs,
  },
  factLabel: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  factValue: {
    ...typography.bodyStrong,
  },
  group: {
    gap: spacing.md,
  },
  groupTitle: {
    ...typography.cardTitle,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tipsCard: {
    paddingVertical: spacing.xs,
  },
  tipsTitle: {
    paddingVertical: spacing.md,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  tipText: {
    ...typography.body,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  disclaimer: {
    ...typography.secondary,
    flexShrink: 1,
  },
  reportLink: {
    minHeight: sizes.touch,
    justifyContent: 'center',
  },
  reportLinkText: {
    ...typography.secondaryStrong,
    color: colors.primary,
  },
  report: {
    gap: spacing.sm,
  },
  reportInput: {
    minHeight: sizes.thumbnail,
    textAlignVertical: 'top',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
