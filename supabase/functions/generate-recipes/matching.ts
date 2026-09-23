// Comparaison des noms d'ingrédients, mot par mot, insensible à la casse, aux accents et au pluriel :
// "Banane" correspond à "bananes mûres", mais "lait" ne correspond pas à "laitue".

// Petits mots ignorés (fr / en / es)
const STOP_WORDS = new Set([
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'a', 'au', 'aux', 'en', 'et',
  'of', 'the', 'and',
  'del', 'el', 'los', 'las', 'y', 'con', 'al',
]);

// Réduit un mot à une forme commune au singulier et au pluriel :
// "bananes" / "banane" -> "banan", "poireaux" / "poireau" -> "poireau", "limones" / "limón" -> "limon"
function stem(word: string): string {
  let w = word;
  if (w.length > 3 && (w.endsWith('s') || w.endsWith('x'))) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export function ingredientTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP_WORDS.has(w))
    .map(stem);
}

// Vrai si tous les mots de l'un des deux noms se retrouvent dans l'autre
export function ingredientsMatch(a: string, b: string): boolean {
  const ta = ingredientTokens(a);
  const tb = ingredientTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  return ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t));
}

export function sameIngredient(a: string, b: string): boolean {
  return ingredientTokens(a).join(' ') === ingredientTokens(b).join(' ');
}
