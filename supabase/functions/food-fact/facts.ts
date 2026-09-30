// Fiches aliments : consignes, schémas de sortie et validation des réponses des modèles, sans appel
// réseau (testé par facts.test.ts). Informations générales uniquement, jamais de promesse de santé.

import type { ParseResult } from '../_shared/ai.ts';
import { FOOD_KEY_GUIDE, normalizeAlias, normalizeFoodKey } from '../_shared/foodKey.ts';

export const LANGUAGES = ['fr', 'en', 'es'] as const;
export type FactLanguage = typeof LANGUAGES[number];

export interface FactSection {
  name: string;
  description: string;
  origin: string;
  season: string;
  nutrition: string[];
  tips: string[];
}

export type FactContent = Record<FactLanguage, FactSection>;

export interface GeneratedFact {
  food_key: string;
  content: FactContent;
  aliases: string[];
}

// Origine : quelques mots (« Asie du Sud-Est »), affichée dans une petite carte
export const ORIGIN_MAX = 48;
// Atouts : pastilles courtes, trois mots au plus (« Source de potassium », « Riche en fibres »)
export const NUTRITION_MAX_WORDS = 3;
const wordCount = (value: string) => value.trim().split(/\s+/).length;
export const isShortNutrition = (value: string) => wordCount(value) <= NUTRITION_MAX_WORDS;
const LIMITS = { name: 60, description: 320, origin: ORIGIN_MAX, season: 220, item: 160, minItems: 2, maxItems: 4 };

// Promesses de santé ou conseils médicaux : la fiche est refusée (les trois langues). Liste volontairement
// étroite : « cured ham », « a sweet treat » ou « évite qu'il se dessèche » restent permis.
const HEALTH_CLAIMS = /(gu[ée]ri[rst]?\b|\bsoign(e|er|ent)\b|\brem[èe]des?\b|d[ée]tox|\bcancers?\b|diab[èe]t|\bmaladies?\b|m[ée]dicaments?\b|\bheals?\b|\bhealing\b|\bremed(y|ies)\b|\bdiseases?\b|\bmedicines?\b|\bcurar\b|\benfermedad(es)?\b|\bmedicamentos?\b)/i;

const section = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nom courant de l\'aliment dans cette langue, au singulier' },
    description: { type: 'string', description: 'Description courte (1 à 2 phrases)' },
    origin: { type: 'string', description: 'Origine géographique en quelques mots (2 à 5), sans phrase ni point final (ex. « Asie du Sud-Est », « Amérique centrale », « Bassin méditerranéen »)' },
    season: { type: 'string', description: 'Saison (hémisphère nord) ou « toute l\'année », en une phrase' },
    nutrition: { type: 'array', items: { type: 'string' }, description: '2 à 4 atouts nutritionnels généraux, factuels, en trois mots au plus chacun (ex. « Source de potassium », « Riche en fibres », « Vitamine C »)' },
    tips: { type: 'array', items: { type: 'string' }, description: '2 à 4 astuces anti-gaspi (conservation, restes, parties souvent jetées)' },
  },
  required: ['name', 'description', 'origin', 'season', 'nutrition', 'tips'],
  additionalProperties: false,
};

// Sortie structurée (mode strict de Groq : tous les champs requis, aucun en plus)
export const FACT_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean' },
    food_key: { type: 'string', description: FOOD_KEY_GUIDE },
    variants: { type: 'array', items: { type: 'string' }, description: 'Autres noms courants de cet aliment, dans les trois langues (pluriels, variantes)' },
    fr: section,
    en: section,
    es: section,
  },
  required: ['is_food', 'food_key', 'variants', 'fr', 'en', 'es'],
  additionalProperties: false,
};

export const RESOLVE_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean' },
    food_key: { type: 'string', description: FOOD_KEY_GUIDE },
  },
  required: ['is_food', 'food_key'],
  additionalProperties: false,
};

export function resolvePrompt(name: string): string {
  return `Nom d'un aliment saisi par un utilisateur d'une application anti-gaspi (dans n'importe quelle langue, parfois avec une marque, un état ou une quantité) : « ${name} ».
- "is_food" : true si c'est un aliment ou un ingrédient de cuisine, false sinon (objet, plat composé de plusieurs aliments, texte sans sens).
- "food_key" : ${FOOD_KEY_GUIDE}. Regroupe les variantes : « bananes mûres » → "banana", « tomates cerises bio » → "cherry_tomato", « lait demi-écrémé » → "milk".`;
}

export const FACT_SYSTEM = `Tu rédiges des fiches aliments courtes pour une application anti-gaspi, en français, en anglais et en espagnol (mêmes informations dans les trois langues, chacune rédigée naturellement dans sa langue).
RÈGLES STRICTES :
- Informations générales et factuelles uniquement. Aucune promesse de santé, aucun conseil médical : ne dis jamais qu'un aliment guérit, soigne, prévient ou traite quoi que ce soit, ne cite aucune maladie ni médicament.
- "nutrition" : atouts nutritionnels généraux et prudents, trois mots au plus chacun, sans phrase ni point final (ex. « Source de fibres », « Riche en potassium », « Vitamine C »), sans chiffres précis ni superlatifs.
- "tips" : astuces anti-gaspi concrètes (bien le conserver, utiliser les restes ou les parties souvent jetées, reconnaître quand il est encore bon).
- "season" : pour l'hémisphère nord ; « toute l'année » pour un produit d'épicerie ou transformé.
- "origin" : quelques mots seulement (2 à 5), sans phrase ni point final, ex. « Asie du Sud-Est », « Amérique centrale », « Bassin méditerranéen ».
- Phrases courtes : description 1 à 2 phrases, saison 1 phrase, 2 à 4 éléments par liste.
- Si ce n'est pas un aliment, "is_food" : false et des textes vides.`;

export function factPrompt(name: string, foodKey: string | null): string {
  return `Aliment : « ${name} »${foodKey ? ` (identifiant : ${foodKey})` : ''}.
Rédige sa fiche.${foodKey ? ` "food_key" : "${foodKey}".` : ` "food_key" : ${FOOD_KEY_GUIDE}.`}`;
}

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' && value.trim().length <= max ? value.trim() : null;

function cleanSection(raw: any): FactSection | string {
  if (!raw || typeof raw !== 'object') return 'section absente';
  const name = text(raw.name, LIMITS.name);
  const description = text(raw.description, LIMITS.description);
  const origin = text(typeof raw.origin === 'string' ? raw.origin.trim().replace(/\.$/, '') : raw.origin, LIMITS.origin);
  const season = text(raw.season, LIMITS.season);
  if (!name || !description || !origin || !season) return 'texte manquant ou trop long';
  const list = (value: unknown) => Array.isArray(value)
    ? value.map((item) => text(item, LIMITS.item)).filter((item): item is string => item !== null)
    : [];
  // Atouts de plus de trois mots écartés (pastilles de la fiche)
  const received = list(raw.nutrition);
  const nutrition = received.map((item) => item.replace(/\.$/, '')).filter(isShortNutrition).slice(0, LIMITS.maxItems);
  const tips = list(raw.tips).slice(0, LIMITS.maxItems);
  // Promesse de santé cherchée dans tout ce que le modèle a écrit, atouts écartés compris
  const all = [name, description, origin, season, ...received, ...tips].join(' ');
  const claim = all.match(HEALTH_CLAIMS);
  if (claim) return `promesse de santé (« ${claim[0]} »)`;
  if (nutrition.length < LIMITS.minItems || tips.length < LIMITS.minItems) return 'moins de 2 atouts ou astuces';
  return { name, description, origin, season, nutrition, tips };
}

export type FactParse = ParseResult<GeneratedFact | { not_food: true }>;

// Réponse du modèle → fiche validée, avec les alias (noms normalisés dans les trois langues, variantes,
// et le nom saisi par l'utilisateur)
export function parseFact(textResponse: string, requestedName: string, expectedKey: string | null): FactParse {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  if (raw?.is_food === false) return { ok: true, value: { not_food: true } };
  const food_key = expectedKey ?? normalizeFoodKey(raw?.food_key);
  if (!food_key) return { ok: false, failure: `food_key invalide (${raw?.food_key})`, code: 'invalid_response' };

  const content = {} as FactContent;
  for (const language of LANGUAGES) {
    const cleaned = cleanSection(raw?.[language]);
    if (typeof cleaned === 'string') return { ok: false, failure: `${language} : ${cleaned}`, code: 'invalid_response' };
    content[language] = cleaned;
  }

  const variants = Array.isArray(raw.variants) ? raw.variants.filter((v: unknown): v is string => typeof v === 'string') : [];
  const aliases = [...new Set(
    [requestedName, ...LANGUAGES.map((language) => content[language].name), ...variants]
      .map(normalizeAlias)
      .filter((alias) => alias.length >= 2),
  )].slice(0, 40);

  return { ok: true, value: { food_key, content, aliases } };
}

export function parseResolution(textResponse: string): ParseResult<{ food_key: string | null; is_food: boolean }> {
  try {
    const raw = JSON.parse(textResponse);
    if (raw?.is_food === false) return { ok: true, value: { food_key: null, is_food: false } };
    const food_key = normalizeFoodKey(raw?.food_key);
    if (!food_key) return { ok: false, failure: `food_key invalide (${raw?.food_key})`, code: 'invalid_response' };
    return { ok: true, value: { food_key, is_food: true } };
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
}

// Origines trop longues des fiches existantes : réécrites en quelques mots, sans toucher au reste
export const ORIGIN_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(LANGUAGES.map((language) => [language, { type: 'string', description: 'Origine en quelques mots (2 à 5)' }])),
  required: [...LANGUAGES],
  additionalProperties: false,
};

export function originPrompt(content: FactContent): string {
  const lines = LANGUAGES.map((language) => `- ${language} (${content[language].name}) : « ${content[language].origin} »`).join('\n');
  return `Voici l'origine d'un aliment dans trois langues :
${lines}
Réécris chacune en quelques mots seulement (2 à 5), dans la même langue, sans phrase ni point final : seulement le lieu d'origine (ex. « Asie du Sud-Est », « Southeast Asia », « Sudeste asiático »).`;
}

export function parseOrigins(textResponse: string): ParseResult<Record<FactLanguage, string>> {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  const origins = {} as Record<FactLanguage, string>;
  for (const language of LANGUAGES) {
    const origin = typeof raw?.[language] === 'string' ? raw[language].trim().replace(/\.$/, '') : '';
    if (!origin || origin.length > ORIGIN_MAX) return { ok: false, failure: `${language} : origine absente ou trop longue`, code: 'invalid_response' };
    origins[language] = origin;
  }
  return { ok: true, value: origins };
}

// Atouts des fiches existantes : réécrits en pastilles courtes (trois mots au plus), sans toucher au reste
export const NUTRITION_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(LANGUAGES.map((language) => [language, { type: 'array', items: { type: 'string' }, description: '2 à 4 atouts, trois mots au plus chacun' }])),
  required: [...LANGUAGES],
  additionalProperties: false,
};

export function nutritionPrompt(content: FactContent): string {
  const lines = LANGUAGES.map((language) => `- ${language} (${content[language].name}) : ${content[language].nutrition.map((item) => `« ${item} »`).join(', ')}`).join('\n');
  return `Voici les atouts nutritionnels d'un aliment dans trois langues :
${lines}
Réécris-les en 2 à 4 pastilles courtes par langue, trois mots au plus chacune, sans phrase ni point final, avec une majuscule au début, mêmes informations dans les trois langues (ex. « Source de potassium », « Riche en fibres », « Vitamine C » ; « Source of potassium », « High in fiber », « Vitamin C » ; « Fuente de potasio », « Rico en fibra », « Vitamina C »). Informations générales et prudentes : aucun chiffre, aucun superlatif, aucune promesse de santé.`;
}

export function parseNutrition(textResponse: string): ParseResult<Record<FactLanguage, string[]>> {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  const nutrition = {} as Record<FactLanguage, string[]>;
  for (const language of LANGUAGES) {
    const items = Array.isArray(raw?.[language])
      ? raw[language].filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim().replace(/\.$/, '')).filter((item: string) => item !== '' && isShortNutrition(item))
      : [];
    if (items.length < 2) return { ok: false, failure: `${language} : moins de 2 atouts courts`, code: 'invalid_response' };
    const claim = items.join(' ').match(HEALTH_CLAIMS);
    if (claim) return { ok: false, failure: `${language} : promesse de santé (« ${claim[0]} »)`, code: 'invalid_response' };
    nutrition[language] = items.slice(0, 4).map((item: string) => item.charAt(0).toUpperCase() + item.slice(1));
  }
  return { ok: true, value: nutrition };
}
