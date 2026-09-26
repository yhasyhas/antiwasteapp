import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Favoris de l'utilisateur (table favorites), partagés par la génération, l'accueil et les favoris

export async function loadFavoriteIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId);
  return new Set((data ?? []).map((row) => row.recipe_id as string));
}

// Renvoie l'erreur d'écriture, ou null si c'est fait
export async function setFavorite(userId: string, recipeId: string, favorite: boolean): Promise<PostgrestError | null> {
  if (!favorite) {
    const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('recipe_id', recipeId);
    return error;
  }
  const { error } = await supabase.from('favorites').insert({ user_id: userId, recipe_id: recipeId });
  // 23505 : déjà en favori (contrainte unique user_id + recipe_id)
  return error && error.code !== '23505' ? error : null;
}
