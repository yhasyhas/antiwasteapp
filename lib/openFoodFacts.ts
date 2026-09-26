// Recherche d'un produit par code-barres dans Open Food Facts (base libre, sans clé). Comme ils le
// demandent, chaque requête s'identifie par un User-Agent « NomApp/version (contact) » ; le contact est
// l'adresse du dépôt, pas une adresse e-mail. Sur le web, le navigateur ignore ce User-Agent.

const API_URL = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'AntiGaspiRecettes/1.0 (https://github.com/yhasyhas/antiwasteapp)';
const TIMEOUT_MS = 8000;
// Nom court, lisible dans le garde-manger et dans les notifications
const MAX_NAME_LENGTH = 40;

export interface OffProduct {
  name: string;
  quantity: string;
  category: string;
}

// Catégories Open Food Facts → catégories de l'app (mêmes codes que analyze-image). Les plus précises
// d'abord : un pain de mie est d'abord « bakery », même s'il est aussi rangé dans les surgelés.
const CATEGORY_RULES: Array<[string, string[]]> = [
  ['dairy', ['en:dairies', 'en:cheeses', 'en:yogurts', 'en:milks', 'en:butters', 'en:creams']],
  ['egg', ['en:eggs']],
  ['fish', ['en:fishes', 'en:seafood', 'en:fish-and-seafood']],
  ['meat', ['en:meats', 'en:hams', 'en:sausages', 'en:poultries', 'en:prepared-meats']],
  ['bakery', ['en:breads', 'en:biscuits', 'en:cakes', 'en:viennoiseries', 'en:pastries']],
  ['grain', ['en:pastas', 'en:rices', 'en:flours', 'en:breakfast-cereals', 'en:cereals-and-their-products', 'en:semolinas']],
  ['legume', ['en:legumes', 'en:pulses', 'en:lentils', 'en:chickpeas', 'en:beans']],
  ['spice', ['en:spices', 'en:herbs', 'en:salts']],
  ['condiment', ['en:sauces', 'en:condiments', 'en:vegetable-oils', 'en:vinegars', 'en:jams', 'en:spreads', 'en:honeys', 'en:mustards']],
  ['snack', ['en:snacks', 'en:chocolates', 'en:confectioneries', 'en:sweet-snacks', 'en:salty-snacks']],
  ['beverage', ['en:beverages', 'en:juices', 'en:waters', 'en:coffees', 'en:teas']],
  ['fruit', ['en:fruits', 'en:fruits-based-foods', 'en:dried-fruits']],
  ['vegetable', ['en:vegetables', 'en:vegetables-based-foods', 'en:potatoes']],
  ['frozen', ['en:frozen-foods']],
];

export function categoryFromTags(tags: unknown): string {
  const list = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  for (const [category, prefixes] of CATEGORY_RULES) {
    if (prefixes.some((prefix) => list.includes(prefix))) return category;
  }
  return 'other';
}

// Nettoie un nom saisi par les contributeurs d'Open Food Facts : symboles de mise en forme (**, _, #),
// composition ou allergènes collés au nom (« Ingrédients : … », « Contient : … », « peut contenir … »),
// précisions entre parenthèses ou crochets, séparateurs de fin. Coupé au dernier mot entier.
export function cleanProductName(raw: string): string {
  let name = raw
    .replace(/[*_#~`|<>{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Composition ou allergènes : tout ce qui suit est retiré
  name = name.replace(/\s*[-–—:,.;]?\s*\b(ingr[ée]dients?|ingredientes|composition|allerg[èe]nes?|allergens?|al[ée]rgenos|contient|contains|contiene|peut contenir|may contain|puede contener|traces?)\b.*$/iu, '');
  // Précisions entre parenthèses ou crochets
  name = name.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s*[([].*$/, '');
  // Séparateurs et ponctuation en bout de nom
  name = name.replace(/^[\s\-–—:,.;/]+|[\s\-–—:,.;/]+$/g, '').replace(/\s+/g, ' ');
  if (name.length > MAX_NAME_LENGTH) {
    const cut = name.slice(0, MAX_NAME_LENGTH + 1);
    const lastSpace = cut.lastIndexOf(' ');
    name = (lastSpace > 12 ? cut.slice(0, lastSpace) : name.slice(0, MAX_NAME_LENGTH)).replace(/[\s\-–—:,.;/]+$/, '');
  }
  // Première lettre en majuscule (« LAIT DEMI-ÉCRÉMÉ » reste tel quel)
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function productName(product: any, language: string): string {
  const candidates = [product[`product_name_${language}`], product.product_name, product.generic_name];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const name = cleanProductName(value);
    if (name.length >= 2) return name;
  }
  return '';
}

// « 400 g e » → « 400 g » (le « ℮ » des emballages européens)
function cleanQuantity(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s*(℮|\be)\s*$/u, '').trim() : '';
}

// Produit trouvé, null s'il est inconnu (ou sans nom). Lève une erreur si la recherche est impossible
// (hors connexion, service indisponible).
export async function lookupBarcode(code: string, language: string): Promise<OffProduct | null> {
  const fields = ['product_name', `product_name_${language}`, 'generic_name', 'quantity', 'categories_tags'].join(',');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/${encodeURIComponent(code)}.json?fields=${fields}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    // 404 : produit absent de la base
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Open Food Facts : HTTP ${response.status}`);
    const data = await response.json();
    if (data?.status !== 1 || !data.product) return null;
    const name = productName(data.product, language);
    if (!name) return null;
    return { name, quantity: cleanQuantity(data.product.quantity), category: categoryFromTags(data.product.categories_tags) };
  } finally {
    clearTimeout(timer);
  }
}
