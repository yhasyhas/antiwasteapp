import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { activeHouseholdId } from '@/lib/household';
import { onPantryChanged } from '@/lib/pantryEvents';
import { expiryStatus } from '@/lib/expiry';
import { isUrgentLot } from '@/lib/storage';
import { foodIdentity } from '@/lib/pantryLots';
import type { Recipe } from '@/components/recipe/types';

// Dates du garde-manger actuel du foyer (seulement celles des lots à utiliser vite), partagées par les cartes et fiches de recette pour le badge
// « X à sauver » (recettes nouvelles comme enregistrées) ; rechargées quand le garde-manger change (temps
// réel, ajout, « J'ai cuisiné ça »)

export interface PantryDates {
  // Lot → date
  byId: Map<string, string | null>;
  // Aliment (nom normalisé) → date la plus proche de ses lots : lot noté à la génération disparu, mais
  // l'aliment est encore là (autre lot)
  byFood: Map<string, string | null>;
}

let dates: PantryDates = { byId: new Map(), byFood: new Map() };
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Date la plus proche (sans date : en dernier)
const earliest = (a: string | null | undefined, b: string | null) => (a === undefined ? b : !a ? b : !b ? a : a < b ? a : b);

async function reload() {
  const householdId = await activeHouseholdId();
  if (!householdId) return;
  const { data, error } = await supabase.from('ingredients').select('id, name, expires_at, date_kind, location').eq('household_id', householdId);
  if (error) {
    console.warn('[urgence]', error.message);
    return;
  }
  const byId = new Map<string, string | null>();
  const byFood = new Map<string, string | null>();
  for (const row of data ?? []) {
    // Seules les dates des lots à utiliser vite comptent (congelé, date indicative dépassée ou date lointaine : sans date)
    const date = isUrgentLot(row as { expires_at: string | null; date_kind: string | null; location: string | null })
      ? (row.expires_at as string) : null;
    byId.set(row.id as string, date);
    const food = foodIdentity(row.name as string);
    byFood.set(food, earliest(byFood.get(food), date));
  }
  dates = { byId, byFood };
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

// Nombre d'aliments du garde-manger actuel utilisés par la recette qui sont expirés ou expirent bientôt : lot
// noté à la génération, sinon le même aliment retrouvé par son nom ; 0 (badge masqué) s'il n'en reste aucun
export function toSaveCount(recipe: Pick<Recipe, 'ingredients_used'>, pantry: PantryDates): number {
  const foods = new Map<string, string | null>();
  for (const item of recipe.ingredients_used) {
    if (!item.pantry_id) continue;
    const food = foodIdentity(item.name);
    const date = pantry.byId.has(item.pantry_id) ? pantry.byId.get(item.pantry_id)! : pantry.byFood.get(food);
    if (date === undefined) continue;
    foods.set(food, earliest(foods.get(food), date));
  }
  let count = 0;
  for (const date of foods.values()) {
    const status = expiryStatus(date);
    if (status === 'expired' || status === 'soon') count++;
  }
  return count;
}

export function usePantryUrgency(): PantryDates {
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
