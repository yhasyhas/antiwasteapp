// « Mes basiques » : ingrédients que l'utilisateur a toujours chez lui (Préférences), comptés comme disponibles
// (« Faisable maintenant ») et jamais « à acheter » ni ajoutés aux courses. Même logique que la fonction
// generate-recipes (supabase/functions/generate-recipes/basics.ts) ; lib/basics.test.ts vérifie qu'elles restent identiques.
// Aucune dépendance : testé avec Deno.

export const DEFAULT_BASICS = ['salt', 'pepper', 'oil', 'water'];

// Mots reconnus pour chaque identifiant (singulier, sans accents : la comparaison les normalise)
export const BASIC_WORDS: Record<string, string[]> = {
  salt: ['sel', 'salt', 'sal'],
  pepper: ['poivre', 'pepper', 'pimienta'],
  oil: ['huile', 'oil', 'aceite'],
  water: ['eau', 'water', 'agua'],
  garlic: ['ail', 'garlic', 'ajo'],
  onion: ['oignon', 'onion', 'cebolla'],
  sugar: ['sucre', 'sugar', 'azucar'],
  flour: ['farine', 'flour', 'harina'],
  butter: ['beurre', 'butter', 'mantequilla'],
  vinegar: ['vinaigre', 'vinegar', 'vinagre'],
  mustard: ['moutarde', 'mustard', 'mostaza'],
  stock: ['bouillon', 'stock', 'broth', 'caldo'],
  // Épices courantes (sèches) ; les herbes fraîches n'en font pas partie
  spices: [
    'epice', 'spice', 'especia', 'cumin', 'comino', 'paprika', 'pimenton', 'curry', 'curcuma', 'turmeric', 'cannelle', 'cinnamon',
    'canela', 'muscade', 'noix de muscade', 'nutmeg', 'nuez moscada', 'gingembre en poudre', 'ground ginger', 'jengibre en polvo',
    'piment en poudre', 'chili powder', 'chile en polvo', 'piment de cayenne', 'cayenne', 'piment d espelette', 'herbes de provence',
    'thym', 'thyme', 'tomillo', 'laurier', 'feuille de laurier', 'bay leaf', 'bay leave', 'laurel', 'origan', 'oregano',
    'coriandre moulue', 'ground coriander', 'cilantro molido', 'ras el hanout', 'garam masala', 'clou de girofle', 'clove',
    'clavo de olor', 'cardamome', 'cardamom', 'cardamomo', 'quatre epices', 'cinq epices', 'five spice', 'graine de fenouil',
  ],
};

// Jamais des basiques, même si un mot de la liste y figure : poivrons, beurre de cacahuète
const NOT_BASIC = [
  'bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'orange pepper', 'sweet pepper',
  'peanut butter', 'beurre de cacahuete', 'beurre d arachide', 'mantequilla de mani', 'mantequilla de cacahuete',
];

export const MAX_BASICS = 30;
export const MAX_BASIC_LENGTH = 40;

// Nom comparable : minuscules, sans accents ni ponctuation, mots au singulier (« huiles » → « huile »)
export function matchKey(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(' ');
}

// Liste reçue (préférences, requête) : identifiants ou noms libres, nettoyés, sans doublon ; absente : la liste par défaut
export function cleanBasics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BASICS];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const value = item.trim().slice(0, MAX_BASIC_LENGTH);
    const key = matchKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= MAX_BASICS) break;
  }
  return result;
}

// Mots (normalisés) de la liste : ceux des identifiants connus, le nom lui-même pour un nom libre
function wordsOf(basics: string[]): string[] {
  return basics.flatMap((basic) => BASIC_WORDS[basic] ?? [basic]).map(matchKey).filter((key) => key !== '');
}

// « Huile d'olive », « poivre noir », « cumin moulu » (avec les épices) : basiques ; « selle d'agneau », « poivron
// rouge », « red bell pepper » : non
export function isBasicFor(name: string, basics: string[]): boolean {
  const padded = ` ${matchKey(name)} `;
  if (NOT_BASIC.some((phrase) => padded.includes(` ${matchKey(phrase)} `))) return false;
  return wordsOf(basics).some((word) => padded.includes(` ${word} `));
}

// Suggestions de l'écran « Préférences », dans cet ordre (libellés : basics.item.<id>)
export const SUGGESTED_BASICS = ['salt', 'pepper', 'oil', 'water', 'garlic', 'onion', 'sugar', 'flour', 'butter', 'spices', 'vinegar', 'mustard', 'stock'];

export const isKnownBasic = (basic: string) => basic in BASIC_WORDS;

// Liste de l'utilisateur connecté (chargée avec ses préférences) ; null : jamais réglée, liste par défaut
let userBasics: string[] = [...DEFAULT_BASICS];

export function setUserBasics(basics: string[] | null | undefined): void {
  userBasics = basics ? cleanBasics(basics) : [...DEFAULT_BASICS];
}

export const getUserBasics = (): string[] => userBasics;

export function isBasic(name: string): boolean {
  return isBasicFor(name, userBasics);
}
