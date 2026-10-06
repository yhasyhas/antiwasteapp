import { supabase } from './supabase';
import type { Cuisine } from '@/components/recipe/types';
import { cuisineId, OTHER_CUISINE, OTHER_MAX_LENGTH } from './cuisines';
import { cleanBasics, DEFAULT_BASICS, setUserBasics } from './basics';
import { currentLanguage } from '@/i18n';

// Préférences de génération de l'utilisateur (table user_preferences) : appliquées par défaut à chaque
// génération, modifiables ponctuellement dans les filtres.

export interface Preferences {
  dietary: string[];
  excluded: string[];
  maxCookTime: number;
  cuisine: Cuisine;
  // Texte de « Autre cuisine… » (cuisine « other »)
  cuisineOther: string | null;
  // Nombre de personnes ; null : pas de préférence
  servings: number | null;
  // « Mes basiques » : identifiants connus ou noms libres (lib/basics.ts)
  basics: string[];
}

export const DEFAULT_PREFERENCES: Preferences = { dietary: [], excluded: [], maxCookTime: 60, cuisine: 'any', cuisineOther: null, servings: null, basics: [...DEFAULT_BASICS] };

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
  // Basiques gardés en mémoire pour « Faisable maintenant » et « À acheter » (lib/basics.ts)
  setUserBasics(data?.basics ?? null);
  if (!data) return DEFAULT_PREFERENCES;
  return {
    dietary: data.dietary_preferences ?? [],
    excluded: data.excluded_ingredients ?? [],
    maxCookTime: data.max_cook_time ?? 60,
    // Anciennes valeurs (« african »…) ramenées au découpage actuel
    cuisine: cuisineId(data.default_cuisine),
    cuisineOther: data.default_cuisine_other ?? null,
    servings: data.servings ?? null,
    basics: data.basics ? cleanBasics(data.basics) : [...DEFAULT_BASICS],
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
    default_cuisine: preferences.cuisine === OTHER_CUISINE && !preferences.cuisineOther?.trim() ? 'any' : preferences.cuisine,
    default_cuisine_other: preferences.cuisine === OTHER_CUISINE ? preferences.cuisineOther?.trim().slice(0, OTHER_MAX_LENGTH) || null : null,
    servings: preferences.servings,
    basics: cleanBasics(preferences.basics),
    // Sinon un premier enregistrement prend la valeur par défaut de la colonne (« fr ») : l'app et les e-mails
    // repasseraient en français
    default_language: currentLanguage(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  setUserBasics(preferences.basics);
}
