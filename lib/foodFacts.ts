import { callEdgeFunction } from './callEdgeFunction';
import { failureReasonOf, type FailureReason } from './quotaReason';
import { supabase } from './supabase';

// Fiches aliments (fonction food-fact) : générées une seule fois pour tous les utilisateurs, dans les trois
// langues ; ensuite simplement relues. Fiches déjà ouvertes gardées en mémoire pendant la session.

export interface FoodFactSection {
  name: string;
  description: string;
  origin: string;
  season: string;
  nutrition: string[];
  tips: string[];
}

export type FoodFact = Record<'fr' | 'en' | 'es', FoodFactSection>;

export type FoodFactResult =
  | { ok: true; foodKey: string; fact: FoodFact }
  | { ok: false; reason: FailureReason | 'not_food' };

const cache = new Map<string, { foodKey: string; fact: FoodFact }>();

// Pendant qu'un autre appel génère la fiche : nouvel essai toutes les 3 s, 15 fois au plus
const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 15;

export async function fetchFoodFact(ingredient: { id: string; name: string; food_key?: string | null }): Promise<FoodFactResult> {
  const cached = cache.get(ingredient.food_key ?? `name:${ingredient.name.toLowerCase()}`);
  if (cached) return { ok: true, ...cached };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { response, data } = await callEdgeFunction('food-fact', {
        name: ingredient.name,
        food_key: ingredient.food_key ?? undefined,
        ingredient_id: ingredient.id,
      });
      if (response.ok && data?.fact) {
        const entry = { foodKey: data.food_key as string, fact: data.fact as FoodFact };
        cache.set(entry.foodKey, entry);
        cache.set(`name:${ingredient.name.toLowerCase()}`, entry);
        return { ok: true, ...entry };
      }
      if (response.status === 404 && data?.error === 'not_food') return { ok: false, reason: 'not_food' };
      if (response.status !== 202) return { ok: false, reason: failureReasonOf(data) ?? 'provider_error' };
    } catch (error) {
      console.warn('[fiche] appel impossible', error);
      return { ok: false, reason: 'provider_error' };
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  return { ok: false, reason: 'provider_error' };
}

// « Signaler une erreur » : visible seulement par son auteur et par la relecture
export async function reportFoodFact(foodKey: string, language: string, message: string): Promise<boolean> {
  const { error } = await supabase.from('food_fact_reports').insert({
    food_key: foodKey,
    language: ['fr', 'en', 'es'].includes(language) ? language : 'fr',
    message: message.trim().slice(0, 500) || null,
  });
  if (error) console.warn('[fiche] signalement impossible :', error.message);
  return !error;
}
