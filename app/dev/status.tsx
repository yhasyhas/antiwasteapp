import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Redirect, Stack, useFocusEffect } from 'expo-router';
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
    <>
      <Stack.Screen options={{ headerShown: true, title: t('devStatus.title') }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, safe.bottom(24)]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Text style={styles.sectionTitle}>{t('devStatus.today')}</Text>
        <View style={styles.counters}>
          {(['scans', 'generations', 'images'] as const).map((kind) => (
            <View key={kind} style={styles.counter}>
              <Text style={styles.counterValue}>{counters[kind]}</Text>
              <Text style={styles.counterLabel}>{t(`devStatus.${kind}`)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('devStatus.providers')}</Text>
        {events.length === 0 ? (
          <Text style={styles.empty}>{t('devStatus.none')}</Text>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.event}>
              <View style={styles.eventHeader}>
                <Text style={styles.provider}>{event.provider}</Text>
                {event.simulated && <Text style={styles.simulated}>{t('devStatus.simulated')}</Text>}
                <Text style={styles.eventMeta}>
                  {event.day} · {event.function_name} · {t('devStatus.occurrences', { count: event.occurrences })}
                </Text>
              </View>
              <Text style={styles.eventTime}>{new Date(event.last_at).toLocaleString(language)}</Text>
              {event.last_error ? <Text style={styles.eventError} numberOfLines={3}>{event.last_error}</Text> : null}
            </View>
          ))
        )}

        <TouchableOpacity style={styles.refresh} onPress={load}>
          <Text style={styles.refreshText}>{t('devStatus.refresh')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  counters: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  counter: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  counterLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  empty: {
    fontSize: 14,
    color: '#6b7280',
  },
  event: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  eventHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  provider: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
  },
  simulated: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventMeta: {
    fontSize: 13,
    color: '#374151',
  },
  eventTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  eventError: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  refresh: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  refreshText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '600',
  },
});
