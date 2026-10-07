// Variété au sein d'une génération (phase 10) : deux recettes d'une même génération ne doivent pas être le même plat
// à un ou deux ingrédients près (ex. un ragoût de bœuf au poivron et le même à la tomate). Le modèle déclare pour
// chaque recette un type de plat et une technique (schéma : texte libre, ramené ici à une liste fermée) ; le serveur
// compare aussi les ingrédients. Une recette trop proche d'une précédente est redemandée une fois (autre plat, autre
// technique) ; si la nouvelle est encore trop proche, l'originale est gardée. Partagé par generate-recipes et
// generate-recipes-eval (mesure « variété au sein d'une génération » de scripts/recipe-eval).

import { isBasic, normalizeName, type Recipe } from './recipes.ts';

export { DISH_TYPES, TECHNIQUES } from './kinds.ts';

// Mots sans valeur pour comparer deux listes d'ingrédients (état, coupe, couleur fréquente)
const NOISE = new Set([
  'frais', 'fraiche', 'fresh', 'fresco', 'fresca', 'moulu', 'moulue', 'ground', 'molido', 'molida', 'hache', 'hachee', 'chopped', 'picado', 'picada',
  'de', 'du', 'des', 'la', 'le', 'les', 'en', 'of', 'the', 'a', 'el', 'los', 'las', 'y', 'et', 'and', 'con', 'with', 'avec', 'au', 'aux',
  'rouge', 'red', 'rojo', 'roja', 'vert', 'verte', 'green', 'verde', 'jaune', 'yellow', 'amarillo', 'blanc', 'white', 'blanco',
  'petit', 'petite', 'small', 'pequeno', 'gros', 'grosse', 'large', 'grande', 'conserve', 'canned', 'lata', 'sec', 'seche', 'dried', 'seco', 'seca',
]);

// Ingrédients d'une recette (hors basiques), en mots normalisés
export function ingredientWords(recipe: Pick<Recipe, 'ingredients_used'>, basics?: string[]): Set<string> {
  const words = recipe.ingredients_used
    .filter((ingredient) => !isBasic(ingredient.name, basics))
    .flatMap((ingredient) => normalizeName(ingredient.name).split(/[^a-z0-9]+/))
    .filter((word) => word.length >= 3 && !NOISE.has(word))
    // Pluriel simple : « tomates » et « tomate » comptent pour un
    .map((word) => (word.length > 3 ? word.replace(/s$/, '') : word));
  return new Set(words);
}

export function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / (a.size + b.size - shared);
}

// Seuils : même type et même technique avec des ingrédients en partie communs ; type non déclaré (« other », anciennes
// recettes) : presque les mêmes ingrédients. Deux types déclarés différents ne sont jamais trop proches : avec un petit
// garde-manger, une soupe et un sauté partagent naturellement leurs ingrédients (évaluation du 06/10/2026)
export const SAME_KIND_OVERLAP = 0.4;
export const SAME_INGREDIENTS_OVERLAP = 0.75;

export interface Closeness {
  close: boolean;
  sameKind: boolean;
  overlap: number;
}

export function closeness(a: Recipe, b: Recipe, basics?: string[]): Closeness {
  const sameKind = a.dish_type !== undefined && a.dish_type !== 'other' && a.dish_type === b.dish_type
    && a.technique !== undefined && a.technique !== 'other' && a.technique === b.technique;
  const undeclared = [a.dish_type, b.dish_type].some((kind) => kind === undefined || kind === 'other');
  const shared = overlap(ingredientWords(a, basics), ingredientWords(b, basics));
  return { close: (sameKind && shared >= SAME_KIND_OVERLAP) || (undeclared && shared >= SAME_INGREDIENTS_OVERLAP), sameKind, overlap: Math.round(shared * 100) / 100 };
}

// Recettes trop proches d'une recette précédente de la même génération (indices, la première de chaque groupe gardée)
export function tooCloseIndexes(recipes: Recipe[], basics?: string[]): number[] {
  const kept: Recipe[] = [];
  const close: number[] = [];
  recipes.forEach((recipe, index) => {
    if (kept.some((other) => closeness(other, recipe, basics).close)) close.push(index);
    else kept.push(recipe);
  });
  return close;
}

export interface VarietyReport {
  // Recettes trop proches d'une précédente, remplacées, gardées faute de mieux (temps écoulé, nouvelle recette encore trop proche)
  close: string[];
  replaced: string[];
  kept: string[];
}

// Remplacement des recettes trop proches : une seule demande pour toutes ; `request` reçoit le nombre de recettes et
// les recettes gardées (titre, type, technique) à ne pas refaire, et renvoie les nouvelles recettes (null : échec)
export async function varietyPass(recipes: Recipe[], options: {
  basics?: string[];
  request: (count: number, keep: Recipe[]) => Promise<Recipe[] | null>;
  // Passé ce moment, pas de nouvelle demande (la génération doit rester rapide)
  latestStart: number;
}): Promise<{ recipes: Recipe[]; report: VarietyReport }> {
  const closeIndexes = tooCloseIndexes(recipes, options.basics);
  const report: VarietyReport = { close: closeIndexes.map((i) => recipes[i].title), replaced: [], kept: [] };
  if (closeIndexes.length === 0) return { recipes, report };
  if (Date.now() > options.latestStart) {
    report.kept = [...report.close];
    return { recipes, report };
  }
  const kept = recipes.filter((_, index) => !closeIndexes.includes(index));
  const fresh = (await options.request(closeIndexes.length, kept).catch(() => null)) ?? [];
  const result = [...recipes];
  const accepted = [...kept];
  closeIndexes.forEach((index) => {
    const candidate = fresh.find((recipe) => !accepted.some((other) => closeness(other, recipe, options.basics).close || normalizeName(other.title) === normalizeName(recipe.title)));
    if (candidate) {
      fresh.splice(fresh.indexOf(candidate), 1);
      result[index] = candidate;
      accepted.push(candidate);
      report.replaced.push(recipes[index].title);
    } else {
      accepted.push(recipes[index]);
      report.kept.push(recipes[index].title);
    }
  });
  return { recipes: result, report };
}

// Recette à ne pas refaire, pour la consigne (« Déjà proposées ») : titre, avec son type et sa technique s'ils sont connus
export function titleWithKind(recipe: Pick<Recipe, 'title' | 'dish_type' | 'technique'>): string {
  return recipe.dish_type && recipe.dish_type !== 'other' ? `${recipe.title} (${recipe.dish_type}, ${recipe.technique ?? 'other'})` : recipe.title;
}

// Retire les champs de comparaison avant l'envoi à l'app
export function withoutKind(recipe: Recipe): Recipe {
  const { dish_type: _dish, technique: _technique, ...rest } = recipe;
  return rest;
}
