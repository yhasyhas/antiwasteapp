// Ticket de caisse (mode receipt d'analyze-image) : règles du serveur appliquées après le modèle, sur le texte exact de
// chaque ligne (« receipt_line ») et le nom proposé. Sans appel réseau, testé par receipt.test.ts.
//   - Articles non alimentaires écartés, même quand leur nom évoque un aliment ou un animal : jouets, peluches,
//     produits ménagers, hygiène, objets (« SQUISH SEA TURTLE » n'est pas une tortue à mettre au frigo).
//   - Aliment invraisemblable en supermarché (tortue, perroquet, dinosaure…) écarté.
//   - Produit déjà cuit (poulet rôti, rotisserie, traiteur, plat préparé) : plat cuisiné, date courte (2 ou 3 jours,
//     cleanIngredients) et conseil de le réchauffer à cœur.
//   - Ligne incertaine : confiance gardée ; l'app la décoche par défaut dans la confirmation (UNCERTAIN_CONFIDENCE).

import type { ParseResult } from '../_shared/ai.ts';
import { cleanIngredients, type DetectedIngredient, RESPONSE_SCHEMA, validateResponse, type ValidationResult } from './ingredients.ts';

// En dessous, la ligne est proposée décochée dans la confirmation (hooks/useScan.ts reprend cette valeur)
export const UNCERTAIN_CONFIDENCE = 0.75;

// Schéma du mode ticket : celui des photos, plus le texte exact de la ligne lue
const itemSchema = (RESPONSE_SCHEMA.properties.ingredients as { items: { properties: Record<string, unknown>; required: string[] } }).items;
export const RECEIPT_SCHEMA = {
  ...RESPONSE_SCHEMA,
  properties: {
    ingredients: {
      type: 'array',
      items: {
        ...itemSchema,
        properties: {
          ...itemSchema.properties,
          receipt_line: { type: 'string', description: 'Texte exact de la ligne du ticket, tel qu’il est imprimé (libellé et codes)' },
        },
        required: [...itemSchema.required, 'receipt_line'],
      },
    },
  },
};

// Texte comparable : minuscules, sans accents, mots séparés par une espace
export const normalize = (text: unknown) => ` ${String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const hasWord = (text: string, words: string[]) => words.some((word) => text.includes(` ${word} `));

// Indices d'un article non alimentaire (fr, en, es), dans la ligne du ticket ou le nom proposé
const NON_FOOD_WORDS = [
  // Jouets, peluches, objets
  'squish', 'squishy', 'squishmallow', 'squishmallows', 'squawk', 'squawking', 'squeaky', 'toy', 'toys', 'plush', 'plushie', 'peluche', 'peluches',
  'jouet', 'jouets', 'juguete', 'juguetes', 'figurine', 'figure', 'doll', 'poupee', 'muneca', 'lego', 'puzzle', 'ballon', 'balloon', 'globo',
  'sticker', 'stickers', 'autocollant', 'pegatina', 'crayon', 'crayons', 'feutre', 'marker', 'notebook', 'cahier', 'cuaderno', 'jeu', 'game', 'juego',
  'keychain', 'porte cles', 'llavero', 'mug', 'tasse', 'taza', 'bougie', 'candle', 'vela', 'carte cadeau', 'gift card', 'tarjeta regalo',
  // Entretien, hygiène, maison
  'lessive', 'detergent', 'detergente', 'adoucissant', 'softener', 'suavizante', 'eponge', 'eponges', 'sponge', 'sponges', 'esponja', 'javel', 'bleach', 'lejia',
  'nettoyant', 'cleaner', 'limpiador', 'liquide vaisselle', 'dish soap', 'lavavajillas', 'savon', 'soap', 'jabon', 'shampooing', 'shampoo', 'champu',
  'gel douche', 'shower gel', 'gel de ducha', 'dentifrice', 'toothpaste', 'pasta de dientes', 'deodorant', 'desodorante', 'rasoir', 'razor', 'cuchilla',
  'papier toilette', 'toilet paper', 'papel higienico', 'essuie tout', 'paper towel', 'papel de cocina', 'mouchoirs', 'tissues', 'panuelos', 'couches', 'diapers', 'panales',
  'sac', 'sacs', 'bag', 'bags', 'bolsa', 'bolsas', 'cabas', 'piles', 'batteries', 'pilas', 'ampoule', 'light bulb', 'bombilla', 'litiere', 'cat litter', 'arena para gatos',
  'aluminium foil', 'papier alu', 'film etirable', 'cling film', 'sacs poubelle', 'trash bags', 'bolsas de basura',
];

// Animaux ou « aliments » qu'aucun supermarché ne vend comme nourriture : jamais un aliment proposé
const IMPLAUSIBLE_WORDS = [
  'tortue', 'turtle', 'tortuga', 'perroquet', 'parrot', 'loro', 'dinosaure', 'dinosaur', 'dinosaurio', 'licorne', 'unicorn', 'unicornio',
  'dauphin', 'dolphin', 'delfin', 'baleine', 'whale', 'ballena', 'panda', 'tigre', 'tiger', 'lion', 'leon', 'elephant', 'elefante', 'girafe', 'giraffe', 'jirafa',
  'singe', 'monkey', 'mono', 'hibou', 'owl', 'buho', 'chouette', 'pingouin', 'manchot', 'penguin', 'pinguino', 'ours', 'bear', 'oso', 'chat', 'cat', 'gato',
  'chien', 'dog', 'perro', 'hamster', 'requin', 'shark', 'tiburon', 'koala', 'renard', 'fox', 'zorro', 'loup', 'wolf', 'lobo',
];

// Produit déjà cuit (rôti, rotisserie, traiteur, plat préparé)
const COOKED_WORDS = [
  'roti', 'rotie', 'rotis', 'rotisserie', 'roast', 'roasted', 'asado', 'asada', 'grille', 'grillee', 'grilled', 'a la plancha',
  'traiteur', 'deli', 'plat cuisine', 'plat prepare', 'plats cuisines', 'prepared meal', 'ready meal', 'plato preparado', 'platos preparados', 'precocinado',
  'cuit', 'cuite', 'cooked', 'cocido', 'cocida', 'lasagne', 'lasagnes', 'lasagna', 'quiche', 'taboule', 'tabbouleh', 'paella', 'hachis parmentier',
  'samoussa', 'samosa', 'nems', 'sushi', 'sushis', 'tortilla espanola', 'salade composee',
];
// Mots qui ne désignent pas un plat même avec « roast », « grillé » ou « cuit » (café torréfié, noisettes grillées, jambon
// cuit : charcuterie à manger froide)
const NOT_COOKED_DISH = ['jambon', 'ham', 'jamon', 'saucisson', 'roast beef', 'rosbif', 'cafe', 'coffee', 'noisette', 'noisettes', 'hazelnut', 'hazelnuts', 'avellana', 'cacahuete', 'cacahuetes', 'peanut', 'peanuts', 'amande', 'amandes', 'almond', 'almonds', 'pain', 'bread', 'graines', 'seeds', 'semillas', 'sesame'];
// Catégories qui ne sont jamais un plat cuisiné (surgelés : plat à cuire ; épices, boissons…)
const NEVER_DISH_CATEGORIES = ['beverage', 'spice', 'condiment', 'snack', 'frozen', 'bakery'];

const REHEAT_TIP: Record<string, string> = {
  fr: 'Au frigo, bien fermé ; réchauffer à cœur avant de manger',
  en: 'In the fridge, closed; reheat until piping hot before eating',
  es: 'En la nevera, bien cerrado; recalentar a fondo antes de comer',
};

const FROZEN_WORDS = ['surg', 'surgele', 'surgeles', 'surgelee', 'surgelees', 'congele', 'congelee', 'frozen', 'congelado', 'congelada', 'congelados'];
export const isFrozen = (item: { receipt_line?: unknown; name?: unknown; category?: unknown }) =>
  item.category === 'frozen' || hasWord(`${normalize(item.receipt_line)} ${normalize(item.name)}`, FROZEN_WORDS);

export type ReceiptDecision = 'food' | 'non_food' | 'implausible' | 'cooked';

// Décision pour une ligne du ticket (texte de la ligne, nom proposé, catégorie)
export function receiptDecision(item: { receipt_line?: unknown; name?: unknown; category?: unknown }): ReceiptDecision {
  const line = normalize(item.receipt_line);
  const name = normalize(item.name);
  const both = `${line} ${name}`;
  if (hasWord(both, NON_FOOD_WORDS)) return 'non_food';
  // « dragon » seul (jouet) ; le fruit du dragon reste un aliment
  if (hasWord(name, IMPLAUSIBLE_WORDS) || (hasWord(name, ['dragon']) && !hasWord(name, ['fruit', 'fruta']))) return 'implausible';
  if (!NEVER_DISH_CATEGORIES.includes(String(item.category)) && hasWord(both, COOKED_WORDS) && !hasWord(both, NOT_COOKED_DISH)) return 'cooked';
  return 'food';
}

// Règles appliquées aux lignes valides avant le nettoyage commun (cleanIngredients) : écartées, ou plat cuisiné
export function applyReceiptRules(items: any[], language: string): { kept: any[]; dropped: { line: string; reason: ReceiptDecision }[] } {
  const kept: any[] = [];
  const dropped: { line: string; reason: ReceiptDecision }[] = [];
  for (const item of items) {
    const decision = receiptDecision(item);
    if (decision === 'non_food' || decision === 'implausible') {
      dropped.push({ line: String(item.receipt_line || item.name || '').slice(0, 80), reason: decision });
      continue;
    }
    // Surgelé (« SURG », « frozen », catégorie frozen) : produit à cuire qui se garde longtemps, jamais un plat cuisiné,
    // même si le modèle l'a classé comme plat (pizza surgelée)
    if (isFrozen(item)) {
      kept.push({ ...item, kind: 'ingredient' });
      continue;
    }
    if (decision === 'cooked') {
      kept.push({ ...item, kind: 'dish', shelf_life_days: Math.min(Number(item.shelf_life_days) || 3, 3), storage_tip: REHEAT_TIP[language] ?? REHEAT_TIP.en });
      continue;
    }
    kept.push(item);
  }
  return { kept, dropped };
}

// Lecture de la réponse en mode ticket : même validation que les photos, règles du ticket, puis nettoyage commun
export function parseReceipt(language: string) {
  return (text: string): ParseResult<{ ingredients: DetectedIngredient[]; invalid: string[]; dropped: { line: string; reason: ReceiptDecision }[] }> => {
    let validation: ValidationResult;
    try {
      validation = validateResponse(JSON.parse(text));
    } catch {
      return { ok: false, failure: `JSON invalide (${text.slice(0, 120)})`, code: 'invalid_response' };
    }
    if (!validation.ok) return { ok: false, failure: `réponse non conforme au schéma, ${validation.reason}`, code: 'invalid_response' };
    const { kept, dropped } = applyReceiptRules(validation.valid, language);
    return { ok: true, value: { ingredients: cleanIngredients(kept), invalid: validation.invalid, dropped } };
  };
}
