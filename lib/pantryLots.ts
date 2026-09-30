import { displayQuantity, formatQuantity, parseQuantity, type Quantity } from './quantity';

// Lots du garde-manger : chaque ligne de la table `ingredients` est un lot. Les lots d'un même aliment (même
// food_key ou même nom normalisé, et même sorte : aliment ou plat) forment une seule ligne à l'écran, avec la
// quantité totale et la date la plus proche. Un produit de marque (code-barres) ne se regroupe qu'avec les lots
// du même code-barres. Ils sont consommés du plus ancien (date la plus proche) au plus
// récent.

export interface Lot {
  id: string;
  name: string;
  quantity: string | null;
  kind: string;
  food_key?: string | null;
  barcode?: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface LotGroup<T extends Lot> {
  // Identifiant stable de la ligne (aliment), même quand ses lots changent
  key: string;
  // Du plus ancien au plus récent
  lots: T[];
  // Lot le plus ancien : nom, sorte, date la plus proche de la ligne
  first: T;
}

// Nom normalisé : minuscules, sans accents ni ponctuation, mots au singulier approximatif (« Tomates
// cerises » → « tomate cerise », « œufs » → « oeuf »)
export function foodIdentity(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, '') : word))
    .join(' ');
}

// Plus ancien d'abord : date la plus proche, sans date à la fin, puis ajouté le plus tôt
export function sortLots<T extends Lot>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    if (a.expires_at !== b.expires_at) {
      if (!a.expires_at) return 1;
      if (!b.expires_at) return -1;
      return a.expires_at < b.expires_at ? -1 : 1;
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

// Regroupe les lots par aliment. L'ordre des lignes suit celui du premier lot de chaque ligne dans `rows`.
export function groupLots<T extends Lot>(rows: T[]): LotGroup<T>[] {
  const parent = rows.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const keys = row.barcode ? [`b:${row.barcode}`] : [`n:${row.kind}:${foodIdentity(row.name)}`];
    if (row.food_key && !row.barcode) keys.push(`k:${row.kind}:${row.food_key}`);
    for (const key of keys) {
      const other = seen.get(key);
      if (other === undefined) seen.set(key, index);
      else parent[find(index)] = find(other);
    }
  });
  const members = new Map<number, T[]>();
  rows.forEach((row, index) => {
    const root = find(index);
    members.set(root, [...(members.get(root) ?? []), row]);
  });
  return [...members.values()].map((groupRows) => {
    const lots = sortLots(groupRows);
    const keyed = lots.find((lot) => lot.food_key);
    return {
      key: lots[0].barcode ? `b:${lots[0].barcode}`
        : keyed ? `k:${keyed.kind}:${keyed.food_key}` : `n:${lots[0].kind}:${foodIdentity(lots[0].name)}`,
      lots,
      first: lots[0],
    };
  });
}

// Quantité de référence d'une ligne : unité du plus ancien lot qui en a une (« 2 » + « 3 tomates » → tomates)
// (pour ce qui se compte, au pluriel de préférence : « 1 paquet » + « 2 paquets » → « 3 paquets »)
function referenceOf(parsed: Quantity[]): Quantity {
  const counted = parsed[0].dimension !== 'mass' && parsed[0].dimension !== 'volume';
  return (counted ? parsed.find((quantity) => quantity.unit !== '' && quantity.value > 1) : undefined)
    ?? parsed.find((quantity) => quantity.unit !== '') ?? parsed[0];
}

// Quantité totale des lots dans une même unité, ou null si elle ne peut pas être calculée (lot sans nombre,
// unités de sortes différentes)
export function lotsStock(lots: Lot[]): Quantity | null {
  const parsed = lots.map((lot) => parseQuantity(lot.quantity, lot.name));
  if (parsed.length === 0 || parsed.some((quantity) => !quantity)) return null;
  const all = parsed as Quantity[];
  if (all.some((quantity) => quantity.dimension !== all[0].dimension)) return null;
  const reference = referenceOf(all);
  const factor = reference.base / reference.value;
  const base = all.reduce((sum, quantity) => sum + quantity.base, 0);
  return { value: Number((base / factor).toFixed(3)), unit: reference.unit, dimension: reference.dimension, base };
}

// Texte de la quantité totale : « 5 tomates », « 1,5 l » ; sinon les quantités des lots (« 2 + 1 paquet »)
export function totalLabel(lots: Lot[], language: string): string {
  if (lots.length === 1) return displayQuantity(lots[0].quantity, language);
  const stock = lotsStock(lots);
  if (stock) return formatQuantity(stock.value, stock.unit, language);
  return lots.map((lot) => displayQuantity(lot.quantity, language)).filter(Boolean).join(' + ');
}

// Quantité d'un lot, avec l'unité de la ligne s'il n'en a pas (« 2 » parmi des tomates → « 2 tomates »)
export function lotLabel(lot: Lot, lots: Lot[], language: string): string {
  const quantity = parseQuantity(lot.quantity, lot.name);
  const stock = lotsStock(lots);
  if (!quantity || quantity.unit !== '' || !stock || stock.unit === '') return displayQuantity(lot.quantity, language);
  return formatQuantity(quantity.value, stock.unit, language);
}

// Quantité utilisée (dans l'unité de lotsStock), prise du plus ancien lot au plus récent : lots finis et lots
// entamés avec ce qu'il en reste (dans leur propre unité)
export function consumeOldestFirst(lots: Lot[], used: number, language: string): { usedUp: string[]; leftovers: { id: string; quantity: string }[] } {
  const stock = lotsStock(lots);
  const usedUp: string[] = [];
  const leftovers: { id: string; quantity: string }[] = [];
  if (!stock || used <= 0) return { usedUp, leftovers };
  let remaining = used * (stock.base / stock.value);
  for (const lot of sortLots(lots)) {
    if (remaining <= 1e-6) break;
    const quantity = parseQuantity(lot.quantity, lot.name) as Quantity;
    if (quantity.base <= remaining + 1e-6) {
      usedUp.push(lot.id);
      remaining -= quantity.base;
    } else {
      const factor = quantity.base / quantity.value;
      leftovers.push({ id: lot.id, quantity: formatQuantity(Number(((quantity.base - remaining) / factor).toFixed(3)), quantity.unit, language) });
      remaining = 0;
    }
  }
  return { usedUp, leftovers };
}

// Aliment à ajouter (scan, saisie manuelle)
export interface NewFood {
  name: string;
  quantity: string;
  kind: string;
  food_key?: string | null;
  barcode?: string | null;
  expires_at: string | null;
}

// Ligne du garde-manger qui contient déjà cet aliment : même code-barres pour un produit de marque ; sinon, parmi
// les aliments sans code-barres, même food_key ou même nom normalisé
export function findExisting<T extends Lot>(groups: LotGroup<T>[], food: NewFood): LotGroup<T> | null {
  if (food.barcode) return groups.find((group) => group.lots.some((lot) => lot.barcode === food.barcode)) ?? null;
  const identity = foodIdentity(food.name);
  return groups.find((group) => group.first.kind === food.kind && !group.first.barcode && group.lots.some((lot) =>
    (food.food_key && lot.food_key === food.food_key) || foodIdentity(lot.name) === identity)) ?? null;
}

// « Ajouter aux existants » : lot qui reçoit la quantité (même date de préférence, sinon le plus récent) et
// son nouveau total, dans son unité ; null si les unités ne se correspondent pas
export function mergeTarget<T extends Lot>(group: LotGroup<T>, food: NewFood, language: string): { lot: T; total: string; sameDate: boolean } | null {
  const added = parseQuantity(food.quantity, food.name);
  if (!added) return null;
  const compatible = group.lots.filter((lot) => parseQuantity(lot.quantity, lot.name)?.dimension === added.dimension);
  if (compatible.length === 0) return null;
  const sameDate = compatible.find((lot) => lot.expires_at === food.expires_at);
  const lot = sameDate ?? compatible[compatible.length - 1];
  const current = parseQuantity(lot.quantity, lot.name) as Quantity;
  const factor = current.base / current.value;
  return { lot, total: formatQuantity(Number(((current.base + added.base) / factor).toFixed(3)), current.unit, language), sameDate: !!sameDate };
}

// Lots d'une ligne qui peuvent être fusionnés : même date et même sorte d'unité (au moins deux)
export function mergeableLots<T extends Lot>(lots: T[]): T[][] {
  const byDate = new Map<string, T[]>();
  for (const lot of lots) {
    const quantity = parseQuantity(lot.quantity, lot.name);
    if (!quantity) continue;
    const key = `${lot.expires_at ?? ''}|${quantity.dimension}`;
    byDate.set(key, [...(byDate.get(key) ?? []), lot]);
  }
  return [...byDate.values()].filter((same) => same.length > 1);
}
