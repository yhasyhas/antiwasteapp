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
}

// Développement seulement : compteurs du jour de l'utilisateur et derniers quotas de fournisseurs épuisés,
// pour ne jamais perdre de temps à déboguer un quota épuisé
export default function ServiceStatusScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const safe = useSafeSpacing();
  const [counters, setCounters] = useState<Counters>({ scans: 0, generations: 0, images: 0 });
  const [events, setEvents] = useState<ProviderEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    // Jour UTC, comme les quotas côté serveur
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: usage }, { data: providerEvents }] = await Promise.all([
      supabase.from('usage_counters').select('scans, generations, images').eq('user_id', user.id).eq('day', today).maybeSingle(),
      supabase.from('provider_quota_events').select('*').order('last_at', { ascending: false }).limit(15),
    ]);
    setCounters(usage ?? { scans: 0, generations: 0, images: 0 });
    setEvents((providerEvents as ProviderEvent[]) ?? []);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (!__DEV__) return <Redirect href="/" />;

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

        <Text style={styles.sectionTitle}>{t('devStatus.providers')}</Text>
        {events.length === 0 ? (
          <Text style={styles.empty}>{t('devStatus.none')}</Text>
        ) : (
          events.map((event) => (
            <Card key={event.id} style={styles.event}>
              <View style={styles.eventHeader}>
                <Text style={styles.provider}>{event.provider}</Text>
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
