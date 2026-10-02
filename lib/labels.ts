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

// Étiquettes de régime vérifiées par le serveur (« diet:vegan », « diet:gluten-free »…), traduites ; les étiquettes
// libres des anciennes recettes (« high-protein », « gluten-free » non vérifié) ne sont jamais affichées
const VERIFIED_DIET_KEYS = {
  vegan: 'diet.vegan',
  vegetarian: 'diet.vegetarian',
  'gluten-free': 'diet.glutenFree',
  'dairy-free': 'diet.dairyFree',
} as const;
export function verifiedDietLabels(t: TFunction, tags: string[]): string[] {
  return tags
    .filter((tag) => tag.startsWith('diet:'))
    .map((tag) => VERIFIED_DIET_KEYS[tag.slice('diet:'.length) as keyof typeof VERIFIED_DIET_KEYS])
    .filter((key) => key !== undefined)
    .map((key) => t(key));
}
