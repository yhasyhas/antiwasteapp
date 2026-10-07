import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { BottomSheet, SheetHeader } from '@/components/ui/BottomSheet';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { memberMonthStats, type HouseholdMember } from '@/lib/household';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

interface Props {
  householdId: string;
  member: HouseholdMember | null;
  // Nom affiché (« Toi », prénom, « Invité »)
  name: string;
  onClose: () => void;
}

// Fiche d'un membre du foyer (toucher un membre dans « Mon foyer ») : prénom, rôle, date d'arrivée, et ce mois-ci les
// aliments ajoutés au foyer et les aliments sauvés
export function MemberSheet({ householdId, member, name, onClose }: Props) {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<{ added: number; saved: number } | null | undefined>(undefined);

  useEffect(() => {
    if (!member) return;
    setStats(undefined);
    memberMonthStats(householdId, member.user_id).then(setStats);
  }, [householdId, member?.user_id]);

  const joined = member ? new Date(member.joined_at).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <BottomSheet visible={member !== null} onClose={onClose}>
      <SheetHeader
        title={name}
        onClose={onClose}
        leading={(
          <View style={[styles.avatar, member?.is_me && styles.avatarMe]}>
            <Text style={styles.avatarText} maxFontSizeMultiplier={1.4}>{(member?.name ?? name).charAt(0).toUpperCase()}</Text>
          </View>
        )}
      />
      <View style={styles.body}>
        <View style={styles.row}>
          <Badge label={member?.role === 'owner' ? t('household.owner') : t('household.memberRole')} tone={member?.role === 'owner' ? 'soon' : 'ok'} />
          <Text style={styles.joined}>{t('household.memberSince', { date: joined })}</Text>
        </View>
        <Card variant="soft" style={styles.month}>
          <Text style={styles.overline}>{t('impact.thisMonth')}</Text>
          {stats === undefined ? (
            <Skeleton width="70%" height={typography.cardTitle.fontSize!} />
          ) : stats === null ? (
            <Text style={styles.text}>{t('household.memberStatsError')}</Text>
          ) : (
            <View style={styles.numbers}>
              <Number value={stats.added} label={t('household.memberAdded', { count: stats.added })} />
              <Number value={stats.saved} label={t('impact.saved', { count: stats.saved })} />
            </View>
          )}
        </Card>
      </View>
    </BottomSheet>
  );
}

function Number({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.number} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.numberValue} maxFontSizeMultiplier={1.5}>{value}</Text>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: sizes.avatar,
    height: sizes.avatar,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mêmes pastilles que la liste des membres (app/household.tsx)
  avatarMe: {
    backgroundColor: colors.accent,
  },
  avatarText: {
    ...typography.button,
    color: colors.onAccent,
  },
  body: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  joined: {
    ...typography.secondary,
    flexShrink: 1,
  },
  month: {
    gap: spacing.md,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxl,
  },
  number: {
    flexShrink: 1,
  },
  numberValue: {
    ...typography.hero,
    color: colors.primary,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
});
