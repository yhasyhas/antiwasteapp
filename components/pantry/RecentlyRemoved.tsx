import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Card, cardStyles } from '@/components/ui/Card';
import { Touchable } from '@/components/ui/Touchable';
import { undoPantryAction } from '@/hooks/useUndoableAction';
import { capitalizeFirst } from '@/lib/foodNames';
import { notifyPantryChanged, notifyShoppingChanged, onPantryChanged, onShoppingChanged } from '@/lib/pantryEvents';
import { supabase } from '@/lib/supabase';
import { colors, sizes, spacing, typography } from '@/constants/theme';

interface RecentAction {
  id: string;
  kind: 'cook' | 'delete_ingredient' | 'delete_shopping';
  created_at: string;
  names: string[];
  removed_count: number;
  updated_count: number;
}

// Lignes montrées avant « Tout afficher »
const COLLAPSED_COUNT = 3;

// Il y a combien de temps : « à l'instant », « il y a 5 min », « il y a 2 h »
function timeAgo(t: TFunction, iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t('recent.justNow');
  if (minutes < 60) return t('recent.minutesAgo', { count: minutes });
  return t('recent.hoursAgo', { count: Math.floor(minutes / 60) });
}

function kindLabel(t: TFunction, action: RecentAction): string {
  if (action.kind === 'cook') return t('recent.cooked');
  if (action.kind === 'delete_shopping') return t('recent.removedFromShopping');
  return action.removed_count > 1 ? t('recent.lotsRemoved', { count: action.removed_count }) : t('recent.removedFromPantry');
}

// « Récemment retirés », en bas du garde-manger : mes retraits (lots, aliments, articles de courses) et mes
// « J'ai cuisiné ça » des dernières 24 heures, chacun avec « Rétablir » (mêmes règles que « Annuler » : tout ou
// rien, une seule fois, message si un autre membre a changé un aliment entre-temps)
export function RecentlyRemoved() {
  const { t } = useLanguage();
  const [actions, setActions] = useState<RecentAction[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('recent_pantry_actions');
    if (error) {
      console.warn('[récemment retirés] lecture impossible :', error.message);
      return;
    }
    setActions((data ?? []) as RecentAction[]);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));
  useEffect(() => onPantryChanged(load), [load]);
  useEffect(() => onShoppingChanged(load), [load]);

  const restore = async (action: RecentAction) => {
    setRestoring(action.id);
    const restored = await undoPantryAction(t, action.id);
    setRestoring(null);
    if (restored) {
      notifyPantryChanged();
      if (action.kind === 'delete_shopping') notifyShoppingChanged();
    }
    load();
  };

  if (actions.length === 0) return null;
  const shown = expanded ? actions : actions.slice(0, COLLAPSED_COUNT);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('recent.title')}</Text>
      <Text style={styles.hint}>{t('recent.hint')}</Text>
      {shown.map((action) => (
        <View key={action.id}>
          <View style={cardStyles.divider} />
          <View style={styles.row}>
            <View style={styles.text}>
              <Text style={styles.names} numberOfLines={2}>{action.names.map(capitalizeFirst).join(', ')}</Text>
              <Text style={styles.details}>{`${kindLabel(t, action)} · ${timeAgo(t, action.created_at)}`}</Text>
            </View>
            <Button
              label={t('recent.restore')}
              icon={RotateCcw}
              variant="outline"
              size="small"
              onPress={() => restore(action)}
              loading={restoring === action.id}
              disabled={restoring !== null}
            />
          </View>
        </View>
      ))}
      {actions.length > COLLAPSED_COUNT ? (
        <Touchable onPress={() => setExpanded(!expanded)} style={styles.more} accessibilityRole="button">
          <Text style={styles.moreText}>{expanded ? t('recent.showLess') : t('recent.showAll', { count: actions.length })}</Text>
        </Touchable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
  },
  hint: {
    ...typography.secondary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  names: {
    ...typography.listTitle,
  },
  details: {
    ...typography.secondary,
  },
  more: {
    minHeight: sizes.touch,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  moreText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
