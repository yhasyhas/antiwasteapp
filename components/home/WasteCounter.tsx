import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Leaf, Trash2 } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { onPantryChanged } from '@/lib/pantryEvents';

interface Counts {
  saved: number;
  wasted: number;
}

interface Stats {
  household: Counts;
  me: Counts;
  shared: boolean;
}

// Compteur anti-gaspi du mois (fonction food_stats) : aliments sauvés (« J'ai cuisiné ça ») et gaspillés
// (supprimés après leur date), pour le foyer et pour moi. En nombre d'aliments, sans kilos ni euros.
export function WasteCounter() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(() => {
    supabase.rpc('food_stats').then(({ data, error }) => {
      if (error) console.warn('[compteur]', error.message);
      else setStats(data as Stats);
    });
  }, []);

  useFocusEffect(load);
  useEffect(() => onPantryChanged(load), [load]);

  if (!stats) return null;

  const row = (label: string, counts: Counts) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.value}>
        <Leaf size={16} color="#10b981" />
        <Text style={styles.saved}>{t('counter.saved', { count: counts.saved })}</Text>
      </View>
      <View style={styles.value}>
        <Trash2 size={16} color="#9ca3af" />
        <Text style={styles.wasted}>{t('counter.wasted', { count: counts.wasted })}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('counter.title')}</Text>
      {stats.shared && row(t('counter.household'), stats.household)}
      {row(stats.shared ? t('counter.me') : t('counter.mine'), stats.shared ? stats.me : stats.household)}
      {stats.household.saved + stats.household.wasted === 0 && <Text style={styles.hint}>{t('counter.hint')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 24, borderRadius: 12, padding: 16, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  rowLabel: { fontSize: 14, color: '#4b5563', minWidth: 72 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saved: { fontSize: 14, fontWeight: '600', color: '#047857' },
  wasted: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  hint: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
});
