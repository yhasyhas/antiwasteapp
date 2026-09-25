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
