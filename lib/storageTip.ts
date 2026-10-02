import { defaultLocation, type StorageLocation } from './storage';

// Conseil de conservation affiché sur la carte d'un aliment. Le conseil enregistré au scan est écrit dans la langue
// et pour l'emplacement de ce moment-là : il n'est gardé que s'il est dans la langue de l'app et cohérent avec
// l'emplacement actuel (pas de « bac à légumes » pour de la viande, ni de frigo pour un lot au congélateur) ;
// sinon, un conseil type selon l'emplacement et la catégorie (traductions : storage.tip*).

export type TipKey =
  | 'storage.tipFreezer'
  | 'storage.tipFridge_meat' | 'storage.tipFridge_fish' | 'storage.tipFridge_dairy' | 'storage.tipFridge_produce'
  | 'storage.tipFridge_egg' | 'storage.tipFridge_dish' | 'storage.tipFridge_other'
  | 'storage.tipPantry_produce' | 'storage.tipPantry_bread' | 'storage.tipPantry_other';

export type StorageTip = { text: string } | { key: TipKey };

const normalize = (text: string) => ` ${text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim()} `;
const has = (text: string, words: string[]) => words.some((word) => text.includes(` ${word}`));

const FRIDGE = ['frigo', 'refrigerateur', 'fridge', 'refrigerat', 'nevera', 'refrigerador', 'frigorifico', 'heladera'];
const FREEZER = ['congel', 'surgel', 'freez'];
const PANTRY = ['placard', 'temperature ambiante', 'air libre', 'endroit frais', 'endroit sec', 'au sec', 'room temperature', 'pantry', 'cupboard',
  'cool dry', 'cool dark', 'dry place', 'despensa', 'alacena', 'armario', 'temperatura ambiente', 'lugar fresco', 'lugar seco', 'boite a pain', 'bread box', 'panera'];
const CRISPER = ['bac a legume', 'crisper', 'vegetable drawer', 'cajon de verdura', 'cajon de las verdura'];

// Langue d'un conseil court : mots les plus fréquents de chaque langue ; null si on ne sait pas
const LANGUAGE_WORDS: Record<string, string[]> = {
  fr: ['dans', 'au', 'aux', 'avec', 'ou', 'sur', 'bien', 'le', 'les', 'du', 'des', 'frigo', 'refrigerateur', 'congelateur', 'placard', 'sec', 'boite', 'hermetique', 'abri', 'emballage', 'ferme', 'consommer', 'jusqu'],
  en: ['in', 'the', 'and', 'with', 'or', 'keep', 'store', 'fridge', 'refrigerator', 'refrigerated', 'freezer', 'dry', 'place', 'container', 'airtight', 'sealed', 'away', 'from', 'room', 'cool', 'wrapped', 'bag'],
  es: ['el', 'los', 'las', 'en', 'con', 'y', 'o', 'del', 'nevera', 'refrigerador', 'congelador', 'lugar', 'seco', 'fresco', 'recipiente', 'hermetico', 'guardar', 'guarda', 'mantener', 'bolsa', 'cerrado'],
};
export function tipLanguage(text: string): string | null {
  const words = normalize(text).trim().split(' ');
  const scores = Object.entries(LANGUAGE_WORDS).map(([language, list]) => [language, words.filter((word) => list.includes(word)).length] as const)
    .sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 && scores[0][1] > scores[1][1] ? scores[0][0] : null;
}

type TipFamily = 'meat' | 'fish' | 'dairy' | 'produce' | 'egg' | 'bread' | 'dish' | 'other';
function familyOf(category: string | null | undefined, kind: string | null | undefined): TipFamily {
  if (kind === 'dish') return 'dish';
  if (category === 'meat' || category === 'fish' || category === 'dairy' || category === 'egg') return category;
  if (category === 'fruit' || category === 'vegetable') return 'produce';
  if (category === 'bakery') return 'bread';
  return 'other';
}

// Conseil enregistré cohérent avec l'emplacement actuel et la catégorie
export function tipFitsLocation(tip: string, location: StorageLocation, family: TipFamily): boolean {
  const text = normalize(tip);
  if (has(text, CRISPER) && family !== 'produce') return false;
  if (location === 'freezer') return has(text, FREEZER);
  if (location === 'fridge') return has(text, FRIDGE) || !(has(text, PANTRY) || has(text, FREEZER));
  return has(text, PANTRY) || !(has(text, FRIDGE) || has(text, FREEZER));
}

export function storageTip(
  lot: { storage_tip?: string | null; location?: string | null; category?: string | null; kind?: string | null; food_key?: string | null },
  language: string,
): StorageTip {
  const location = (lot.location as StorageLocation | null) ?? defaultLocation(lot.category, lot.kind, lot.food_key);
  const family = familyOf(lot.category, lot.kind);
  const stored = lot.storage_tip?.trim();
  if (stored && tipLanguage(stored) === language && tipFitsLocation(stored, location, family)) return { text: stored };
  if (location === 'freezer') return { key: 'storage.tipFreezer' };
  if (location === 'fridge') {
    return { key: family === 'bread' ? 'storage.tipFridge_other' : `storage.tipFridge_${family}` };
  }
  return { key: family === 'produce' || family === 'bread' ? `storage.tipPantry_${family}` : 'storage.tipPantry_other' };
}
