import { Coffee, Sun, Moon, Cookie } from 'lucide-react-native';
import type { Cuisine } from './types';

// Types de repas avec icônes et labels
export const mealTypes = [
  { value: 'breakfast', label: 'Petit-déjeuner', icon: Coffee, color: '#f59e0b' },
  { value: 'lunch', label: 'Déjeuner', icon: Sun, color: '#10b981' },
  { value: 'dinner', label: 'Dîner', icon: Moon, color: '#6366f1' },
  { value: 'snack', label: 'Goûter', icon: Cookie, color: '#ec4899' },
];

// Langues disponibles
export const languages = [
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
];

export const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Low-Carb',
];

export const difficultyOptions = ['easy', 'medium', 'expert'];

// Libellés dans LanguageContext
export const cuisineOptions: Array<{ value: Cuisine; labelKey: string }> = [
  { value: 'any', labelKey: 'cuisineAny' },
  { value: 'african', labelKey: 'cuisineAfrican' },
  { value: 'maghreb', labelKey: 'cuisineMaghreb' },
  { value: 'asian', labelKey: 'cuisineAsian' },
  { value: 'latin', labelKey: 'cuisineLatin' },
  { value: 'mediterranean', labelKey: 'cuisineMediterranean' },
  { value: 'french', labelKey: 'cuisineFrench' },
];

export const getMealTypeLabel = (value: string) => {
  return mealTypes.find(m => m.value === value)?.label || value;
};

export const getMealTypeIcon = (value: string) => {
  return mealTypes.find(m => m.value === value)?.icon || Sun;
};
