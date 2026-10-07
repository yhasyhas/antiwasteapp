import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { capitalized, type Counts, type Impact, loadImpact, monthLabel, tipFromFact, type WastedFood } from '@/lib/impact';
import { colors, radius, sizes, spacing, typography } from '@/constants/theme';

type Scope = 'household' | 'me';

// « Mon impact », ouvert depuis le compteur de l'accueil : ce mois-ci, les 6 derniers mois (foyer ou moi), et les
// aliments les plus gaspillés par le foyer avec un conseil tiré de leur fiche. En nombre d'aliments, sans kilos ni euros.
export default function ImpactScreen() {
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState<Scope>('household');
  const [tips, setTips] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    loadImpact(language).then((loaded) => {
      if (loaded) setImpact(loaded);
      else setFailed(true);
    });
  }, [language]);

  useEffect(load, [load]);

  // Aliments sans conseil (fiche jamais ouverte) : fiche demandée une fois, en arrière-plan
  useEffect(() => {
    if (!impact) return;
    let cancelled = false;
    for (const food of impact.top_wasted.filter((item) => !item.tip)) {
      tipFromFact(food, language).then((tip) => {
        if (tip && !cancelled) setTips((current) => ({ ...current, [food.name]: tip }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [impact, language]);

  // Foyer non partagé : un seul bilan, celui du foyer personnel
  const current: Scope = impact?.shared ? scope : 'household';
  const counts = (index: number): Counts => impact?.months[index]?.[current] ?? { saved: 0, wasted: 0 };
  // Foyer partagé où tout ce qui a été sauvé ou gaspillé ce mois-ci vient de moi : les deux chiffres sont les mêmes
  const thisMonth = impact?.months[0];
  const allMine = !!impact?.shared && !!thisMonth && thisMonth.household.saved + thisMonth.household.wasted > 0
    && thisMonth.household.saved === thisMonth.me.saved && thisMonth.household.wasted === thisMonth.me.wasted;
  const max = Math.max(1, ...(impact?.months ?? []).map((month) => month[current].saved + month[current].wasted));

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('impact.title')} back />
      {failed ? (
        <View style={styles.content}>
          <Text style={styles.text}>{t('impact.loadError')}</Text>
          <Button label={t('common.retry')} variant="outline" onPress={load} style={styles.retry} />
        </View>
      ) : !impact ? (
        <View style={styles.content}>
          {[0, 1, 2].map((row) => <SkeletonRow key={row} />)}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, safe.bottom(spacing.xxl)]} showsVerticalScrollIndicator={false}>
          {impact.shared ? (
            <View style={styles.scopes} accessibilityRole="tablist">
              <Chip label={t('impact.household')} selected={current === 'household'} onPress={() => setScope('household')} />
              <Chip label={t('impact.me')} selected={current === 'me'} onPress={() => setScope('me')} />
            </View>
          ) : null}

          {/* Ce mois-ci */}
          <Card variant="soft" style={styles.month}>
            <Text style={styles.overline}>{t('impact.thisMonth')}</Text>
            <View style={styles.totals}>
              <Total value={counts(0).saved} label={t('impact.saved', { count: counts(0).saved })} color={colors.primary} />
              <Total value={counts(0).wasted} label={t('impact.wasted', { count: counts(0).wasted })} color={colors.expired.text} />
            </View>
            {allMine ? <Text style={styles.allMine}>{t('impact.allYours')}</Text> : null}
          </Card>

          {/* 6 derniers mois */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('impact.months')}</Text>
            <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Legend color={colors.primary} label={t('impact.legendSaved')} />
              <Legend color={colors.expired.text} label={t('impact.legendWasted')} />
            </View>
            {impact.months.map((month) => {
              const value = month[current];
              const label = monthLabel(month.month, language);
              return (
                <View
                  key={month.month}
                  style={styles.monthRow}
                  accessible
                  accessibilityLabel={t('impact.monthA11y', {
                    month: label,
                    saved: `${value.saved} ${t('impact.saved', { count: value.saved })}`,
                    wasted: `${value.wasted} ${t('impact.wasted', { count: value.wasted })}`,
                  })}
                >
                  <View style={styles.monthHead}>
                    <Text style={styles.monthLabel}>{label}</Text>
                    <Text style={styles.monthNumbers}>
                      <Text style={styles.savedNumber}>{value.saved}</Text>
                      {'  ·  '}
                      <Text style={styles.wastedNumber}>{value.wasted}</Text>
                    </Text>
                  </View>
                  <View style={styles.track}>
                    {value.saved > 0 ? <View style={[styles.bar, styles.barSaved, { flex: value.saved / max }]} /> : null}
                    {value.wasted > 0 ? <View style={[styles.bar, styles.barWasted, { flex: value.wasted / max }]} /> : null}
                    <View style={{ flex: Math.max(0, 1 - (value.saved + value.wasted) / max) }} />
                  </View>
                </View>
              );
            })}
          </Card>

          {/* Les plus gaspillés (foyer) */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>{t('impact.topTitle')}</Text>
            <Text style={styles.secondary}>{impact.shared ? t('impact.topSubtitleHousehold') : t('impact.topSubtitle')}</Text>
            {impact.top_wasted.length === 0 ? (
              <Text style={styles.text}>{t('impact.topNone')}</Text>
            ) : (
              impact.top_wasted.map((food) => <WastedRow key={`${food.food_key ?? ''}-${food.name}`} food={food} tip={food.tip ?? tips[food.name] ?? null} />)
            )}
          </Card>

          <Text style={styles.secondary}>{t('counter.hint')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Total({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.total} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.totalNumber, { color }]} maxFontSizeMultiplier={1.5}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.secondary}>{label}</Text>
    </View>
  );
}

function WastedRow({ food, tip }: { food: WastedFood; tip: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={styles.wasted}>
      <View style={styles.wastedHead}>
        <Text style={styles.wastedName}>{capitalized(food.name)}</Text>
        <Text style={styles.wastedCount}>{t('impact.times', { count: food.count })}</Text>
      </View>
      {tip ? (
        <View style={styles.tip} accessible accessibilityLabel={`${t('impact.tipLabel')} : ${tip}`}>
          <Lightbulb size={sizes.iconSmall} color={colors.primary} />
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
  },
  retry: {
    alignSelf: 'flex-start',
  },
  scopes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  month: {
    gap: spacing.md,
    padding: spacing.xl,
  },
  overline: {
    ...typography.overline,
    color: colors.primary,
  },
  allMine: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  totals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxl,
  },
  total: {
    flexShrink: 1,
    minWidth: sizes.thumbnail,
  },
  totalNumber: {
    ...typography.display,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.text,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
  },
  monthRow: {
    gap: spacing.xs,
  },
  monthHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  monthLabel: {
    ...typography.label,
    color: colors.text,
  },
  monthNumbers: {
    ...typography.label,
    color: colors.textSecondary,
  },
  savedNumber: {
    color: colors.primary,
  },
  wastedNumber: {
    color: colors.expired.text,
  },
  track: {
    flexDirection: 'row',
    height: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
  barSaved: {
    backgroundColor: colors.primary,
  },
  barWasted: {
    backgroundColor: colors.expired.text,
  },
  wasted: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: sizes.borderWidth,
    borderTopColor: colors.border,
  },
  wastedHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.md,
  },
  wastedName: {
    ...typography.listTitle,
    color: colors.text,
    flexShrink: 1,
  },
  wastedCount: {
    ...typography.secondaryStrong,
    color: colors.expired.text,
  },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  tipText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
  secondary: {
    ...typography.secondary,
  },
});
