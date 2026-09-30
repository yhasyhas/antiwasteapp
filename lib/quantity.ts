// Quantités en texte libre (« 4 œufs », « 500 g », « 1/2 », « 20 cl ») : lecture, et quantité utilisée par une
// recette dans l'unité du garde-manger (« J'ai cuisiné ça ») quand les unités correspondent.

type Dimension = 'mass' | 'volume' | 'count' | `word:${string}`;

export interface Quantity {
  value: number;
  // Unité telle qu'écrite (gardée pour afficher le reste : « 2 œufs », « 300 g »)
  unit: string;
  dimension: Dimension;
  // Valeur en grammes, millilitres ou unités
  base: number;
}

const MASS: Record<string, number> = {
  mg: 0.001, g: 1, gr: 1, gramme: 1, gram: 1, gramo: 1, kg: 1000, kilo: 1000, kilogramme: 1000, kilogram: 1000, kilogramo: 1000,
};
const VOLUME: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, litre: 1000, liter: 1000, litro: 1000,
};
// Unités qui comptent des pièces (« 4 », « 4 pièces », « 2 x »)
const COUNT = new Set(['', 'x', 'piece', 'pc', 'pcs', 'unite', 'unit', 'unidad', 'unidade', 'pieza']);

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

const normalize = (value: string) => value
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/œ/g, 'oe')
  .replace(/\.$/, '')
  .trim();

// Singulier approximatif (« pièces » → « piece », « œufs » → « oeuf », « tomates » → « tomate »)
const singular = (word: string) => word.replace(/[sx]$/, '');

function readNumber(text: string): { value: number; rest: string } | null {
  const match = text.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])\s*(.*)$/);
  if (!match) return null;
  const raw = match[1].replace(/\s+/g, ' ').trim();
  let value: number;
  if (raw.includes('/')) {
    const parts = raw.split(' ');
    const [top, bottom] = parts[parts.length - 1].split('/').map(Number);
    value = (parts.length > 1 ? Number(parts[0]) : 0) + (bottom ? top / bottom : NaN);
  } else {
    const fraction = raw.match(/[½¼¾⅓⅔]$/)?.[0];
    const whole = raw.replace(/[½¼¾⅓⅔]$/, '').trim();
    value = (whole ? Number(whole.replace(',', '.')) : 0) + (fraction ? FRACTIONS[fraction] : 0);
  }
  return Number.isFinite(value) && value > 0 ? { value, rest: match[2] } : null;
}

// Texte → quantité, ou null sans nombre (« un peu », « 1 paquet » reste lisible : unité « paquet »).
// itemName : un nom d'aliment en guise d'unité (« 4 œufs » pour des œufs) compte des pièces.
export function parseQuantity(text: string | null | undefined, itemName = ''): Quantity | null {
  if (!text) return null;
  const number = readNumber(text);
  if (!number) return null;
  const unit = number.rest.trim();
  const key = normalize(unit);
  const word = singular(key.split(/\s+/)[0] ?? '');
  let dimension: Dimension;
  let factor = 1;
  if (key in MASS || word in MASS) {
    dimension = 'mass';
    factor = MASS[key] ?? MASS[word];
  } else if (key in VOLUME || word in VOLUME) {
    dimension = 'volume';
    factor = VOLUME[key] ?? VOLUME[word];
  } else if (COUNT.has(key) || COUNT.has(word) || (word.length > 1 && singular(normalize(itemName)).includes(word))) {
    dimension = 'count';
  } else {
    dimension = `word:${key.split(/\s+/).map(singular).join(' ')}`;
  }
  return { value: number.value, unit, dimension, base: number.value * factor };
}

// Même sorte d'unité : la quantité utilisée peut être comptée dans l'unité du garde-manger
export const sameDimension = (a: Quantity, b: Quantity) => a.dimension === b.dimension;

// Quantité de la recette dans l'unité du garde-manger, limitée au stock (2 œufs sur 4 → 2 ; 250 g sur 1 kg →
// 0,25), ou null si les unités ne correspondent pas
export function usedFromRecipe(stock: Quantity | null, needed: Quantity | null): number | null {
  if (!stock || !needed || !sameDimension(stock, needed)) return null;
  const factor = stock.base / stock.value;
  return Math.min(Number((needed.base / factor).toFixed(2)), stock.value);
}

// Pas des boutons + et − : 1 pour ce qui se compte (pièces, portions, tranches), sinon selon l'ordre de
// grandeur du stock (500 g → 50, 1 kg → 0,1)
export function stepOf(stock: Quantity): number {
  if (stock.dimension !== 'mass' && stock.dimension !== 'volume') return stock.value < 1 ? 0.25 : 1;
  const magnitude = 10 ** Math.floor(Math.log10(stock.value / 4));
  return magnitude >= 100 ? magnitude / 2 : magnitude;
}

const nearly = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// Unité la plus naturelle quand la conversion est simple : 0,25 kg → 250 g, 1500 g → 1,5 kg, 0,5 l → 50 cl,
// 0,125 l → 125 ml, 1000 ml → 1 l. Les autres unités restent telles quelles.
export function naturalQuantity(value: number, unit: string): { value: number; unit: string } {
  const key = normalize(unit);
  const mass = MASS[key];
  const volume = VOLUME[key];
  if (mass !== undefined) {
    const grams = value * mass;
    if (mass === 1000 && value < 1 && nearly(grams, Math.round(grams))) return { value: Math.round(grams), unit: 'g' };
    if (mass === 1 && grams >= 1000 && nearly(grams % 100, 0)) return { value: grams / 1000, unit: 'kg' };
  } else if (volume !== undefined) {
    const millilitres = value * volume;
    if (millilitres >= 1000 && volume < 1000 && nearly(millilitres % 100, 0)) return { value: millilitres / 1000, unit: 'l' };
    if (volume === 1000 && value < 1) {
      if (nearly(millilitres % 10, 0)) return { value: Math.round(millilitres / 10), unit: 'cl' };
      if (nearly(millilitres, Math.round(millilitres))) return { value: Math.round(millilitres), unit: 'ml' };
    }
  }
  return { value, unit };
}

// Quantité écrite (garde-manger, courses, Open Food Facts) → texte dans le format de la langue et l'unité la
// plus naturelle (« 0.25 kg » → « 250 g », « 1.5 l » → « 1,5 l » en français). Seul un nombre simple suivi
// d'un mot est réécrit ; « 1/2 », « 2 x 125 g », « un peu » restent tels quels.
export function displayQuantity(text: string | null | undefined, language: string): string {
  if (!text) return '';
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(\p{L}*)\.?$/u);
  if (!match) return text;
  const value = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return text;
  const unit = match[2];
  const measure = normalize(unit) in MASS || normalize(unit) in VOLUME;
  // Mot quelconque sans décimale : texte d'origine (pas d'accord imposé à « 3 tomate »)
  if (!measure && !/[.,]/.test(match[1])) return text;
  return formatQuantity(value, unit, language);
}

// Nombre → texte (virgule décimale en français et en espagnol), suivi de l'unité du garde-manger, convertie
// dans l'unité la plus naturelle quand c'est simple (0,25 kg → 250 g)
export function formatQuantity(rawValue: number, rawUnit: string, language: string): string {
  const { value, unit } = naturalQuantity(rawValue, rawUnit);
  const number = Number(value.toFixed(2)).toString();
  const text = language === 'en' ? number : number.replace('.', ',');
  // « 1 œuf », « 1 tranche » : unité au singulier (sauf les unités de mesure : « 1 l », « 1 kg ») ; au-delà de 1,
  // un mot simple prend un « s » en français et en espagnol (« 3 paquets », « 2 paquetes »)
  const measure = normalize(unit) in MASS || normalize(unit) in VOLUME;
  const word = value <= 1 && /^\p{L}{3,}s$/u.test(unit) && !measure ? unit.slice(0, -1)
    : value > 1 && (language === 'fr' || language === 'es') && /^\p{L}{3,}$/u.test(unit) && !/[sxz]$/.test(unit) && !measure ? `${unit}s`
      : unit;
  return word ? `${text} ${word}` : text;
}
