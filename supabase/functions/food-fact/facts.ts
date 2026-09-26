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

const LIMITS = { name: 60, description: 320, origin: 220, season: 220, item: 160, minItems: 2, maxItems: 4 };

// Promesses de santé ou conseils médicaux : la fiche est refusée (les trois langues). Liste volontairement
// étroite : « cured ham », « a sweet treat » ou « évite qu'il se dessèche » restent permis.
const HEALTH_CLAIMS = /(gu[ée]ri[rst]?\b|\bsoign(e|er|ent)\b|\brem[èe]des?\b|d[ée]tox|\bcancers?\b|diab[èe]t|\bmaladies?\b|m[ée]dicaments?\b|\bheals?\b|\bhealing\b|\bremed(y|ies)\b|\bdiseases?\b|\bmedicines?\b|\bcurar\b|\benfermedad(es)?\b|\bmedicamentos?\b)/i;

const section = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nom courant de l\'aliment dans cette langue, au singulier' },
    description: { type: 'string', description: 'Description courte (1 à 2 phrases)' },
    origin: { type: 'string', description: 'Origine géographique et historique, en une phrase' },
    season: { type: 'string', description: 'Saison (hémisphère nord) ou « toute l\'année », en une phrase' },
    nutrition: { type: 'array', items: { type: 'string' }, description: '2 à 4 atouts nutritionnels généraux, factuels' },
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
- "nutrition" : atouts nutritionnels généraux et prudents (ex. « Source de fibres », « Riche en potassium », « Apporte de la vitamine C »), sans chiffres précis ni superlatifs.
- "tips" : astuces anti-gaspi concrètes (bien le conserver, utiliser les restes ou les parties souvent jetées, reconnaître quand il est encore bon).
- "season" : pour l'hémisphère nord ; « toute l'année » pour un produit d'épicerie ou transformé.
- Phrases courtes : description 1 à 2 phrases, origine et saison 1 phrase chacune, 2 à 4 éléments par liste.
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
  const origin = text(raw.origin, LIMITS.origin);
  const season = text(raw.season, LIMITS.season);
  if (!name || !description || !origin || !season) return 'texte manquant ou trop long';
  const list = (value: unknown) => Array.isArray(value)
    ? value.map((item) => text(item, LIMITS.item)).filter((item): item is string => item !== null)
    : [];
  const nutrition = list(raw.nutrition).slice(0, LIMITS.maxItems);
  const tips = list(raw.tips).slice(0, LIMITS.maxItems);
  if (nutrition.length < LIMITS.minItems || tips.length < LIMITS.minItems) return 'moins de 2 atouts ou astuces';
  const all = [name, description, origin, season, ...nutrition, ...tips].join(' ');
  const claim = all.match(HEALTH_CLAIMS);
  if (claim) return `promesse de santé (« ${claim[0]} »)`;
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
