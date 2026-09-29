import { supabase } from '@/lib/supabase';
import { activeHouseholdId } from '@/lib/household';
import { findExisting, groupLots, mergeTarget, type LotGroup, type NewFood } from '@/lib/pantryLots';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';

// Garde-manger du foyer actif (lots), ou null s'il n'a pas pu être lu
export async function loadPantry(): Promise<PantryIngredient[] | null> {
  const householdId = await activeHouseholdId();
  if (!householdId) return null;
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[garde-manger] lecture impossible :', error.message);
    return null;
  }
  return data as PantryIngredient[];
}

// Aliment déjà présent : ajouté à un lot existant, ou en lot séparé (la ligne de l'aliment reste unique)
export type ExistingChoice = 'merge' | 'separate';

export interface FoodToAdd extends NewFood {
  category?: string | null;
  storage_tip?: string | null;
  added_via: 'camera' | 'barcode' | 'manual';
  choice?: ExistingChoice;
}

// Le garde-manger a changé entre-temps (autre membre) : rien n'a été enregistré
export class PantryConflictError extends Error {}

// Ajout en une seule opération (tout ou rien). Plusieurs aliments ajoutés au même lot : totaux calculés
// l'un après l'autre.
export async function addPantryItems(foods: FoodToAdd[], groups: LotGroup<PantryIngredient>[], language: string): Promise<void> {
  const current = new Map<string, string>();
  const items = foods.map((food) => {
    const base = {
      name: food.name,
      quantity: food.quantity,
      category: food.category ?? null,
      kind: food.kind,
      storage_tip: food.storage_tip || null,
      food_key: food.food_key ?? null,
      barcode: food.barcode ?? null,
      expires_at: food.expires_at,
      added_via: food.added_via,
    };
    const group = food.choice === 'merge' ? findExisting(groups, food) : null;
    if (!group) return base;
    const patched = { ...group, lots: group.lots.map((lot) => ({ ...lot, quantity: current.get(lot.id) ?? lot.quantity })) };
    const target = mergeTarget(patched, food, language);
    if (!target) return base;
    current.set(target.lot.id, target.total);
    return { ...base, merge_into: target.lot.id, expected_quantity: target.lot.quantity ?? '', merged_quantity: target.total };
  });
  const { error } = await supabase.rpc('add_pantry_items', { p_items: items });
  if (error?.message.includes('pantry_conflict')) throw new PantryConflictError(error.message);
  if (error) throw error;
}

// Lignes du garde-manger (aliments regroupés), pour repérer ce qui y est déjà
export const pantryGroups = (rows: PantryIngredient[] | null) => groupLots(rows ?? []);
