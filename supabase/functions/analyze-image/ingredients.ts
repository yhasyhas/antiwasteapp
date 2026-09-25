// Lecture et validation de la réponse des modèles pour analyze-image, sans appel réseau
// (testée par ingredients.test.ts).

import type { ParseResult } from '../_shared/ai.ts';

// En dessous de ce niveau de confiance, l'ingrédient n'est pas proposé à l'utilisateur
export const MIN_CONFIDENCE = 0.5;
export const MAX_INGREDIENTS = 20;
export const CATEGORIES = [
  'fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume',
  'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other',
];

// ingredient : aliment brut ou produit acheté ; dish : plat cuisiné ou reste de repas
export const KINDS = ['ingredient', 'dish'];
export type FoodKind = 'ingredient' | 'dish';
export const MAX_STORAGE_TIP_LENGTH = 160;

// Durée de conservation estimée (jours, à partir d'aujourd'hui) : bornes et valeurs par défaut.
// Un plat cuisiné se garde 2 à 3 jours au frigo, quoi qu'en dise le modèle.
export const MIN_SHELF_LIFE_DAYS = 1;
export const MAX_SHELF_LIFE_DAYS = 730;
export const DISH_SHELF_LIFE_DAYS = { min: 2, max: 3 };
// Utilisées si le modèle ne donne pas de durée exploitable
export const DEFAULT_SHELF_LIFE_DAYS: Record<string, number> = {
  fruit: 5, vegetable: 5, meat: 2, fish: 1, dairy: 7, egg: 21, grain: 180, legume: 180,
  bakery: 3, condiment: 90, spice: 365, beverage: 30, snack: 60, frozen: 90, other: 7,
};

export function cleanShelfLife(value: unknown, category: string, kind: FoodKind): number {
  const estimate = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
  if (kind === 'dish') {
    const days = estimate ?? DISH_SHELF_LIFE_DAYS.max;
    return Math.min(DISH_SHELF_LIFE_DAYS.max, Math.max(DISH_SHELF_LIFE_DAYS.min, days));
  }
  if (estimate === null || estimate < MIN_SHELF_LIFE_DAYS) return DEFAULT_SHELF_LIFE_DAYS[category] ?? DEFAULT_SHELF_LIFE_DAYS.other;
  return Math.min(MAX_SHELF_LIFE_DAYS, estimate);
}

// Sortie structurée, identique pour Gemini et Groq (additionalProperties: false est exigé par le
// mode strict de Groq). La réponse est de toute façon revalidée par cleanIngredients.
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom courant et générique de l\'aliment, dans la langue demandée' },
          quantity: { type: 'string', description: 'Quantité estimée avec son unité (ex. "3", "500 g", "1 l"), ou chaîne vide si impossible à estimer' },
          category: { type: 'string', enum: CATEGORIES },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          kind: { type: 'string', enum: KINDS },
          storage_tip: { type: 'string', description: 'Conseil de conservation court, dans la langue demandée' },
          shelf_life_days: { type: 'integer', description: "Nombre de jours avant que l'aliment ne soit plus bon, à partir d'aujourd'hui" },
        },
        required: ['name', 'quantity', 'category', 'confidence', 'kind', 'storage_tip', 'shelf_life_days'],
        additionalProperties: false,
      },
    },
  },
  required: ['ingredients'],
  additionalProperties: false,
};

export interface DetectedIngredient {
  name: string;
  quantity: string;
  category: string;
  confidence: number;
  kind: FoodKind;
  storage_tip: string;
  shelf_life_days: number;
}

// Raison pour laquelle un aliment ne respecte pas RESPONSE_SCHEMA, ou null s'il est utilisable.
// kind, storage_tip et shelf_life_days ne sont pas bloquants : valeurs par défaut dans cleanIngredients.
export function ingredientViolation(item: any): string | null {
  if (!item || typeof item !== 'object') return 'pas un objet';
  if (typeof item.name !== 'string' || item.name.trim() === '') return '"name" invalide';
  if (typeof item.quantity !== 'string') return '"quantity" invalide';
  if (!CATEGORIES.includes(item.category)) return `catégorie inconnue "${item.category}"`;
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) return '"confidence" invalide';
  return null;
}

export type ValidationResult =
  | { ok: true; valid: unknown[]; invalid: string[] }
  | { ok: false; reason: string };

// Écarte les aliments mal formés et garde les autres. La réponse n'est un échec que si elle n'a pas
// de liste d'aliments, ou si elle en proposait et qu'aucun n'est valide. Une liste vide dès le
// départ reste valide (aucun aliment sur la photo).
export function validateResponse(parsed: any): ValidationResult {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ingredients)) {
    return { ok: false, reason: 'champ "ingredients" absent ou pas un tableau' };
  }

  const valid: unknown[] = [];
  const invalid: string[] = [];
  parsed.ingredients.forEach((item: unknown, index: number) => {
    const violation = ingredientViolation(item);
    if (violation) invalid.push(`n°${index} ${violation}`);
    else valid.push(item);
  });

  if (valid.length === 0 && invalid.length > 0) {
    return { ok: false, reason: `aucun aliment valide sur ${invalid.length} (${invalid.slice(0, 3).join(' ; ')})` };
  }
  return { ok: true, valid, invalid };
}

export function cleanIngredients(raw: unknown): DetectedIngredient[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();

  return list
    .filter((item: any) => item && typeof item.name === 'string' && item.name.trim() !== '')
    .map((item: any) => {
      const category = CATEGORIES.includes(item.category) ? item.category : 'other';
      const kind = (KINDS.includes(item.kind) ? item.kind : 'ingredient') as FoodKind;
      return {
        name: item.name.trim(),
        quantity: typeof item.quantity === 'string' ? item.quantity.trim() : '',
        category,
        confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0,
        kind,
        storage_tip: typeof item.storage_tip === 'string' ? item.storage_tip.trim().slice(0, MAX_STORAGE_TIP_LENGTH) : '',
        shelf_life_days: cleanShelfLife(item.shelf_life_days, category, kind),
      };
    })
    .filter((item) => item.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_INGREDIENTS);
}

// Lit et valide la réponse d'un fournisseur : liste d'aliments nettoyée, ou raison de l'échec
export function parseIngredients(text: string): ParseResult<{ ingredients: DetectedIngredient[]; invalid: string[] }> {
  let validation: ValidationResult;
  try {
    validation = validateResponse(JSON.parse(text));
  } catch {
    return { ok: false, failure: `JSON invalide (${text.slice(0, 120)})`, code: 'invalid_response' };
  }
  if (!validation.ok) {
    return { ok: false, failure: `réponse non conforme au schéma, ${validation.reason}`, code: 'invalid_response' };
  }
  return { ok: true, value: { ingredients: cleanIngredients(validation.valid), invalid: validation.invalid } };
}
