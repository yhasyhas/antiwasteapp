import { Coffee, Sun, Moon, Cookie } from 'lucide-react-native';
import type { TFunction } from 'i18next';

// Types de repas avec icônes et libellés traduits
export const mealTypes = [
  { value: 'breakfast', labelKey: 'meal.breakfast', icon: Coffee },
  { value: 'lunch', labelKey: 'meal.lunch', icon: Sun },
  { value: 'dinner', labelKey: 'meal.dinner', icon: Moon },
  { value: 'snack', labelKey: 'meal.snack', icon: Cookie },
] as const;

// Langues des recettes (noms dans leur propre langue)
export const languages = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

// value : code envoyé à generate-recipes (et enregistré dans les préférences) ; labelKey : libellé affiché
export const dietaryOptions = [
  { value: 'Vegetarian', labelKey: 'diet.vegetarian' },
  { value: 'Vegan', labelKey: 'diet.vegan' },
  { value: 'Gluten-Free', labelKey: 'diet.glutenFree' },
  { value: 'Dairy-Free', labelKey: 'diet.dairyFree' },
  { value: 'Low-Carb', labelKey: 'diet.lowCarb' },
] as const;

export const difficultyOptions = ['easy', 'medium', 'expert'] as const;


export const getMealTypeLabel = (t: TFunction, value: string) => {
  const meal = mealTypes.find(m => m.value === value);
  return meal ? t(meal.labelKey) : value;
};

export const getMealTypeIcon = (value: string) => {
  return mealTypes.find(m => m.value === value)?.icon || Sun;
};
