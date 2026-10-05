// « Mes recettes » : onglets (Favoris, Pour plus tard, Toutes), recherche par titre et par ingrédient, filtres rapides,
// tri des recettes les plus faisables avec le garde-manger actuel, sections par période. Sans appel réseau.

import type { Recipe } from '@/components/recipe/types';
import { cuisineKey } from './cuisines';

export type SavedTab = 'favorites' | 'later' | 'all';
export type Period = 'week' | 'month' | 'older';

export interface SavedFilters {
  query: string;
  // Faisable maintenant : au plus MAX_MISSING ingrédients manquants (hors basiques), les plus faisables en premier
  feasible: boolean;
  // Utilise au moins un aliment du garde-manger à utiliser vite
  urgent: boolean;
  // Moins de 30 minutes
  quick: boolean;
  cuisine: string | null;
  // Régime vérifié par le serveur (« vegan », « gluten-free »…)
  diet: string | null;
  meal: string | null;
}

export const NO_FILTERS: SavedFilters = { query: '', feasible: false, urgent: false, quick: false, cuisine: null, diet: null, meal: null };
export const QUICK_MINUTES = 30;
export const MAX_MISSING = 1;

export type SavedRecipe = Recipe & { id: string; is_favorite: boolean };

interface Context {
  feasibility: (recipe: Recipe) => { available: number; total: number };
  toSave: (recipe: Recipe) => number;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').trim();

// Le titre ou un ingrédient contient tous les mots cherchés
export function matchesQuery(recipe: Recipe, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize([recipe.title, ...recipe.ingredients_used.map((item) => item.name)].join(' '));
  return words.every((word) => haystack.includes(word));
}

export const missingCount = (recipe: Recipe, context: Context) => {
  const { available, total } = context.feasibility(recipe);
  return total - available;
};

export function filterRecipes(recipes: SavedRecipe[], tab: SavedTab, filters: SavedFilters, context: Context): SavedRecipe[] {
  const inTab = recipes.filter((recipe) => (tab === 'favorites' ? recipe.is_favorite : tab === 'later' ? !!recipe.later_at : true));
  const kept = inTab.filter((recipe) => matchesQuery(recipe, filters.query)
    && (!filters.feasible || missingCount(recipe, context) <= MAX_MISSING)
    && (!filters.urgent || context.toSave(recipe) > 0)
    && (!filters.quick || (recipe.total_time > 0 && recipe.total_time < QUICK_MINUTES))
    && (!filters.cuisine || (!!recipe.cuisine && cuisineKey(recipe.cuisine) === filters.cuisine))
    && (!filters.diet || recipe.dietary_tags.includes(`diet:${filters.diet}`))
    && (!filters.meal || recipe.meal_type === filters.meal));
  if (!filters.feasible) return kept;
  // Les plus faisables d'abord : moins d'ingrédients manquants, puis la plus grande part disponible
  return [...kept].sort((a, b) => {
    const missing = missingCount(a, context) - missingCount(b, context);
    if (missing !== 0) return missing;
    const share = (recipe: Recipe) => {
      const { available, total } = context.feasibility(recipe);
      return total === 0 ? 0 : available / total;
    };
    return share(b) - share(a);
  });
}

// Période d'une date : cette semaine (7 derniers jours), ce mois-ci (30 derniers jours), plus ancien
export function periodOf(date: string | null | undefined, now = Date.now()): Period {
  const time = date ? Date.parse(date) : NaN;
  if (!Number.isFinite(time)) return 'older';
  const days = (now - time) / 86_400_000;
  return days < 7 ? 'week' : days < 30 ? 'month' : 'older';
}

// Sections par période, dans l'ordre de la liste (date : mise de côté dans « Pour plus tard », sinon enregistrement)
export function periodSections(recipes: SavedRecipe[], tab: SavedTab, now = Date.now()): { period: Period; items: SavedRecipe[] }[] {
  const periods: Period[] = ['week', 'month', 'older'];
  return periods
    .map((period) => ({ period, items: recipes.filter((recipe) => periodOf(tab === 'later' ? recipe.later_at ?? recipe.created_at : recipe.created_at, now) === period) }))
    .filter((section) => section.items.length > 0);
}

// Valeurs proposées par un filtre : seulement celles présentes dans les recettes
export const optionsOf = (recipes: SavedRecipe[], pick: (recipe: SavedRecipe) => string[]) =>
  [...new Set(recipes.flatMap(pick))].filter(Boolean);
