import { Coffee, Sun, Moon, Cookie } from 'lucide-react-native';
import type { TFunction } from 'i18next';
import type { Cuisine } from './types';

// Types de repas avec icônes, couleurs et libellés traduits
export const mealTypes = [
  { value: 'breakfast', labelKey: 'meal.breakfast', icon: Coffee, color: '#f59e0b' },
  { value: 'lunch', labelKey: 'meal.lunch', icon: Sun, color: '#10b981' },
  { value: 'dinner', labelKey: 'meal.dinner', icon: Moon, color: '#6366f1' },
  { value: 'snack', labelKey: 'meal.snack', icon: Cookie, color: '#ec4899' },
] as const;

// Langues des recettes (noms dans leur propre langue)
export const languages = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
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

export const cuisineOptions = [
  { value: 'any', labelKey: 'cuisine.any' },
  { value: 'african', labelKey: 'cuisine.african' },
  { value: 'maghreb', labelKey: 'cuisine.maghreb' },
  { value: 'asian', labelKey: 'cuisine.asian' },
  { value: 'latin', labelKey: 'cuisine.latin' },
  { value: 'mediterranean', labelKey: 'cuisine.mediterranean' },
  { value: 'french', labelKey: 'cuisine.french' },
] as const satisfies ReadonlyArray<{ value: Cuisine; labelKey: string }>;

export const getMealTypeLabel = (t: TFunction, value: string) => {
  const meal = mealTypes.find(m => m.value === value);
  return meal ? t(meal.labelKey) : value;
};

export const getMealTypeIcon = (value: string) => {
  return mealTypes.find(m => m.value === value)?.icon || Sun;
};
