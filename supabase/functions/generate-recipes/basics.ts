// « Mes basiques » : ingrédients que l'utilisateur a toujours chez lui (préférences), considérés comme disponibles par
// la génération et jamais comptés comme achats. Identifiants connus (reconnus en français, anglais et espagnol) ou
// noms libres ; sans réglage : sel, poivre, huile, eau.
// Même liste dans l'app (lib/basics.ts) ; lib/basics.test.ts vérifie que les deux restent identiques.

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

// Noms en français pour le prompt (écrit en français)
const PROMPT_LABELS: Record<string, string> = {
  salt: 'sel', pepper: 'poivre', oil: 'huile', water: 'eau', garlic: 'ail', onion: 'oignon', sugar: 'sucre', flour: 'farine',
  butter: 'beurre', vinegar: 'vinaigre', mustard: 'moutarde', stock: 'bouillon (cube)',
  spices: 'épices courantes (cumin, paprika, curry, cannelle, curcuma, thym, laurier…)',
};

export function basicsForPrompt(basics: string[]): string {
  return basics.map((basic) => PROMPT_LABELS[basic] ?? basic).join(', ');
}
