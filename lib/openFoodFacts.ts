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
  // Catégorie de l'app tirée des catégories Open Food Facts ; null si le produit n'en a pas (jamais devinée)
  category: string | null;
  // Nom générique (« Biscuits feuilletés »), marque, degré de transformation (NOVA 1 à 4), Nutri-Score (a à e)
  genericName: string | null;
  brand: string | null;
  novaGroup: number | null;
  nutriscore: string | null;
  // Catégories Open Food Facts (« en:biscuits »), de la plus générale à la plus précise
  categories: string[];
}

// Catégories Open Food Facts → catégories de l'app (mêmes codes que analyze-image). La catégorie la plus
// précise du produit décide (Open Food Facts les range de la plus générale à la plus précise) : un pain de mie
// est « bakery », même s'il est aussi rangé dans les surgelés ; des biscuits sont un « snack ».
const CATEGORY_RULES: Array<[string, string[]]> = [
  ['dairy', ['en:dairies', 'en:cheeses', 'en:yogurts', 'en:milks', 'en:butters', 'en:creams']],
  ['egg', ['en:eggs']],
  ['fish', ['en:fishes', 'en:seafood', 'en:fish-and-seafood']],
  ['meat', ['en:meats', 'en:hams', 'en:sausages', 'en:poultries', 'en:prepared-meats']],
  ['bakery', ['en:breads', 'en:viennoiseries', 'en:pastries', 'en:sandwich-breads', 'en:brioches']],
  ['grain', ['en:pastas', 'en:rices', 'en:flours', 'en:breakfast-cereals', 'en:cereals-and-their-products', 'en:semolinas']],
  ['legume', ['en:legumes', 'en:pulses', 'en:lentils', 'en:chickpeas', 'en:beans']],
  ['spice', ['en:spices', 'en:herbs', 'en:salts']],
  ['condiment', ['en:sauces', 'en:condiments', 'en:vegetable-oils', 'en:vinegars', 'en:jams', 'en:spreads', 'en:honeys', 'en:mustards']],
  ['snack', ['en:snacks', 'en:chocolates', 'en:confectioneries', 'en:sweet-snacks', 'en:salty-snacks', 'en:biscuits', 'en:biscuits-and-cakes', 'en:cakes']],
  ['beverage', ['en:beverages', 'en:juices', 'en:waters', 'en:coffees', 'en:teas']],
  ['fruit', ['en:fruits', 'en:fruit-based-foods', 'en:fruits-based-foods', 'en:dried-fruits', 'en:compotes']],
  ['vegetable', ['en:vegetables', 'en:vegetable-based-foods', 'en:vegetables-based-foods', 'en:potatoes']],
  ['frozen', ['en:frozen-foods']],
];

// Catégorie de l'app : la plus précise des catégories Open Food Facts reconnues ; « other » si aucune ne l'est,
// null si le produit n'a pas de catégorie
export function categoryFromTags(tags: unknown): string | null {
  const list = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  if (list.length === 0) return null;
  for (const tag of [...list].reverse()) {
    const rule = CATEGORY_RULES.find(([, known]) => known.includes(tag));
    if (rule) return rule[0];
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

// Nom générique dans la langue de l'app, sinon celui du produit (« Biscuits feuilletés »)
function genericName(product: any, language: string): string | null {
  for (const value of [product[`generic_name_${language}`], product.generic_name]) {
    if (typeof value !== 'string') continue;
    const name = cleanProductName(value);
    if (name.length >= 2) return name;
  }
  return null;
}

// Première marque (« LU, Mondelez » → « LU »)
function firstBrand(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const brand = value.split(',')[0].trim();
  return brand ? brand.slice(0, 80) : null;
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
  const fields = ['product_name', `product_name_${language}`, 'generic_name', `generic_name_${language}`, 'quantity', 'categories_tags',
    'brands', 'nova_group', 'nutriscore_grade'].join(',');
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
    return productFromOff(data.product, language, name);
  } finally {
    clearTimeout(timer);
  }
}

// Informations d'un produit Open Food Facts (nom déjà nettoyé)
export function productFromOff(product: any, language: string, name = productName(product, language)): OffProduct {
  const nova = Number(product.nova_group);
  const grade = typeof product.nutriscore_grade === 'string' ? product.nutriscore_grade.toLowerCase() : '';
  const categories = Array.isArray(product.categories_tags)
    ? product.categories_tags.filter((tag: unknown): tag is string => typeof tag === 'string').slice(0, 60)
    : [];
  const generic = genericName(product, language);
  return {
    name,
    quantity: cleanQuantity(product.quantity),
    category: categoryFromTags(categories),
    // Nom générique qui ne répète pas le nom du produit
    genericName: generic && generic.toLowerCase() !== name.toLowerCase() ? generic : null,
    brand: firstBrand(product.brands),
    novaGroup: Number.isInteger(nova) && nova >= 1 && nova <= 4 ? nova : null,
    nutriscore: ['a', 'b', 'c', 'd', 'e'].includes(grade) ? grade : null,
    categories,
  };
}
