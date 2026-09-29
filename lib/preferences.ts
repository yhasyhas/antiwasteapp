import { supabase } from './supabase';
import type { Cuisine } from '@/components/recipe/types';

// Préférences de génération de l'utilisateur (table user_preferences) : appliquées par défaut à chaque
// génération, modifiables ponctuellement dans les filtres.

export interface Preferences {
  dietary: string[];
  excluded: string[];
  maxCookTime: number;
  cuisine: Cuisine;
  // Nombre de personnes ; null : pas de préférence
  servings: number | null;
}

export const DEFAULT_PREFERENCES: Preferences = { dietary: [], excluded: [], maxCookTime: 60, cuisine: 'any', servings: null };

// Temps maximum proposés (minutes)
export const COOK_TIME_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
export const MAX_EXCLUDED = 20;
export const MAX_SERVINGS = 12;

export async function loadPreferences(userId: string): Promise<Preferences & { difficulty?: string; mealType?: string; language?: string } | null> {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[préférences] lecture impossible :', error.message);
    return null;
  }
  if (!data) return DEFAULT_PREFERENCES;
  return {
    dietary: data.dietary_preferences ?? [],
    excluded: data.excluded_ingredients ?? [],
    maxCookTime: data.max_cook_time ?? 60,
    cuisine: (data.default_cuisine ?? 'any') as Cuisine,
    servings: data.servings ?? null,
    difficulty: data.default_difficulty ?? undefined,
    mealType: data.default_meal_type ?? undefined,
    language: data.default_language ?? undefined,
  };
}

export async function savePreferences(userId: string, preferences: Preferences): Promise<void> {
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    dietary_preferences: preferences.dietary,
    excluded_ingredients: preferences.excluded.slice(0, MAX_EXCLUDED),
    max_cook_time: preferences.maxCookTime,
    default_cuisine: preferences.cuisine,
    servings: preferences.servings,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}
