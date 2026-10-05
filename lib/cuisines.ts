// Découpage des cuisines (phase 9b, docs/cuisines-proposition.md) : une famille, puis, si on veut, une région ;
// France en choix direct ; « Autre cuisine… » en texte libre court. Mêmes identifiants que le serveur
// (supabase/functions/generate-recipes/cuisines.ts). Les anciennes valeurs (« african »…) restent valides.

import type { TFunction } from 'i18next';

export const FAMILIES = [
  { id: 'africa', regions: ['afrique-ouest', 'afrique-centrale', 'afrique-est', 'afrique-australe', 'ocean-indien', 'maghreb'] },
  { id: 'asia', regions: ['asie-est', 'asie-sud-est', 'asie-sud'] },
  { id: 'americas', regions: ['mexique-amerique-centrale', 'caraibes', 'amerique-sud'] },
  { id: 'mediterranean', regions: ['europe-sud', 'levant-turquie'] },
] as const;

export type FamilyId = typeof FAMILIES[number]['id'];
export const OTHER_CUISINE = 'other';
export const OTHER_MAX_LENGTH = 40;

// Valeurs enregistrées avant le découpage → nouvel identifiant
const LEGACY: Record<string, string> = {
  african: 'africa',
  maghreb: 'maghreb',
  asian: 'asia',
  latin: 'americas',
  mediterranean: 'mediterranean',
  french: 'france',
};

const REGIONS: string[] = FAMILIES.flatMap((family) => [...family.regions]);
const KNOWN = new Set<string>(['any', 'france', OTHER_CUISINE, ...FAMILIES.map((family) => family.id), ...REGIONS]);

// Identifiant actuel d'une valeur enregistrée (préférence, recette) ; inconnue : « Peu importe »
export function cuisineId(value: string | null | undefined): string {
  if (!value) return 'any';
  const id = LEGACY[value] ?? value;
  return KNOWN.has(id) ? id : 'any';
}

// Famille d'un choix (la famille elle-même ou l'une de ses régions), null pour Peu importe, France, Autre
export function familyOf(id: string): FamilyId | null {
  return FAMILIES.find((family) => family.id === id || (family.regions as readonly string[]).includes(id))?.id ?? null;
}

// « Autre cuisine… » : lettres, espaces, traits d'union et apostrophes, 40 caractères au plus (le serveur nettoie aussi)
export function cleanOtherCuisine(value: string): string {
  return value.replace(/[^\p{L}\s'’-]/gu, '').replace(/\s+/g, ' ').slice(0, OTHER_MAX_LENGTH);
}

// Libellé d'un choix : « Toute l'Afrique », « Afrique de l'Ouest », « France », texte libre de « Autre cuisine… »
export function cuisineLabel(t: TFunction, value: string | null | undefined, other?: string | null): string {
  const id = cuisineId(value);
  if (id === OTHER_CUISINE) return other?.trim() || t('cuisine.other');
  if (value && id === 'any' && value !== 'any') return value;
  return t(`cuisine.choice.${id}` as never);
}

// Clé de filtre d'une cuisine enregistrée avec une recette (ancienne valeur ramenée à l'actuelle, texte libre gardé)
export function cuisineKey(value: string): string {
  const id = cuisineId(value);
  return id === 'any' && value !== 'any' ? value : id;
}

// Valeur enregistrée avec une recette : identifiant, ou le texte de « Autre cuisine… »
export function recipeCuisine(value: string, other?: string | null): string {
  return value === OTHER_CUISINE ? other?.trim() || OTHER_CUISINE : value;
}
