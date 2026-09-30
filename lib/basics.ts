// Basiques de cuisine (sel, poivre, huile, eau) : toujours disponibles, jamais « à acheter » ni ajoutés aux
// courses. Même liste que la fonction generate-recipes (BASICS), pour les recettes enregistrées avant.
const BASICS = ['sel', 'poivre', 'huile', 'eau', 'salt', 'pepper', 'oil', 'water', 'sal', 'pimienta', 'aceite', 'agua'];

// Nom comparable : minuscules, sans accents ni ponctuation, mots au singulier (« huiles » → « huile »)
const matchKey = (name: string) => name
  .toLowerCase()
  .replace(/œ/g, 'oe')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(' ')
  .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
  .join(' ');

// « Huile d'olive », « poivre noir », « sel fin » : basiques ; « selle d'agneau » : non
export function isBasic(name: string): boolean {
  const padded = ` ${matchKey(name)} `;
  return BASICS.some((basic) => padded.includes(` ${basic} `));
}
