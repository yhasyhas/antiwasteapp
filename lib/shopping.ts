import { supabase } from './supabase';
import { activeHouseholdId } from './household';
import { notifyPantryChanged, notifyShoppingChanged } from './pantryEvents';

export { onShoppingChanged } from './pantryEvents';

// Liste de courses du foyer (table shopping_items, migration shopping_list), partagée par les membres.
// Temps réel : le canal du foyer signale chaque changement (événement « shopping », lib/household.ts).

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  recipe_title: string | null;
  added_by: string | null;
  checked: boolean;
  checked_by: string | null;
  created_at: string;
}

// À acheter d'abord (plus anciens en haut), puis ce qui est déjà dans le panier
export async function loadShoppingList(): Promise<ShoppingItem[] | null> {
  const householdId = await activeHouseholdId();
  if (!householdId) return null;
  const { data, error } = await supabase
    .from('shopping_items')
    .select('id, name, quantity, recipe_title, added_by, checked, checked_by, created_at')
    .eq('household_id', householdId)
    .order('checked')
    .order('created_at');
  if (error) {
    console.warn('[courses] liste illisible :', error.message);
    return null;
  }
  return data as ShoppingItem[];
}

async function write<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  notifyShoppingChanged();
  return data;
}

export const addShoppingItem = (name: string, quantity: string) =>
  write(supabase.from('shopping_items').insert({ name: name.trim(), quantity: quantity.trim() }));

export const setShoppingItemChecked = (id: string, checked: boolean) =>
  write(supabase.from('shopping_items').update({ checked }).eq('id', id));

export const removeShoppingItem = (id: string) =>
  write(supabase.from('shopping_items').delete().eq('id', id));

// Ingrédients manquants d'une recette, en un geste ; renvoie le nombre d'articles ajoutés (sans doublon)
export const addMissingToShoppingList = (names: string[], recipeId?: string, recipeTitle?: string) =>
  write(supabase.rpc('add_to_shopping_list', {
    p_names: names,
    p_recipe_id: recipeId ?? null,
    p_recipe_title: recipeTitle ?? null,
  })) as Promise<number>;

// Articles achetés rangés au garde-manger, avec leur date ; renvoie le nombre d'aliments rangés
export async function stockShoppingItems(items: { id: string; expires_at: string | null }[]): Promise<number> {
  const count = (await write(supabase.rpc('stock_shopping_items', { p_items: items }))) as number;
  notifyPantryChanged();
  return count;
}
