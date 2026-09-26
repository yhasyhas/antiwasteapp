import type { TFunction } from 'i18next';

// Libellés traduits de valeurs enregistrées en base (codes en anglais)

const DIFFICULTY_KEYS = {
  easy: 'difficulty.easy',
  medium: 'difficulty.medium',
  expert: 'difficulty.expert',
  hard: 'difficulty.hard',
} as const;

// Difficulté d'une recette ; une valeur inconnue est affichée telle quelle
export function difficultyLabel(t: TFunction, value: string): string {
  const key = DIFFICULTY_KEYS[value as keyof typeof DIFFICULTY_KEYS];
  return key ? t(key) : value;
}

// Étiquettes de régime : les modèles les écrivent librement (« vegetarian », « Gluten-Free », « gluten‑free »
// avec un trait d'union insécable, « sans gluten »…). Forme normalisée → clé de traduction.
const DIET_KEYS: Record<string, 'diet.vegetarian' | 'diet.vegan' | 'diet.glutenFree' | 'diet.dairyFree' | 'diet.lowCarb' | 'diet.pescatarian'> = {
  vegetarian: 'diet.vegetarian',
  vegetarien: 'diet.vegetarian',
  vegetariana: 'diet.vegetarian',
  vegetariano: 'diet.vegetarian',
  veggie: 'diet.vegetarian',
  vegan: 'diet.vegan',
  vegane: 'diet.vegan',
  vegana: 'diet.vegan',
  vegano: 'diet.vegan',
  glutenfree: 'diet.glutenFree',
  sansgluten: 'diet.glutenFree',
  singluten: 'diet.glutenFree',
  dairyfree: 'diet.dairyFree',
  lactosefree: 'diet.dairyFree',
  sanslactose: 'diet.dairyFree',
  sansproduitslaitiers: 'diet.dairyFree',
  sinlactosa: 'diet.dairyFree',
  sinlacteos: 'diet.dairyFree',
  lowcarb: 'diet.lowCarb',
  pauvreenglucides: 'diet.lowCarb',
  bajaencarbohidratos: 'diet.lowCarb',
  pescatarian: 'diet.pescatarian',
  pescetarian: 'diet.pescatarian',
  pescetarien: 'diet.pescatarian',
  pescetariano: 'diet.pescatarian',
  pescetariana: 'diet.pescatarian',
};

// Minuscules, sans accents, sans espaces ni traits d'union (y compris insécables)
const normalizeTag = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Étiquette d'une recette dans la langue de l'app ; une étiquette qui n'est pas un régime connu
// (« mijoté », « rapide »…) est affichée telle quelle
export function dietLabel(t: TFunction, value: string): string {
  const key = DIET_KEYS[normalizeTag(value)];
  return key ? t(key) : value;
}
