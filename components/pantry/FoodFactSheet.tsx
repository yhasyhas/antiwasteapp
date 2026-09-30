import React, { useEffect, useState, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Ban, Eye, Leaf, Sparkles, Trash2, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchFoodFact, reportFoodFact, type FoodFactResult } from '@/lib/foodFacts';
import { ExpiryBadge } from '@/components/expiry/ExpiryBadge';
import { FoodIcon } from './FoodIcon';
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
  kind?: string | null;
}

interface Props {
  ingredient: FactIngredient | null;
  onClose: () => void;
  // « Retirer du garde-manger » (suppression annulable, gérée par l'écran), sans section du garde-manger
  onRemove?: () => void;
  // « Dans ton garde-manger » (lots et actions), en haut de la feuille
  pantry?: React.ReactNode;
  // Fiche d'information (pas pour un reste de plat)
  withFact?: boolean;
  // Message « Annuler », en bas de la feuille
  toast?: React.ReactNode;
  // Nom affiché (celui du produit pour un code-barres) et nom générique en sous-titre
  title?: string;
  subtitle?: string | null;
  // Fiche du produit (code-barres), sous la section du garde-manger
  product?: React.ReactNode;
  // Change à chaque demande d'aller à « Est-ce encore bon ? » (lien d'une date indicative dépassée)
  stillGoodRequest?: number;
}

// Catégories de produits frais : saison affichée pour une fiche d'avant la phase 8 (sans l'indication)
const FRESH_CATEGORIES: string[] = ['fruit', 'vegetable', 'fish'];
const CATEGORIES = ['fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other'] as const;

// Feuille d'un aliment du garde-manger : en haut, « Dans ton garde-manger » (ses lots) ; en dessous, sa fiche :
// description, origine, saison, atouts nutritionnels, astuces anti-gaspi, « Cuisiner cet aliment ».
// Informations générales seulement (mention en bas), avec « Signaler une erreur ».
export function FoodFactSheet({ ingredient, onClose, onRemove, pantry, withFact = true, toast, title, subtitle, product, stillGoodRequest }: Props) {
  const { t, language } = useLanguage();
  // « Est-ce encore bon ? » : position dans la fiche, pour y aller depuis le lien d'un lot
  const scrollRef = useRef<ScrollView>(null);
  const stillGoodY = useRef<number | null>(null);
  useEffect(() => {
    if (stillGoodRequest && stillGoodY.current !== null) scrollRef.current?.scrollTo({ y: stillGoodY.current, animated: true });
  }, [stillGoodRequest]);
  const [result, setResult] = useState<FoodFactResult | null>(null);
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Aliment gardé pendant l'animation de fermeture
  const [shown, setShown] = useState<FactIngredient | null>(null);

  // Aliment affiché : suit les changements du garde-manger (lot retiré, date modifiée) pendant que la feuille
  // est ouverte ; la fiche n'est rechargée qu'en changeant d'aliment
  useEffect(() => {
    if (ingredient) setShown(ingredient);
  }, [ingredient]);

  const factKey = ingredient ? ingredient.food_key ?? ingredient.name : null;
  useEffect(() => {
    if (!ingredient || !withFact) return;
    setResult(null);
    setReporting(false);
    setMessage('');
    let active = true;
    fetchFoodFact(ingredient).then((loaded) => active && setResult(loaded));
    return () => {
      active = false;
    };
  }, [factKey, withFact]);

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

  // Toujours proposé, même si la fiche ne se charge pas (avec la section du garde-manger, il y est)
  const removeButton = onRemove && !pantry
    ? <Button label={t('pantry.removeFromPantry')} icon={Trash2} variant="danger" size="medium" onPress={remove} />
    : null;
  const cookButton = <Button label={t('facts.cook')} icon={Sparkles} onPress={cook} />;

  const errorText = result && !result.ok
    ? result.reason === 'not_food' ? t('facts.notFood')
      : result.reason === 'user_quota' ? t('facts.userQuota')
        : result.reason === 'provider_quota' ? t('facts.providerQuota')
          : t('facts.unavailable')
    : null;

  return (
    <BottomSheet visible={ingredient !== null} onClose={onClose} background={colors.background} keyboard>
      <View style={styles.header}>
        <FoodIcon category={category} kind={shown?.kind} size={sizes.iconChipLarge + spacing.sm} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title ?? capitalize((withFact ? section?.name : null) ?? shown?.name ?? '')}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.badges}>
            {category ? <Badge label={t(`category.${category}`)} tone="soft" /> : null}
            {shown?.expires_at && !pantry ? <ExpiryBadge expiresAt={shown.expires_at} /> : null}
          </View>
        </View>
        <Touchable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <X size={sizes.iconLarge} color={colors.text} />
        </Touchable>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {pantry}
        {product}
        {!withFact ? cookButton : null}
        {!withFact ? null : !result ? (
          <View style={styles.loading}>
            <Skeleton height={typography.body.fontSize!} />
            <Skeleton width="85%" height={typography.body.fontSize!} />
            <Skeleton width="60%" height={typography.body.fontSize!} />
            <Text style={styles.loadingText}>{t('facts.loading')}</Text>
          </View>
        ) : errorText ? (
          <>
            <Text style={styles.error}>{errorText}</Text>
            {/* Aliment du garde-manger : « Cuisiner cet aliment » reste possible sans sa fiche */}
            {pantry ? cookButton : null}
          </>
        ) : section ? (
          <>
            <Text style={styles.description}>{capitalize(section.description)}</Text>

            <View style={styles.facts}>
              <Card style={styles.fact}>
                <Text style={styles.factLabel}>{t('facts.origin')}</Text>
                <Text style={styles.factValue}>{capitalize(section.origin)}</Text>
              </Card>
              {/* Saison : seulement pour les produits frais (fruits, légumes, poissons, fruits de mer) */}
              {(section.seasonal ?? (category ? FRESH_CATEGORIES.includes(category) : false)) ? (
                <Card style={styles.fact}>
                  <Text style={styles.factLabel}>{t('facts.season')}</Text>
                  <Text style={styles.factValue}>{capitalize(section.season)}</Text>
                </Card>
              ) : null}
            </View>

            {section.nutrition.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>{t('facts.highlights')}</Text>
                <View style={styles.chips}>
                  {section.nutrition.map((item, index) => <Chip key={index} label={capitalize(item)} />)}
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
                      <Text style={styles.tipText}>{capitalize(tip)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {section.signs?.length || section.discard?.length ? (
              <View onLayout={(event: LayoutChangeEvent) => { stillGoodY.current = event.nativeEvent.layout.y; }}>
              <Card style={styles.tipsCard}>
                <Text style={[styles.groupTitle, styles.tipsTitle]}>{t('stillGood.title')}</Text>
                {section.signs?.length ? (
                  <View style={styles.stillGoodGroup}>
                    <Text style={styles.factLabel}>{t('stillGood.signs')}</Text>
                    {section.signs.map((sign, index) => (
                      <View key={index} style={styles.tip}>
                        <IconChip icon={Eye} tone="soft" size={sizes.iconChip - spacing.sm} />
                        <Text style={styles.tipText}>{capitalize(sign)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {section.discard?.length ? (
                  <View style={styles.stillGoodGroup}>
                    <View style={cardStyles.divider} />
                    <Text style={[styles.factLabel, styles.discardLabel]}>{t('stillGood.discard')}</Text>
                    {section.discard.map((item, index) => (
                      <View key={index} style={styles.tip}>
                        <IconChip icon={Ban} tone="danger" size={sizes.iconChip - spacing.sm} />
                        <Text style={styles.tipText}>{capitalize(item)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
              </View>
            ) : null}

            {cookButton}
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
          </>
        ) : null}
        {withFact && section ? null : removeButton}
      </ScrollView>
      {/* Message « Annuler » en bas de la feuille, sous son contenu */}
      {toast}
    </BottomSheet>
  );
}

// Majuscule au début de chaque valeur (« Toute l'année »)
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
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
  stillGoodGroup: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  discardLabel: {
    marginTop: spacing.md,
    color: colors.expired.text,
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
