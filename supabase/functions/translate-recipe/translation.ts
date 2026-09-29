// Traduction d'une recette (« Traduire en … ») : texte source, consignes, schéma de sortie et validation,
// sans appel réseau (testé par translation.test.ts). Les quantités, les liens vers le garde-manger et les
// régimes (codes traduits par l'app) ne passent pas par le modèle.

import type { ParseResult } from '../_shared/ai.ts';

export const LANGUAGES = { fr: 'français', en: 'anglais', es: 'espagnol' } as const;
export type TranslationLanguage = keyof typeof LANGUAGES;

export const isLanguage = (value: unknown): value is TranslationLanguage =>
  typeof value === 'string' && value in LANGUAGES;

// Textes traduits d'une recette (même ordre et même nombre d'éléments que l'original)
export interface RecipeText {
  title: string;
  description: string;
  suggestion: string;
  ingredients_used: { name: string; unit: string }[];
  ingredients_from_list: string[];
  missing_ingredients: string[];
  instructions: string[];
  tips: string[];
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

// Ligne de la table recipes → texte à traduire (anciennes recettes comprises : étapes en objets, ingrédients
// en texte)
export function sourceOf(row: any): RecipeText {
  return {
    title: String(row?.title ?? ''),
    description: String(row?.description ?? ''),
    suggestion: typeof row?.suggestion === 'string' ? row.suggestion : '',
    ingredients_used: (Array.isArray(row?.ingredients_used) ? row.ingredients_used : [])
      .map((item: any) => typeof item === 'string' ? { name: item, unit: '' } : { name: String(item?.name ?? ''), unit: String(item?.unit ?? '') })
      .filter((item: { name: string }) => item.name !== ''),
    ingredients_from_list: strings(row?.ingredients_from_list),
    missing_ingredients: strings(row?.missing_ingredients),
    instructions: (Array.isArray(row?.instructions) ? row.instructions : [])
      .map((step: any) => (typeof step === 'string' ? step : String(step?.text ?? '')))
      .filter((step: string) => step !== ''),
    tips: strings(row?.tips),
  };
}

const list = { type: 'array', items: { type: 'string' } };

// Sortie structurée (mode strict de Groq : tous les champs requis, aucun en plus)
export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    suggestion: { type: 'string' },
    ingredients_used: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, unit: { type: 'string' } },
        required: ['name', 'unit'],
        additionalProperties: false,
      },
    },
    ingredients_from_list: list,
    missing_ingredients: list,
    instructions: list,
    tips: list,
  },
  required: ['title', 'description', 'suggestion', 'ingredients_used', 'ingredients_from_list', 'missing_ingredients', 'instructions', 'tips'],
  additionalProperties: false,
};

export const TRANSLATION_SYSTEM = `Tu traduis des recettes de cuisine pour une application anti-gaspi.
RÈGLES STRICTES :
- Traduis tous les textes dans la langue demandée, naturellement, comme une recette écrite dans cette langue.
- Garde exactement la même structure : mêmes champs, même nombre d'éléments dans chaque liste, même ordre.
- Noms d'ingrédients : nom courant dans la langue demandée (même nom partout où l'ingrédient revient).
- Unités ("unit") : unité courante dans la langue demandée (« cuillère à soupe » → « tablespoon ») ; chaîne vide si l'original est vide. Ne convertis pas les quantités.
- Champ vide dans l'original : chaîne vide.`;

export function translationPrompt(source: RecipeText, language: TranslationLanguage): string {
  return `Traduis cette recette en ${LANGUAGES[language]} :
${JSON.stringify(source)}`;
}

const LIMIT = 2000;
const clean = (value: unknown, required: boolean): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > LIMIT || (required && text === '')) return null;
  return text;
};

// Réponse du modèle → traduction validée (même structure que l'original)
export function parseTranslation(textResponse: string, source: RecipeText): ParseResult<RecipeText> {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  const fail = (failure: string): ParseResult<RecipeText> => ({ ok: false, failure, code: 'invalid_response' });

  const title = clean(raw?.title, true);
  const description = clean(raw?.description, source.description !== '');
  const suggestion = clean(raw?.suggestion, source.suggestion !== '');
  if (title === null || description === null || suggestion === null) return fail('titre, description ou suggestion manquant');

  const sameList = (key: 'ingredients_from_list' | 'missing_ingredients' | 'instructions' | 'tips'): string[] | null => {
    const items = Array.isArray(raw?.[key]) ? raw[key].map((item: unknown) => clean(item, true)) : [];
    return items.length === source[key].length && items.every((item: string | null) => item !== null) ? items : null;
  };
  const lists = {
    ingredients_from_list: sameList('ingredients_from_list'),
    missing_ingredients: sameList('missing_ingredients'),
    instructions: sameList('instructions'),
    tips: sameList('tips'),
  };
  for (const [key, value] of Object.entries(lists)) {
    if (value === null) return fail(`${key} : pas le même nombre d'éléments que l'original`);
  }

  const used = Array.isArray(raw?.ingredients_used) ? raw.ingredients_used : [];
  if (used.length !== source.ingredients_used.length) return fail('ingredients_used : pas le même nombre d\'éléments');
  const ingredients_used = used.map((item: any, index: number) => ({
    name: clean(item?.name, true),
    unit: clean(item?.unit, false) ?? '',
  }));
  if (ingredients_used.some((item: { name: string | null }) => item.name === null)) return fail('ingredients_used : nom manquant');
  // Unité vide dans l'original : reste vide
  ingredients_used.forEach((item: { unit: string }, index: number) => {
    if (source.ingredients_used[index].unit === '') item.unit = '';
  });

  return {
    ok: true,
    value: {
      title,
      description,
      suggestion,
      ingredients_used,
      ingredients_from_list: lists.ingredients_from_list!,
      missing_ingredients: lists.missing_ingredients!,
      instructions: lists.instructions!,
      tips: lists.tips!,
    },
  };
}
