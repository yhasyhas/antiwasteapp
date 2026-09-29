import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { activeHouseholdId } from '@/lib/household';
import { onPantryChanged } from '@/lib/pantryEvents';
import { expiryStatus } from '@/lib/expiry';
import type { Recipe } from '@/components/recipe/types';

// Dates du garde-manger du foyer (identifiant → date), partagées par les cartes de recette pour le badge
// « X à sauver » ; rechargées quand le garde-manger change (temps réel, ajout, « J'ai cuisiné ça »)

let dates = new Map<string, string | null>();
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function reload() {
  const householdId = await activeHouseholdId();
  if (!householdId) return;
  const { data, error } = await supabase.from('ingredients').select('id, expires_at').eq('household_id', householdId);
  if (error) {
    console.warn('[urgence]', error.message);
    return;
  }
  dates = new Map((data ?? []).map((row) => [row.id as string, (row.expires_at as string | null) ?? null]));
  loaded = true;
  listeners.forEach((listener) => listener());
}

function ensureLoaded() {
  if (!loaded && !loading) loading = reload().finally(() => (loading = null));
}

onPantryChanged(() => {
  if (listeners.size > 0) reload();
  else loaded = false;
});

// Nombre d'aliments du garde-manger utilisés par la recette qui sont expirés ou expirent bientôt
export function toSaveCount(recipe: Pick<Recipe, 'ingredients_used'>, pantry: Map<string, string | null>): number {
  const ids = new Set(recipe.ingredients_used.map((item) => item.pantry_id).filter((id): id is string => !!id));
  let count = 0;
  for (const id of ids) {
    if (!pantry.has(id)) continue;
    const status = expiryStatus(pantry.get(id));
    if (status === 'expired' || status === 'soon') count++;
  }
  return count;
}

export function usePantryUrgency(): Map<string, string | null> {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    ensureLoaded();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return dates;
}
