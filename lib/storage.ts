import { addDays, daysUntil, todayISO, type ExpiryStatus } from './expiry';

// Rangement des lots : emplacement (frigo, congélateur, placard), type de date (« à consommer jusqu'au »,
// stricte, ou « de préférence avant », indicative), congélation et ouverture. Mêmes règles par défaut que la
// base (default_location, default_date_kind : migration 20261001100000_phase8_pantry.sql).

export type StorageLocation = 'fridge' | 'freezer' | 'pantry';
export type DateKind = 'use_by' | 'best_before';
export const LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry'];

// Fruits rouges et raisin : au frigo ; ce qui se garde hors du frigo (tomates, pommes de terre, oignons,
// bananes, agrumes, pain…) : au placard
const FRIDGE_KEYS = new Set(['strawberry', 'raspberry', 'blueberry', 'blackberry', 'cherry', 'grape', 'fig']);
const PANTRY_KEYS = new Set([
  'tomato', 'cherry_tomato', 'potato', 'sweet_potato', 'onion', 'red_onion', 'shallot', 'garlic',
  'banana', 'plantain', 'avocado', 'cassava', 'yam', 'pumpkin', 'squash', 'butternut', 'ginger',
  'lemon', 'lime', 'orange', 'mandarin', 'grapefruit', 'apple', 'pear', 'mango', 'pineapple',
  'melon', 'watermelon', 'bread', 'sandwich_bread', 'baguette',
]);

export function defaultLocation(category: string | null | undefined, kind: string | null | undefined, foodKey?: string | null): StorageLocation {
  if (kind === 'dish') return 'fridge';
  if (category === 'frozen') return 'freezer';
  if (foodKey && FRIDGE_KEYS.has(foodKey)) return 'fridge';
  if (foodKey && PANTRY_KEYS.has(foodKey)) return 'pantry';
  if (category === 'dairy' || category === 'meat' || category === 'fish' || category === 'vegetable') return 'fridge';
  if (category && ['fruit', 'egg', 'grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack'].includes(category)) return 'pantry';
  return 'fridge';
}

// Indicative pour l'épicerie, les œufs et les surgelés ; stricte pour le frais et les restes
export function defaultDateKind(category: string | null | undefined, kind: string | null | undefined): DateKind {
  if (kind === 'dish') return 'use_by';
  if (category && ['grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack', 'egg', 'frozen'].includes(category)) return 'best_before';
  return 'use_by';
}

// Grandes familles, pour les durées et les conseils de congélation
export type FreezeFamily = 'meat' | 'fish' | 'dish' | 'bread' | 'produce' | 'dairy' | 'other';
export function freezeFamily(category: string | null | undefined, kind: string | null | undefined): FreezeFamily {
  if (kind === 'dish') return 'dish';
  if (category === 'meat') return 'meat';
  if (category === 'fish') return 'fish';
  if (category === 'bakery') return 'bread';
  if (category === 'fruit' || category === 'vegetable') return 'produce';
  if (category === 'dairy' || category === 'egg') return 'dairy';
  return 'other';
}

// Conservation au congélateur (en jours, qualité ; à -18 °C la sécurité ne diminue pas)
const FREEZER_DAYS: Record<FreezeFamily, number> = { meat: 120, fish: 90, dish: 90, bread: 90, produce: 240, dairy: 90, other: 90 };
// Après décongélation, au frigo : viande, poisson et restes 1 jour, le reste 2 jours
const THAW_DAYS: Record<FreezeFamily, number> = { meat: 1, fish: 1, dish: 1, bread: 2, produce: 2, dairy: 2, other: 2 };

export const frozenExpiry = (category: string | null | undefined, kind: string | null | undefined) =>
  addDays(todayISO(), FREEZER_DAYS[freezeFamily(category, kind)]);
export const thawedExpiry = (category: string | null | undefined, kind: string | null | undefined) =>
  addDays(todayISO(), THAW_DAYS[freezeFamily(category, kind)]);

// Conservation après ouverture (en jours) : produits frais quelques jours, épicerie bien plus
export function openedDays(category: string | null | undefined, kind: string | null | undefined): number {
  if (kind === 'dish') return 2;
  switch (category) {
    case 'meat':
    case 'fish':
      return 2;
    case 'dairy':
    case 'vegetable':
    case 'fruit':
    case 'beverage':
      return 3;
    case 'bakery':
      return 4;
    case 'snack':
      return 10;
    case 'condiment':
      return 30;
    case 'grain':
    case 'legume':
    case 'spice':
      return 90;
    default:
      return 5;
  }
}

// « Je l'ai ouvert » : la date la plus proche entre la date d'origine et la conservation après ouverture
export function openedExpiry(expiresAt: string | null | undefined, category: string | null | undefined, kind: string | null | undefined): string {
  const afterOpening = addDays(todayISO(), openedDays(category, kind));
  return expiresAt && expiresAt < afterOpening ? expiresAt : afterOpening;
}

export interface StoredLot {
  expires_at: string | null;
  date_kind?: string | null;
  location?: string | null;
}

// État d'un lot : congelé (jamais urgent), date indicative dépassée (jamais rouge ni gaspillé), sinon l'état
// de sa date ; une date indicative n'est jamais « bientôt » ni « expirée »
export type LotUrgency = ExpiryStatus | 'frozen' | 'indicative_passed';
export function lotUrgency(lot: StoredLot): LotUrgency {
  if (lot.location === 'freezer') return 'frozen';
  if (!lot.expires_at) return 'none';
  const days = daysUntil(lot.expires_at);
  if (lot.date_kind === 'best_before') return days < 0 ? 'indicative_passed' : 'ok';
  if (days < 0) return 'expired';
  if (days <= 2) return 'soon';
  return 'ok';
}

// « À utiliser vite » : date stricte passée ou proche, hors congélateur
export const isUrgentLot = (lot: StoredLot) => {
  const urgency = lotUrgency(lot);
  return urgency === 'expired' || urgency === 'soon';
};

// Jours restants transmis au modèle pour la génération : seulement pour une date stricte hors congélateur
// (sinon l'aliment n'est ni urgent ni « date dépassée »)
export const daysLeftForRecipes = (lot: StoredLot) =>
  lot.expires_at && lot.location !== 'freezer' && lot.date_kind !== 'best_before' ? daysUntil(lot.expires_at) : null;
