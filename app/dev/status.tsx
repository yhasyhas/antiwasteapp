import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { supabase } from '@/lib/supabase';

interface Counters {
  scans: number;
  generations: number;
  images: number;
}

interface ProviderEvent {
  id: number;
  provider: string;
  day: string;
  simulated: boolean;
  function_name: string;
  occurrences: number;
  last_at: string;
  last_error: string | null;
  alert: 'provider_quota' | 'provider_failure' | 'push_failure';
}

interface UsageRow {
  provider: string;
  fallback: boolean;
  recipes: number;
}

// Part des recettes servies par le secours, et détail par fournisseur
function fallbackSummary(rows: UsageRow[]) {
  const total = rows.reduce((sum, row) => sum + row.recipes, 0);
  const fallback = rows.filter((row) => row.fallback).reduce((sum, row) => sum + row.recipes, 0);
  const byProvider = new Map<string, number>();
  for (const row of rows) byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + row.recipes);
  return { total, fallback, share: total === 0 ? 0 : Math.round((fallback / total) * 100), byProvider: [...byProvider] };
}

// Développement seulement : compteurs du jour de l'utilisateur, part des recettes servies par le secours sur
// 7 jours, et derniers incidents des fournisseurs (quota épuisé, réponse refusée), pour ne jamais perdre de
// temps à déboguer un quota épuisé ou un secours qui masque une panne
export default function ServiceStatusScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const [counters, setCounters] = useState<Counters>({ scans: 0, generations: 0, images: 0 });
  const [events, setEvents] = useState<ProviderEvent[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    // Jour UTC, comme les quotas côté serveur
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: counts }, { data: providerEvents }, { data: served }] = await Promise.all([
      supabase.from('usage_counters').select('scans, generations, images').eq('user_id', user.id).eq('day', today).maybeSingle(),
      supabase.from('provider_quota_events').select('*').order('last_at', { ascending: false }).limit(15),
      // Essais (simulation, évaluation) à part
      supabase.from('provider_usage_daily').select('provider, fallback, recipes').eq('function_name', 'generate-recipes').eq('simulated', false).gte('day', weekStart),
    ]);
    setCounters(counts ?? { scans: 0, generations: 0, images: 0 });
    setEvents((providerEvents as ProviderEvent[]) ?? []);
    setUsage((served as UsageRow[]) ?? []);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (!__DEV__) return <Redirect href="/" />;
  const summary = fallbackSummary(usage);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('devStatus.title')} back />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, safe.bottom(spacing.xxl)]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <Text style={styles.sectionTitle}>{t('devStatus.today')}</Text>
        <View style={styles.counters}>
          {(['scans', 'generations', 'images'] as const).map((kind) => (
            <Card key={kind} style={styles.counter}>
              <Text style={styles.counterValue}>{counters[kind]}</Text>
              <Text style={styles.counterLabel}>{t(`devStatus.${kind}`)}</Text>
            </Card>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('devStatus.fallbackTitle')}</Text>
        <Card style={styles.event}>
          {summary.total === 0 ? (
            <Text style={styles.empty}>{t('devStatus.fallbackNone')}</Text>
          ) : (
            <>
              <Text style={styles.counterValue}>{t('devStatus.fallbackShare', { share: summary.share, fallback: summary.fallback, total: summary.total })}</Text>
              <Text style={styles.eventMeta}>
                {summary.byProvider.map(([provider, recipes]) => t('devStatus.fallbackByProvider', { provider, recipes })).join(' · ')}
              </Text>
            </>
          )}
        </Card>

        <Text style={styles.sectionTitle}>{t('devStatus.providers')}</Text>
        {events.length === 0 ? (
          <Text style={styles.empty}>{t('devStatus.none')}</Text>
        ) : (
          events.map((event) => (
            <Card key={event.id} style={styles.event}>
              <View style={styles.eventHeader}>
                <Text style={styles.provider}>{event.provider}</Text>
                <Badge label={t(`devStatus.alert_${event.alert}`)} tone={event.alert === 'provider_failure' ? 'soon' : 'neutral'} />
                {event.simulated && <Badge label={t('devStatus.simulated')} tone="neutral" />}
                <Text style={styles.eventMeta}>
                  {event.day} · {event.function_name} · {t('devStatus.occurrences', { count: event.occurrences })}
                </Text>
              </View>
              <Text style={styles.eventTime}>{new Date(event.last_at).toLocaleString(language)}</Text>
              {event.last_error ? <Text style={styles.eventError} numberOfLines={3}>{event.last_error}</Text> : null}
            </Card>
          ))
        )}

        <Button label={t('devStatus.refresh')} variant="ghost" size="small" onPress={load} style={styles.refresh} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
  },
  sectionTitle: {
    ...typography.cardTitle,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  counters: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  counter: {
    flex: 1,
    alignItems: 'center',
  },
  counterValue: {
    ...typography.title2,
  },
  counterLabel: {
    ...typography.secondary,
    marginTop: spacing.xs,
  },
  empty: {
    ...typography.secondary,
  },
  event: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  eventHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  provider: {
    ...typography.listTitle,
    color: colors.expired.text,
  },
  eventMeta: {
    ...typography.secondary,
    color: colors.text,
  },
  eventTime: {
    ...typography.secondary,
  },
  eventError: {
    ...typography.secondary,
  },
  refresh: {
    marginTop: spacing.md,
  },
});
