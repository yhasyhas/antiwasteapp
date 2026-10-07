import { supabase } from './supabase';
import { fetchFoodFact } from './foodFacts';

// « Mon impact » (fonction food_impact) : 6 derniers mois, sauvés et gaspillés du foyer et personnels, et les
// aliments les plus gaspillés par le foyer avec le premier conseil de leur fiche. En nombre d'aliments.

export interface Counts {
  saved: number;
  wasted: number;
}

export interface ImpactMonth {
  // « 2026-10 »
  month: string;
  household: Counts;
  me: Counts;
}

export interface WastedFood {
  name: string;
  count: number;
  food_key: string | null;
  tip: string | null;
}

export interface Impact {
  shared: boolean;
  // Du plus récent au plus ancien
  months: ImpactMonth[];
  top_wasted: WastedFood[];
}

export async function loadImpact(language: string): Promise<Impact | null> {
  const { data, error } = await supabase.rpc('food_impact', { p_language: language });
  if (error) {
    console.warn('[impact]', error.message);
    return null;
  }
  return data as Impact;
}

// Aliment sans fiche (jamais ouverte) : fiche demandée une fois, conseil tiré de la fiche dans la langue de l'app
export async function tipFromFact(food: WastedFood, language: string): Promise<string | null> {
  const result = await fetchFoodFact({ id: '', name: food.name, food_key: food.food_key });
  if (!result.ok) return null;
  const section = result.fact[language as 'fr' | 'en' | 'es'] ?? result.fact.fr;
  return section?.tips?.[0] ?? null;
}

// « octobre 2026 » (mois UTC, comme la fonction)
export function monthLabel(month: string, language: string): string {
  const [year, index] = month.split('-').map(Number);
  const label = new Date(Date.UTC(year, index - 1, 15)).toLocaleDateString(language, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Nom affiché : première lettre en majuscule (les fiches sont en minuscules)
export const capitalized = (name: string) => (name ? name.charAt(0).toUpperCase() + name.slice(1) : name);
