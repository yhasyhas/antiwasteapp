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
  // Produit frais de saison (fruits, légumes, poissons, fruits de mer) : la saison n'est affichée que pour eux
  seasonal: boolean;
  // « Est-ce encore bon ? » : signes à vérifier, et quand jeter sans hésiter
  signs: string[];
  discard: string[];
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
// Style télégraphique refusé : liaison manquante (« Source protéines », « Riche antioxydants ») ou deux
// vitamines collées (« Vitamines C K »)
const MISSING_LINK: Record<string, RegExp> = {
  fr: /^(source|riche|pauvre|faible|apport|apporte|contient)\s+(?!(de|d'|d’|du|des|en)\b)/i,
  en: /^(source|rich|high|low)\s+(?!(of|in)\b)/i,
  es: /^(fuente|rico|rica|bajo|baja|aporte|aporta)\s+(?!(de|del|en)\b)/i,
};
export const isShortNutrition = (value: string, language?: string) => wordCount(value) <= NUTRITION_MAX_WORDS
  && !(language && MISSING_LINK[language]?.test(value.trim()))
  && !/\b[A-Z]\d*\s+[A-Z]\d*$/.test(value.trim());
// Saison : quelques mots (« Juillet à octobre », « Toute l'année »), affichée dans une petite carte
export const SEASON_MAX = 32;
const LIMITS = { name: 60, description: 320, origin: ORIGIN_MAX, season: SEASON_MAX, item: 160, minItems: 2, maxItems: 4 };

// Promesses de santé ou conseils médicaux : la fiche est refusée (les trois langues). Liste volontairement
// étroite : « cured ham », « a sweet treat » ou « évite qu'il se dessèche » restent permis.
const HEALTH_CLAIMS = /(gu[ée]ri[rst]?\b|\bsoign(e|er|ent)\b|\brem[èe]des?\b|d[ée]tox|\bcancers?\b|diab[èe]t|\bmaladies?\b|m[ée]dicaments?\b|\bheals?\b|\bhealing\b|\bremed(y|ies)\b|\bdiseases?\b|\bmedicines?\b|\bcurar\b|\benfermedad(es)?\b|\bmedicamentos?\b)/i;

const section = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Nom courant de l\'aliment dans cette langue, au singulier' },
    description: { type: 'string', description: 'Description courte (1 à 2 phrases)' },
    origin: { type: 'string', description: 'Origine géographique en quelques mots (2 à 5), sans phrase ni point final (ex. « Asie du Sud-Est », « Amérique centrale », « Bassin méditerranéen »)' },
    season: { type: 'string', description: 'Saison dans l\'hémisphère nord en quelques mots (2 à 5), sans phrase ni point final (ex. « Juillet à octobre », « Toute l\'année », « Automne et hiver »)' },
    nutrition: { type: 'array', items: { type: 'string' }, description: '2 à 4 atouts nutritionnels généraux, factuels, en trois mots au plus chacun (ex. « Source de potassium », « Riche en fibres », « Vitamine C »)' },
    tips: { type: 'array', items: { type: 'string' }, description: '2 à 4 astuces anti-gaspi (conservation, restes, parties souvent jetées)' },
    signs: { type: 'array', items: { type: 'string' }, description: '2 à 4 signes à vérifier pour savoir s\'il est encore bon (aspect, odeur, texture), phrases courtes' },
    discard: { type: 'array', items: { type: 'string' }, description: '1 à 3 cas où le jeter sans hésiter (moisissure, odeur aigre, emballage bombé…), phrases courtes' },
  },
  required: ['name', 'description', 'origin', 'season', 'nutrition', 'tips', 'signs', 'discard'],
  additionalProperties: false,
};

// Sortie structurée (mode strict de Groq : tous les champs requis, aucun en plus)
export const FACT_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean' },
    food_key: { type: 'string', description: FOOD_KEY_GUIDE },
    seasonal: { type: 'boolean', description: "true pour tout produit frais : fruit, légume (herbes fraîches comprises), poisson, fruit de mer, même trouvé toute l'année ; false pour le reste" },
    variants: { type: 'array', items: { type: 'string' }, description: 'Autres noms courants de cet aliment, dans les trois langues (pluriels, variantes)' },
    fr: section,
    en: section,
    es: section,
  },
  required: ['is_food', 'food_key', 'seasonal', 'variants', 'fr', 'en', 'es'],
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

// « Est-ce encore bon ? » : prudent et général, jamais de promesse ni de conseil médical
const STILL_GOOD_RULES = `- "signs" : 2 à 4 signes simples à vérifier pour savoir si l'aliment est encore bon (aspect, odeur, texture, emballage), phrases courtes à l'impératif, en tutoyant, sans point final (fr : « Vérifie… », « Sens… », « Regarde… », « Touche… » ; en : « Check… », « Smell… » ; es : « Comprueba… », « Huele… »). Un aliment seulement trop mûr, taché, flétri ou ramolli reste bon à cuisiner : dis-le plutôt que d'en faire un signe de fin (ex. « Taches brunes : parfaite pour un gâteau ou un smoothie »).
- "discard" : 1 à 3 signes d'aliment réellement gâté, à jeter sans hésiter : moisissure (sur un aliment mou), odeur aigre, rance ou de pourri, texture visqueuse ou gluante, emballage bombé ou qui fuit. Jamais pour un aliment seulement trop mûr, taché ou flétri. Phrases courtes sans point final, qui commencent par le signe (fr : « Moisissure visible », « Odeur aigre » ; en : « Visible mould » ; es : « Moho visible »). Reste prudent et général : jamais de conseil médical ni de nom de maladie.
- Signes propres à cet aliment, exacts (pas une liste toute faite) : un œuf cru a un jaune coulant et se teste en le cassant dans un bol ou dans l'eau ; une viande crue sent peu, sans odeur sucrée. Ne dis jamais qu'on peut consommer un produit après sa date « à consommer jusqu'au » (viande, poisson, produits laitiers frais).`;

export const FACT_SYSTEM = `Tu rédiges des fiches aliments courtes pour une application anti-gaspi, en français, en anglais et en espagnol (mêmes informations dans les trois langues, chacune rédigée naturellement dans sa langue).
RÈGLES STRICTES :
- Informations générales et factuelles uniquement. Aucune promesse de santé, aucun conseil médical : ne dis jamais qu'un aliment guérit, soigne, prévient ou traite quoi que ce soit, ne cite aucune maladie ni médicament.
- "nutrition" : atouts nutritionnels généraux et prudents, trois mots au plus chacun, sans phrase ni point final (ex. « Source de fibres », « Riche en potassium », « Vitamine C »), sans chiffres précis ni superlatifs. Chaque atout est une expression correcte avec ses liaisons (« Source de protéines », jamais « Source protéines ») ; un seul nutriment par atout (« Vitamine C » et « Vitamine K » plutôt que « Vitamines C K »).
- "tips" : astuces anti-gaspi concrètes (bien le conserver, utiliser les restes ou les parties souvent jetées, reconnaître quand il est encore bon).
- "season" : pour l'hémisphère nord, sans le préciser, en quelques mots (2 à 5), sans phrase ni point final, ex. « Juillet à octobre », « Automne et hiver » ; « Toute l'année » (seul, sans pic ni mois) pour un produit disponible toute l'année, d'épicerie ou transformé.
- "origin" : quelques mots seulement (2 à 5), sans phrase ni point final, ex. « Asie du Sud-Est », « Amérique centrale », « Bassin méditerranéen ».
- "seasonal" : true pour tout produit frais : fruit, légume (herbes fraîches, ail, oignon, pomme de terre compris), poisson, fruit de mer, même trouvé toute l'année ; false pour la viande, les produits laitiers, les œufs, l'épicerie (céréales, légumineuses sèches, fruits secs, noix), les produits transformés.
${STILL_GOOD_RULES}
- Phrases courtes : description 1 à 2 phrases, saison 1 phrase, 2 à 4 éléments par liste.
- Si ce n'est pas un aliment, "is_food" : false et des textes vides.`;

export function factPrompt(name: string, foodKey: string | null): string {
  return `Aliment : « ${name} »${foodKey ? ` (identifiant : ${foodKey})` : ''}.
Rédige sa fiche.${foodKey ? ` "food_key" : "${foodKey}".` : ` "food_key" : ${FOOD_KEY_GUIDE}.`}`;
}

// Signes et cas à jeter : courts, 2 à 4 et 1 à 3
const STILL_GOOD = { item: 140, minSigns: 2, maxSigns: 4, minDiscard: 1, maxDiscard: 3 };

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() !== '' && value.trim().length <= max ? value.trim() : null;

function cleanSection(raw: any, language: FactLanguage): FactSection | string {
  if (!raw || typeof raw !== 'object') return 'section absente';
  const name = text(raw.name, LIMITS.name);
  const description = text(raw.description, LIMITS.description);
  const origin = text(typeof raw.origin === 'string' ? raw.origin.trim().replace(/\.$/, '') : raw.origin, LIMITS.origin);
  const season = text(typeof raw.season === 'string' ? raw.season.trim().replace(/\.$/, '') : raw.season, LIMITS.season);
  if (!name || !description || !origin || !season) return 'texte manquant ou trop long';
  const list = (value: unknown) => Array.isArray(value)
    ? value.map((item) => text(item, LIMITS.item)).filter((item): item is string => item !== null)
    : [];
  // Atouts de plus de trois mots écartés (pastilles de la fiche)
  const received = list(raw.nutrition);
  const nutrition = received.map((item) => item.replace(/\.$/, '')).filter((item) => isShortNutrition(item, language)).slice(0, LIMITS.maxItems);
  const tips = list(raw.tips).slice(0, LIMITS.maxItems);
  const stillGood = cleanStillGood(raw);
  if (typeof stillGood === 'string') return stillGood;
  // Promesse de santé cherchée dans tout ce que le modèle a écrit, atouts écartés compris
  const all = [name, description, origin, season, ...received, ...tips].join(' ');
  const claim = all.match(HEALTH_CLAIMS);
  if (claim) return `promesse de santé (« ${claim[0]} »)`;
  if (nutrition.length < LIMITS.minItems || tips.length < LIMITS.minItems) return 'moins de 2 atouts ou astuces';
  return { name, description, origin, season, nutrition, tips, seasonal: false, ...stillGood };
}

// « Est-ce encore bon ? » d'une langue : signes (2 à 4) et cas à jeter (1 à 3), courts, sans promesse de santé
function cleanStillGood(raw: any): { signs: string[]; discard: string[] } | string {
  const list = (value: unknown, max: number) => Array.isArray(value)
    ? value.map((item) => text(typeof item === 'string' ? item.replace(/\s+/g, ' ') : item, STILL_GOOD.item)).filter((item): item is string => item !== null).slice(0, max)
    : [];
  const signs = list(raw?.signs, STILL_GOOD.maxSigns);
  const discard = list(raw?.discard, STILL_GOOD.maxDiscard);
  if (signs.length < STILL_GOOD.minSigns || discard.length < STILL_GOOD.minDiscard) return 'signes ou cas à jeter manquants';
  const claim = [...signs, ...discard].join(' ').match(HEALTH_CLAIMS);
  if (claim) return `promesse de santé (« ${claim[0]} »)`;
  return { signs, discard };
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
    const cleaned = cleanSection(raw?.[language], language);
    if (typeof cleaned === 'string') return { ok: false, failure: `${language} : ${cleaned}`, code: 'invalid_response' };
    content[language] = { ...cleaned, seasonal: raw?.seasonal === true };
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
Réécris-les en 2 à 4 pastilles courtes par langue, trois mots au plus chacune, sans phrase ni point final, avec une majuscule au début. Chaque pastille est une expression correcte avec ses liaisons (« Source de protéines », « Riche en fer », jamais « Source protéines » ni « Riche fer ») et un seul nutriment (« Vitamine C » et « Vitamine K » en deux pastilles, jamais « Vitamines C K » ni « Fer calcium ») ; garde les atouts les plus utiles si tout ne tient pas. Mêmes informations dans les trois langues (ex. « Source de potassium », « Riche en fibres », « Vitamine C » ; « Source of potassium », « High in fiber », « Vitamin C » ; « Fuente de potasio », « Rico en fibra », « Vitamina C »). Informations générales et prudentes : aucun chiffre, aucun superlatif, aucune promesse de santé.`;
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
        .map((item: string) => item.trim().replace(/\.$/, '')).filter((item: string) => item !== '' && isShortNutrition(item, language))
      : [];
    if (items.length < 2) return { ok: false, failure: `${language} : moins de 2 atouts courts`, code: 'invalid_response' };
    const claim = items.join(' ').match(HEALTH_CLAIMS);
    if (claim) return { ok: false, failure: `${language} : promesse de santé (« ${claim[0]} »)`, code: 'invalid_response' };
    nutrition[language] = items.slice(0, 4).map((item: string) => item.charAt(0).toUpperCase() + item.slice(1));
  }
  return { ok: true, value: nutrition };
}

// Saisons trop longues des fiches existantes : réécrites en quelques mots, sans toucher au reste
export const SEASON_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(LANGUAGES.map((language) => [language, { type: 'string', description: 'Saison en quelques mots (2 à 5)' }])),
  required: [...LANGUAGES],
  additionalProperties: false,
};

export function seasonPrompt(content: FactContent): string {
  const lines = LANGUAGES.map((language) => `- ${language} (${content[language].name}) : « ${content[language].season} »`).join('\n');
  return `Voici la saison d'un aliment dans trois langues :
${lines}
Réécris chacune en quelques mots seulement (2 à 5), dans la même langue, avec une majuscule au début, sans phrase ni point final, pour l'hémisphère nord sans le préciser : seulement les mois ou les saisons (ex. « Juillet à octobre », « July to October », « Julio a octubre » ; « Toute l'année », « All year round », « Todo el año » ; « Automne et hiver »). Une seule période : si l'aliment se trouve toute l'année, écris seulement « Toute l'année », sans ajouter de pic ni de mois. Garde la même information dans les trois langues.`;
}

export function parseSeasons(textResponse: string): ParseResult<Record<FactLanguage, string>> {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  const seasons = {} as Record<FactLanguage, string>;
  for (const language of LANGUAGES) {
    const season = typeof raw?.[language] === 'string' ? raw[language].trim().replace(/\.$/, '') : '';
    if (!season || season.length > SEASON_MAX) return { ok: false, failure: `${language} : saison absente ou trop longue`, code: 'invalid_response' };
    seasons[language] = season.charAt(0).toUpperCase() + season.slice(1);
  }
  return { ok: true, value: seasons };
}

// Fiches existantes (phase 8) : « Est-ce encore bon ? » et produit frais de saison, sans toucher au reste
export const PHASE8_SCHEMA = {
  type: 'object',
  properties: {
    seasonal: { type: 'boolean', description: "true pour tout produit frais : fruit, légume (herbes fraîches comprises), poisson, fruit de mer, même trouvé toute l'année ; false pour le reste" },
    ...Object.fromEntries(LANGUAGES.map((language) => [language, {
      type: 'object',
      properties: {
        signs: { type: 'array', items: { type: 'string' }, description: '2 à 4 signes à vérifier' },
        discard: { type: 'array', items: { type: 'string' }, description: '1 à 3 cas où le jeter sans hésiter' },
      },
      required: ['signs', 'discard'],
      additionalProperties: false,
    }])),
  },
  required: ['seasonal', ...LANGUAGES],
  additionalProperties: false,
};

export function phase8Prompt(content: FactContent): string {
  const lines = LANGUAGES.map((language) => `- ${language} : ${content[language].name} — ${content[language].description}`).join('\n');
  return `Aliment d'une fiche anti-gaspi, dans trois langues :
${lines}
Pour cet aliment, donne :
- "seasonal" : true pour tout produit frais : fruit, légume (herbes fraîches, ail, oignon, pomme de terre compris), poisson, fruit de mer, même trouvé toute l'année ; false pour la viande, les produits laitiers, les œufs, l'épicerie (céréales, légumineuses sèches, fruits secs, noix), les produits transformés.
${STILL_GOOD_RULES}
Mêmes informations dans les trois langues, chacune rédigée naturellement dans sa langue (fr, en, es), avec une majuscule au début de chaque phrase.`;
}

export function parsePhase8(textResponse: string): ParseResult<{ seasonal: boolean } & Record<FactLanguage, { signs: string[]; discard: string[] }>> {
  let raw: any;
  try {
    raw = JSON.parse(textResponse);
  } catch {
    return { ok: false, failure: `JSON invalide (${textResponse.slice(0, 120)})`, code: 'invalid_response' };
  }
  if (typeof raw?.seasonal !== 'boolean') return { ok: false, failure: 'seasonal absent', code: 'invalid_response' };
  const value = { seasonal: raw.seasonal } as { seasonal: boolean } & Record<FactLanguage, { signs: string[]; discard: string[] }>;
  for (const language of LANGUAGES) {
    const cleaned = cleanStillGood(raw?.[language]);
    if (typeof cleaned === 'string') return { ok: false, failure: `${language} : ${cleaned}`, code: 'invalid_response' };
    const upper = (item: string) => item.charAt(0).toUpperCase() + item.slice(1);
    value[language] = { signs: cleaned.signs.map(upper), discard: cleaned.discard.map(upper) };
  }
  return { ok: true, value };
}
