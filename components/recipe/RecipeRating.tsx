import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Flag, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Input';
import { Touchable } from '@/components/ui/Touchable';
import { loadRecipeRating, saveRecipeRating, sendRecipeReport, useRecipeRating, type ReportReason, type SendResult } from '@/lib/feedback';
import { showDialog } from '@/lib/dialog';
import type { RecipeRatingValue } from './types';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

interface Props {
  recipeId: string;
  // Note lue en base ; absente (fin du mode cuisine) : lue à l'affichage
  initial?: RecipeRatingValue | null;
  style?: StyleProp<ViewStyle>;
}

const REASONS: ReportReason[] = ['dangerous', 'incorrect', 'bad', 'translation'];

// « Ton avis » : « On a aimé » / « Pas pour nous » (les plats refusés ne sont plus proposés), et « Signaler un
// problème » avec une raison (dangereux, incorrect, pas bon, traduction) et un commentaire facultatif.
export function RecipeRating({ recipeId, initial, style }: Props) {
  const { t, language } = useLanguage();
  const rating = useRecipeRating(recipeId, initial);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ReportReason | null>(null);

  useEffect(() => {
    if (initial === undefined) loadRecipeRating(recipeId);
  }, [recipeId, initial]);

  const rate = async (value: RecipeRatingValue) => {
    const previous = rating ?? null;
    const next = previous === value ? null : value;
    if (!(await saveRecipeRating(recipeId, next, previous))) showDialog(t('errors.writeTitle'), t('errors.writeText'));
  };

  const send = async () => {
    if (!reason) return;
    setSending(true);
    const result: SendResult = await sendRecipeReport(recipeId, reason, comment, language);
    setSending(false);
    if (result === 'sent') {
      setSent(reason);
      setReporting(false);
      setComment('');
      return;
    }
    showDialog(t('common.error'), result === 'daily_limit' ? t('rating.dailyLimit') : t('rating.sendError'));
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{t('rating.title')}</Text>
      <View style={styles.choices}>
        <Choice icon={ThumbsUp} label={t('rating.liked')} selected={rating === 'liked'} onPress={() => rate('liked')} />
        <Choice icon={ThumbsDown} label={t('rating.disliked')} selected={rating === 'disliked'} onPress={() => rate('disliked')} />
      </View>
      {rating === 'disliked' ? <Text style={styles.note}>{t('rating.dislikedNote')}</Text> : null}

      {sent ? (
        <Text style={styles.note}>{sent === 'dangerous' ? t('rating.sentDangerous') : t('rating.sentThanks')}</Text>
      ) : reporting ? (
        <View style={styles.report}>
          <Text style={styles.reportTitle}>{t('rating.reportTitle')}</Text>
          <View style={styles.reasons}>
            {REASONS.map((value) => (
              <Chip key={value} label={t(`rating.reason.${value}` as never) as string} selected={reason === value} showCheck onPress={() => setReason(value)} />
            ))}
          </View>
          <TextField value={comment} onChangeText={setComment} placeholder={t('rating.commentPlaceholder')} maxLength={500} multiline style={styles.comment} />
          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="ghost" size="small" onPress={() => setReporting(false)} />
            <Button label={t('rating.send')} size="small" onPress={send} loading={sending} disabled={!reason} />
          </View>
        </View>
      ) : (
        <Touchable onPress={() => setReporting(true)} style={styles.reportLink} accessibilityRole="button">
          <Flag size={sizes.iconSmall} color={colors.textSecondary} />
          <Text style={styles.reportLinkText}>{t('rating.report')}</Text>
        </Touchable>
      )}
    </View>
  );
}

function Choice({ icon: Icon, label, selected, onPress }: { icon: LucideIcon; label: string; selected: boolean; onPress: () => void }) {
  return (
    <Touchable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Icon size={sizes.icon} color={selected ? colors.onPrimary : colors.primary} fill={selected ? colors.onPrimary : colors.transparent} />
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]} numberOfLines={2}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    ...typography.listTitle,
    color: colors.primary,
    flexShrink: 1,
  },
  choiceTextSelected: {
    color: colors.onPrimary,
  },
  note: {
    ...typography.secondary,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    alignSelf: 'flex-start',
  },
  reportLinkText: {
    ...typography.secondaryStrong,
    color: colors.textSecondary,
  },
  report: {
    gap: spacing.md,
  },
  reportTitle: {
    ...typography.listTitle,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  comment: {
    minHeight: sizes.thumbnail,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
