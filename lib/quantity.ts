// Quantités en texte libre (« 4 œufs », « 500 g », « 1/2 », « 20 cl ») : lecture, et quantité restante
// d'un aliment après une recette (« J'ai cuisiné ça ») quand les unités correspondent.

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

// Même sorte d'unité : le reste peut être calculé
export const sameDimension = (a: Quantity, b: Quantity) => a.dimension === b.dimension;

// Pas des boutons + et − : 1 pour des pièces, sinon selon l'ordre de grandeur (300 g → 50, 0,8 kg → 0,1)
export function stepFor(quantity: Pick<Quantity, 'value' | 'dimension'>): number {
  if (quantity.dimension === 'count') return quantity.value < 1 ? 0.25 : 1;
  const magnitude = 10 ** Math.floor(Math.log10(quantity.value));
  return magnitude >= 100 ? magnitude / 2 : magnitude;
}

// Quantité restante dans l'unité du garde-manger (4 œufs − 2 → 2 ; 1 kg − 200 g → 0,8), ou null si les
// unités ne correspondent pas ou s'il ne reste rien
export function remainingAfter(pantry: Quantity, used: Quantity): number | null {
  if (!sameDimension(pantry, used)) return null;
  const factor = pantry.base / pantry.value;
  const left = (pantry.base - used.base) / factor;
  return left > 0.001 ? Number(left.toFixed(2)) : null;
}

export function roundTo(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return Number((rounded > 0 ? rounded : step).toFixed(3));
}

// Nombre → texte (virgule décimale en français et en espagnol), suivi de l'unité du garde-manger
export function formatQuantity(value: number, unit: string, language: string): string {
  const number = Number(value.toFixed(2)).toString();
  const text = language === 'en' ? number : number.replace('.', ',');
  // « 1 œuf », « 1 tranche » : unité au singulier (sauf les unités de mesure : « 1 l », « 1 kg »)
  const word = value <= 1 && /^\p{L}{3,}s$/u.test(unit) && !(normalize(unit) in MASS) && !(normalize(unit) in VOLUME) ? unit.slice(0, -1) : unit;
  return word ? `${text} ${word}` : text;
}
