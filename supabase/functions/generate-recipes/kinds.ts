// Type de plat et technique déclarés par le modèle pour chaque recette (variety.ts : variété au sein d'une
// génération). Texte libre dans le schéma (une liste fermée fait refuser la réponse par Groq dès que le modèle écrit
// une autre valeur), ramené ici à la liste ; une valeur inconnue devient « other », jamais comparé.

export const DISH_TYPES = ['soup', 'stew', 'stir_fry', 'oven_dish', 'grill', 'fried', 'salad', 'rice_or_grain', 'pasta_or_noodles', 'dough', 'eggs', 'sandwich', 'porridge', 'dessert', 'other'] as const;
export const TECHNIQUES = ['simmer', 'saute', 'oven', 'grill', 'deep_fry', 'pan_fry', 'steam', 'boil', 'no_cook', 'other'] as const;
export type DishType = typeof DISH_TYPES[number];
export type Technique = typeof TECHNIQUES[number];

export const DISH_TYPE_HINT = `Type de plat, un seul parmi : ${DISH_TYPES.join(', ')} (stew : ragoût, curry, plat mijoté en sauce ; oven_dish : gratin, rôti, plat au four ; dough : galette, crêpe, pain, tarte, beignet de pâte)`;
export const TECHNIQUE_HINT = `Technique de cuisson principale, une seule parmi : ${TECHNIQUES.join(', ')}`;

export function cleanKind<T extends string>(value: unknown, allowed: readonly T[]): T {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ((allowed as readonly string[]).includes(key) ? key : 'other') as T;
}
