// Identifiant standard d'un aliment (food_key) : anglais, minuscules, singulier, mots séparés par « _ »
// (banana, cherry_tomato, olive_oil). Il regroupe les variantes d'un même aliment (« bananes mûres » →
// banana) et sert de clé aux fiches aliments (table food_facts). Même format que la contrainte SQL.

export const FOOD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,47}$/;

export const FOOD_KEY_GUIDE =
  'identifiant standard de l\'aliment en anglais, minuscules, au singulier, mots séparés par "_", sans marque, variété courante ni état (ex. "banana" pour « bananes mûres », "cherry_tomato", "olive_oil", "chicken_breast", "plantain") ; chaîne vide pour un plat cuisiné';

// Valeur proposée par un modèle → identifiant valide, ou null
export function normalizeFoodKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s\-']+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return FOOD_KEY_PATTERN.test(key) ? key : null;
}

// Nom d'aliment normalisé pour chercher une fiche par ses alias (food_facts.aliases) : minuscules, sans
// accents ni ponctuation, espaces simples (« Bananes  mûres ! » → « bananes mures »)
export function normalizeAlias(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}
