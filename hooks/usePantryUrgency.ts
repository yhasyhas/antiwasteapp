import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { activeHouseholdId } from '@/lib/household';
import { onPantryChanged } from '@/lib/pantryEvents';
import { expiryStatus } from '@/lib/expiry';
import { isUrgentLot } from '@/lib/storage';
import { foodIdentity } from '@/lib/pantryLots';
import { foodNamesOf, loadFoodNames } from '@/lib/foodNames';
import { isBasic } from '@/lib/basics';
import { guessFoodCategory } from '@/lib/foodCategory';
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
  // Lot → catégorie et nature (« dish » : reste de plat), pour l'icône des ingrédients d'une recette
  kinds: Map<string, { category: string | null; kind: string | null }>;
}

let dates: PantryDates = { byId: new Map(), byFood: new Map(), kinds: new Map() };
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Date la plus proche (sans date : en dernier)
const earliest = (a: string | null | undefined, b: string | null) => (a === undefined ? b : !a ? b : !b ? a : a < b ? a : b);

async function reload() {
  const householdId = await activeHouseholdId();
  if (!householdId) return;
  const { data, error } = await supabase.from('ingredients').select('id, name, food_key, expires_at, date_kind, location, category, kind').eq('household_id', householdId);
  if (error) {
    console.warn('[urgence]', error.message);
    return;
  }
  // Noms des fiches dans les trois langues : une recette en anglais retrouve « bœuf » sous « beef »
  await loadFoodNames((data ?? []).map((row) => row.food_key as string | null).filter((key): key is string => !!key));
  const byId = new Map<string, string | null>();
  const byFood = new Map<string, string | null>();
  const kinds = new Map<string, { category: string | null; kind: string | null }>();
  for (const row of data ?? []) {
    kinds.set(row.id as string, { category: (row.category as string | null) ?? null, kind: (row.kind as string | null) ?? null });
    // Seules les dates des lots à utiliser vite comptent (congelé, date indicative dépassée ou date lointaine : sans date)
    const date = isUrgentLot(row as { expires_at: string | null; date_kind: string | null; location: string | null })
      ? (row.expires_at as string) : null;
    byId.set(row.id as string, date);
    const identities = new Set([row.name as string, ...(row.food_key ? foodNamesOf(row.food_key as string) : [])].map(foodIdentity));
    for (const food of identities) byFood.set(food, earliest(byFood.get(food), date));
  }
  dates = { byId, byFood, kinds };
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

// « Faisable maintenant » : ingrédients de la recette (hors sel, poivre, huile, eau) présents dans le garde-manger
// actuel, par le lot noté à la génération ou par le nom de l'aliment (dans l'une des trois langues) ; missing :
// ceux qui manquent, avec leur quantité (ajout aux courses depuis la carte)
export type Feasibility = { available: number; total: number; missing: Recipe['ingredients_used'] };

export function feasibility(recipe: Pick<Recipe, 'ingredients_used'>, pantry: PantryDates): Feasibility {
  const needed = recipe.ingredients_used.filter((item) => !isBasic(item.name));
  const inPantry = (item: Recipe['ingredients_used'][number]) => (item.pantry_id && pantry.byId.has(item.pantry_id)) || pantry.byFood.has(foodIdentity(item.name));
  const missing = needed.filter((item) => !inPantry(item));
  return { available: needed.length - missing.length, total: needed.length, missing };
}

// Icône d'un ingrédient de recette : catégorie de son lot du garde-manger s'il y est encore, sinon devinée
// d'après son nom
export function ingredientCategory(item: Recipe['ingredients_used'][number], pantry: PantryDates, language?: string): { category: string | null; kind: string | null } {
  const lot = item.pantry_id ? pantry.kinds.get(item.pantry_id) : undefined;
  if (lot && (lot.category || lot.kind === 'dish')) return lot;
  return { category: guessFoodCategory(item.name, language), kind: null };
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
