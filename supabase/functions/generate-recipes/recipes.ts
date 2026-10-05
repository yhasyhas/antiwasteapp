// Logique de generate-recipes sans appel réseau (testée par recipes.test.ts) :
// schéma de sortie, alias des ingrédients du garde-manger, lecture de la réponse du modèle, régimes.

import { withoutOvenHeatLevel } from './safety.ts';

// ---------- Garde-manger ----------

export type FoodKind = 'ingredient' | 'dish';

export interface PantryItem {
  id: string;
  name: string;
  quantity: string;
  // Jours avant la date de péremption, calculés par l'app (fuseau du téléphone) : 0 aujourd'hui,
  // négatif si dépassée, null sans date
  daysLeft: number | null;
  kind: FoodKind;
  // Choisi par l'utilisateur (ou venu d'une notification) : à utiliser en priorité
  priority: boolean;
}

// « Expire bientôt » : aujourd'hui, demain ou après-demain (comme les badges de l'app)
export const URGENT_DAYS = 2;

export const isUrgent = (item: PantryItem) =>
  item.priority || (item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= URGENT_DAYS);

export type GenerationMode = 'standard' | 'leftovers';

// Les identifiants du garde-manger (uuid) sont remplacés par des alias courts (p1, p2…) dans le prompt
// et le schéma : moins de tokens, et aucun risque que le modèle recopie mal un uuid.
export interface Pantry {
  items: PantryItem[];
  aliasOf: Map<string, PantryItem>;
}

export const MISSING = 'missing';
export const MAX_PANTRY_ITEMS = 60;

// Ordre du garde-manger dans le prompt : ingrédients choisis, puis dates les plus proches (dépassées
// après : elles ne sont pas mises en avant), puis sans date. Les plus urgents gardent leur place si la
// liste dépasse MAX_PANTRY_ITEMS.
function urgencyRank(item: PantryItem): number {
  if (item.priority) return -1;
  if (item.daysLeft === null) return 100_000;
  if (item.daysLeft < 0) return 50_000;
  return item.daysLeft;
}

// Accepte la liste envoyée par l'app : objets { id, name, quantity, days_left, kind, priority }
// (days_left, kind et priority depuis la phase 5) ou simples noms
export function buildPantry(raw: unknown): Pantry {
  const list = Array.isArray(raw) ? raw : [];
  const items: PantryItem[] = [];
  const seenIds = new Set<string>();
  list.forEach((entry: any, index: number) => {
    const name = typeof entry === 'string' ? entry : entry?.name;
    if (typeof name !== 'string' || name.trim() === '') return;
    const id = typeof entry?.id === 'string' && entry.id !== '' ? entry.id : `ingredient-${index}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    const daysLeft = typeof entry?.days_left === 'number' && Number.isFinite(entry.days_left) ? Math.round(entry.days_left) : null;
    items.push({
      id,
      name: name.trim(),
      quantity: typeof entry?.quantity === 'string' ? entry.quantity.trim() : '',
      daysLeft,
      kind: entry?.kind === 'dish' ? 'dish' : 'ingredient',
      priority: entry?.priority === true,
    });
  });
  // sort est stable : à urgence égale, l'ordre envoyé par l'app est gardé
  const kept = items.sort((a, b) => urgencyRank(a) - urgencyRank(b)).slice(0, MAX_PANTRY_ITEMS);
  return { items: kept, aliasOf: new Map(kept.map((item, i) => [`p${i + 1}`, item])) };
}

function daysText(days: number): string {
  if (days === 0) return "expire aujourd'hui";
  if (days === 1) return 'expire demain';
  return `expire dans ${days} jours`;
}

// Une ligne par ingrédient : « - p1 : riz (200 g) [reste de plat] [URGENT : expire demain] »
export function pantryForPrompt(pantry: Pantry): string {
  return [...pantry.aliasOf.entries()]
    .map(([alias, item]) => {
      const tags: string[] = [];
      if (item.kind === 'dish') tags.push('[reste de plat]');
      if (item.priority) tags.push("[URGENT : choisi par l'utilisateur]");
      else if (isUrgent(item)) tags.push(`[URGENT : ${daysText(item.daysLeft!)}]`);
      else if (item.daysLeft !== null && item.daysLeft < 0) tags.push('[date dépassée]');
      return `- ${alias} : ${item.name}${item.quantity ? ` (${item.quantity})` : ''}${tags.length ? ` ${tags.join(' ')}` : ''}`;
    })
    .join('\n');
}

export const urgentItems = (pantry: Pantry) => pantry.items.filter(isUrgent);
export const leftoverItems = (pantry: Pantry) => pantry.items.filter((item) => item.kind === 'dish');

// ---------- Régimes ----------

// Régimes stricts : un ingrédient qui ne les respecte pas fait rejeter la recette.
// low-carb n'est qu'une préférence : il oriente le prompt mais ne rejette rien.
export const STRICT_DIETS = ['vegan', 'vegetarian', 'gluten-free', 'dairy-free'] as const;
export type StrictDiet = typeof STRICT_DIETS[number];

export function strictDietsOf(dietary: unknown): StrictDiet[] {
  const list = Array.isArray(dietary) ? dietary.map((d) => String(d).toLowerCase()) : [];
  return STRICT_DIETS.filter((diet) => list.includes(diet));
}

// Ingrédients que les modèles signalent à tort (« lait », « beurre », « blé » dans le nom) :
// le serveur les considère toujours compatibles avec le régime.
const PLANT_BASED = [
  'lait de coco', 'creme de coco', 'lait d amande', 'lait d avoine', 'lait de soja', 'lait de riz',
  'lait de noisette', 'lait de cajou', 'beurre de cacahuete', 'beurre d arachide', 'beurre de cacao',
  'beurre d amande', 'yaourt de soja', 'creme de soja', 'fromage vegetal', 'noix de coco',
  'coconut milk', 'coconut cream', 'almond milk', 'oat milk', 'soy milk', 'rice milk', 'cashew milk',
  'peanut butter', 'cocoa butter', 'almond butter', 'soy yogurt',
  'leche de coco', 'leche de almendra', 'leche de avena', 'leche de soja', 'leche de arroz',
  'mantequilla de cacahuete', 'mantequilla de mani', 'crema de coco',
];

export const DIET_EXCEPTIONS: Record<StrictDiet, string[]> = {
  vegan: PLANT_BASED,
  'dairy-free': PLANT_BASED,
  vegetarian: [],
  'gluten-free': [
    'sarrasin', 'ble noir', 'farine de riz', 'farine de mais', 'fecule de mais', 'maizena', 'farine de pois chiche',
    'buckwheat', 'rice flour', 'corn flour', 'cornstarch', 'chickpea flour',
    'trigo sarraceno', 'harina de arroz', 'harina de maiz', 'maicena', 'harina de garbanzo',
  ],
};

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Vrai si le nom contient une exception entière (« lait de coco bio » contient « lait de coco »)
// Végétarien : produits laitiers, œufs et miel toujours permis (les modèles signalent parfois à tort la crème
// ou le beurre). Le nom entier doit être l'un d'eux, avec ses précisions courantes (« beurre doux », « lait
// entier ») : « beurre d'anchois » ou « fond de veau au beurre » restent contrôlés.
const VEGETARIAN_BASE = '(beurre|creme|creme fraiche|lait|oeufs?|jaunes? d oeufs?|blancs? d oeufs?|yaourts?|yogourts?|fromage blanc|miel|butter|cream|sour cream|milk|eggs?|egg yolks?|egg whites?|yogh?urts?|honey|mantequilla|nata|crema|leche|huevos?|yemas?|claras?|yogures?|miel)';
const VEGETARIAN_DETAIL = '(doux|demi sel|sale|entier|entiere|demi ecreme|ecreme|fraiche|epaisse|liquide|frais|nature|grec|grecque|bio|de vache|whole|skimmed|semi skimmed|heavy|double|single|unsalted|salted|plain|greek|fresh|entera|desnatada|semidesnatada|natural|griego|sin sal|con sal|para montar|de cocina|a fouetter|battus?|beaten)';
const VEGETARIAN_ALWAYS = new RegExp(`^(${VEGETARIAN_DETAIL} )*${VEGETARIAN_BASE}( ${VEGETARIAN_DETAIL})*$`);

export function isDietException(name: string, diet: StrictDiet): boolean {
  const normalized = normalizeName(name);
  if (diet === 'vegetarian' && VEGETARIAN_ALWAYS.test(normalized)) return true;
  const padded = ` ${normalized} `;
  return DIET_EXCEPTIONS[diet].some((exception) => padded.includes(` ${exception} `));
}

// Contrôle du serveur, en plus des régimes signalés par le modèle : mots (trois langues, formes normalisées) qu'un
// ingrédient ne peut pas contenir pour respecter le régime. Sert aux régimes choisis (recette écartée) et aux
// étiquettes affichées (seules les étiquettes vérifiées sont gardées). Mots de 4 lettres ou moins : mot entier
// (« ble » ne doit pas trouver « blend ») ; plus longs : début de mot (« saucisse » trouve « saucisses »). Dans une
// expression, chaque mot peut être au pluriel (« salsas de soja »). Revue systématique le 03/10/2026, en trois langues,
// au singulier et au pluriel : dietWords.test.ts.
const MEAT_WORDS = ['poulet', 'poule', 'dinde', 'canard', 'pintade', 'volaille', 'boeuf', 'veau', 'agneau', 'mouton', 'porc', 'cochon', 'jambon', 'lard', 'lardon', 'bacon',
  'saucisse', 'saucisson', 'chorizo', 'merguez', 'kefta', 'kofta', 'viande', 'steak', 'foie', 'abats', 'gibier', 'lapin', 'chevreau', 'cabri', 'fond de veau', 'fond de volaille',
  'oie', 'caille', 'chevreuil', 'cerf', 'sanglier', 'pancetta', 'coppa', 'prosciutto', 'speck', 'bresaola', 'chipolata', 'knack', 'andouill', 'boudin', 'mortadel', 'rillette',
  'entrecote', 'rumsteck', 'rumsteak', 'faux filet', 'tournedos', 'chateaubriand', 'paleron', 'gigot', 'cotelette', 'magret', 'gesier', 'tripe', 'rognon', 'kebab', 'nugget',
  'saindoux', 'demi glace',
  'chicken', 'turkey', 'duck', 'beef', 'veal', 'lamb', 'mutton', 'pork', 'ham', 'sausage', 'meat', 'liver', 'rabbit', 'goat meat', 'ground beef', 'burger', 'meatball', 'pepperoni', 'salami',
  'goose', 'geese', 'quail', 'venison', 'boar', 'hot dog', 'frankfurter', 'bratwurst', 'black pudding', 'sirloin', 'brisket', 'tenderloin', 'ribeye', 'rib eye', 't bone',
  'spare rib', 'pork rib', 'short rib', 'beef rib', 'lamb chop', 'gizzard', 'sweetbread', 'offal', 'hamburger', 'suet', 'tallow',
  'pollo', 'pavo', 'pato', 'carne', 'ternera', 'cordero', 'cerdo', 'jamon', 'tocino', 'salchicha', 'panceta', 'higado', 'conejo', 'cabrito',
  'ganso', 'codorni', 'venado', 'jabali', 'beicon', 'fiambre', 'cecina', 'longaniza', 'chistorra', 'butifarra', 'sobrasada', 'morcilla', 'salchichon', 'bistec', 'biftec',
  'solomillo', 'chuleta', 'costilla', 'pechuga', 'muslo', 'albondiga', 'callos', 'molleja', 'rinon', 'hamburguesa',
  'gelatine', 'gelatin', 'gelatina', 'grenetine'];
const FISH_WORDS = ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'merlu', 'sardine', 'maquereau', 'dorade', 'daurade', 'truite', 'tilapia', 'morue', 'anchois', 'hareng',
  'crevette', 'gambas', 'moule', 'calamar', 'poulpe', 'seiche', 'crabe', 'homard', 'huitre', 'saint jacques', 'surimi', 'nuoc mam', 'sauce poisson',
  'filet de bar', 'bar de ligne', 'loup de mer', 'sole', 'plie', 'limande', 'lotte', 'eglefin', 'lieu noir', 'lieu jaune', 'merlan', 'fletan', 'turbot', 'espadon', 'capitaine',
  'thiof', 'carpe', 'brochet', 'perche', 'langoustine', 'ecrevisse', 'palourde', 'bulot', 'bigorneau', 'calmar', 'encornet', 'pieuvre', 'oursin', 'fruits de mer', 'crustace',
  'coquillage', 'caviar', 'tarama', 'anguille', 'bonite',
  'fish', 'salmon', 'tuna', 'cod', 'hake', 'mackerel', 'trout', 'anchov', 'herring', 'shrimp', 'prawn', 'mussel', 'squid', 'octopus', 'crab', 'lobster', 'oyster', 'scallop', 'worcestershire', 'dashi', 'bonito',
  'sea bass', 'sea bream', 'snapper', 'plaice', 'monkfish', 'haddock', 'pollock', 'whiting', 'coley', 'halibut', 'swordfish', 'catfish', 'codfish', 'whitefish', 'perch', 'carp',
  'crayfish', 'crawfish', 'clam', 'cockle', 'whelk', 'calamari', 'cuttlefish', 'urchin', 'seafood', 'shellfish', 'roe', 'eel',
  'pescado', 'atun', 'bacalao', 'merluza', 'sardina', 'caballa', 'trucha', 'anchoa', 'arenque', 'camaron', 'gamba', 'langostino', 'mejillon', 'pulpo', 'cangrejo', 'langosta', 'ostra', 'salsa de pescado',
  'boqueron', 'lubina', 'dorada', 'lenguado', 'rape', 'abadejo', 'pescadilla', 'rodaballo', 'pez', 'peces', 'mojarra', 'corvina', 'pargo', 'carpa', 'cigala', 'centollo',
  'almeja', 'berberecho', 'vieira', 'chipiron', 'sepia', 'erizo de mar', 'marisco', 'hueva', 'anguila', 'angula'];
// Bouillons et cubes (noms d'ingrédients) : de viande, sauf « de légumes » écrit
const STOCK_WORDS = ['bouillon', 'cube', 'maggi', 'kub', 'jumbo', 'knorr', 'oxo', 'stock', 'broth', 'caldo', 'consome', 'consomme', 'avecrem'];
const VEGETABLE_STOCK = ['legume', 'vegetable', 'vegetal', 'verdura', 'champignon', 'mushroom', 'hongo', 'vegan', 'vegetarien', 'vegetarian', 'vegetariano'];
const DAIRY_WORDS = ['lait', 'beurre', 'creme', 'fromage', 'yaourt', 'yogourt', 'kefir', 'ghee', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'mascarpone', 'emmental', 'gruyere', 'comte', 'cheddar', 'chevre', 'brie', 'camembert', 'raclette', 'bechamel', 'petit suisse',
  'chantilly', 'lactoserum', 'babeurre', 'casein', 'skyr', 'faisselle', 'parmigiano', 'pecorino', 'burrata', 'stracciatella', 'scamorza', 'halloumi', 'paneer', 'gouda', 'edam',
  'roquefort', 'gorgonzola', 'provolone', 'reblochon', 'tomme', 'munster', 'beaufort', 'grana padano', 'cancoillotte',
  'milk', 'butter', 'cream', 'cheese', 'yogurt', 'yoghurt', 'whey', 'buttermilk', 'custard', 'quark', 'labneh', 'white sauce', 'half and half',
  'leche', 'mantequilla', 'nata', 'crema', 'queso', 'yogur', 'requeson', 'suero', 'cuajada', 'manchego', 'cabrales', 'besamel', 'natilla', 'helado'];
const EGG_WORDS = ['oeuf', 'mayonnaise', 'egg', 'mayo', 'huevo', 'yema', 'mayonesa', 'meringue', 'merengue', 'aioli', 'alioli', 'hollandaise', 'holandesa', 'bearnaise', 'bearnesa', 'brioche'];
const HONEY_WORDS = ['miel', 'honey'];
const GLUTEN_WORDS = ['ble', 'farine', 'pain', 'baguette', 'brioche', 'pates', 'pate feuillet', 'pate bris', 'pate sabl', 'pate a pizza', 'pate a crepe', 'semoule', 'couscous', 'boulgour', 'orge', 'seigle', 'epeautre', 'avoine',
  'chapelure', 'biscotte', 'biscuit', 'gateau', 'crepe', 'bechamel', 'roux', 'seitan', 'sauce soja', 'biere', 'nouille', 'vermicell', 'raviol', 'lasagn', 'tagliatelle', 'spaghetti', 'macaroni', 'penne', 'gnocchi', 'croissant', 'crouton', 'panure', 'pita', 'naan', 'chapati',
  'panko', 'teriyaki', 'malt', 'pizza', 'gaufre', 'feuille de brick', 'filo', 'phyllo', 'beignet',
  'wheat', 'flour', 'bread', 'bun', 'pasta', 'noodle', 'bulgur', 'barley', 'rye', 'spelt', 'oat', 'breadcrumb', 'cracker', 'cookie', 'cake', 'pastry', 'pastries', 'dough', 'soy sauce', 'beer', 'udon', 'ramen', 'soba', 'flour tortilla', 'wrap',
  'semolina', 'pancake', 'waffle', 'dumpling', 'gyoza', 'wonton', 'muffin', 'bagel', 'pretzel', 'scone', 'donut',
  'trigo', 'harina', 'pan', 'cuscus', 'cous cous', 'fideo', 'cebada', 'centeno', 'avena', 'pan rallado', 'galleta', 'cerveza', 'salsa de soja', 'semola', 'bizcocho', 'masa',
  'espelta', 'malta', 'espagueti', 'macarron', 'lasana', 'tallarin', 'noqui', 'hojaldre', 'gofre', 'picatoste', 'empanad', 'bollo', 'magdalena',
  // Bouillons, cubes et miso : souvent avec du blé ou de l'orge, par prudence
  'cube', 'maggi', 'kub', 'jumbo', 'knorr', 'oxo', 'stock', 'avecrem', 'bouillon', 'fond de', 'broth', 'caldo', 'consome', 'consomme', 'miso'];
// Dans un titre ou une étape, des mots trop ambigus (« pan » : poêle en anglais ; « cut into cubes ») sont ignorés
const TEXT_AMBIGUOUS = new Set(['pan', 'bun', 'masa', 'wrap', 'cube', 'kub', 'jumbo', 'cake', 'stock', 'ham', 'cod', 'crema', 'fond de', 'sole', 'plie', 'perch', 'rape', 'pez', 'roe']);
// Précisions qui rendent un nom d'ingrédient compatible, où qu'elles soient dans le nom (« saucisses fumées végétales »,
// « pâtes complètes sans gluten »)
const QUALIFIERS: Record<StrictDiet, string[]> = {
  'gluten-free': ['sans gluten', 'gluten free', 'sin gluten'],
  'dairy-free': ['sans lactose', 'lactose free', 'sin lactosa', 'vegetal', 'vegan', 'plant based', 'dairy free'],
  vegan: ['vegetal', 'vegan', 'plant based'],
  vegetarian: ['vegetarien', 'vegetarian', 'vegetariano', 'vegetal', 'vegan', 'veggie', 'plant based', 'sans viande', 'sin carne', 'meatless', 'meat free'],
};
// Ingrédients de base qui rendent le nom compatible seulement accolés au mot interdit : juste avant (« oat milk »,
// « rice noodles ») ou juste après, avec au plus des petits mots de liaison (« lait de riz », « yaourt au soja ») ;
// « riz au lait », « arroz con leche » ou « poulet sauce soja » restent interdits
const PLANT_BASES = ['coco', 'coconut', 'amande', 'almond', 'almendra', 'avoine', 'oat', 'avena', 'soja', 'soy', 'riz', 'rice', 'arroz', 'cajou', 'cashew', 'anacardo', 'cacahuete', 'arachide', 'peanut', 'mani', 'cacao', 'cocoa', 'noisette', 'hazelnut', 'avellana'];
const BASES: Record<StrictDiet, string[]> = {
  'gluten-free': ['riz', 'rice', 'arroz', 'sarrasin', 'buckwheat', 'sarraceno', 'pois chiche', 'chickpea', 'garbanzo', 'lentille', 'lentil', 'lenteja', 'quinoa', 'manioc', 'cassava', 'yuca', 'tapioca',
    'farine de mais', 'semoule de mais', 'polenta', 'corn tortilla', 'tortilla de maiz', 'cornmeal', 'harina de maiz', 'farine d amande', 'almond flour', 'harina de almendra', 'farine de coco', 'coconut flour'],
  'dairy-free': PLANT_BASES,
  vegan: PLANT_BASES,
  vegetarian: ['soja', 'soy', 'tofu'],
};
// Mots à ne pas confondre avec un aliment interdit
const NOT_FORBIDDEN = ['buttercup', 'butternut', 'cream of tartar', 'creme de tartre', 'beurre de cacahuete', 'beurre d arachide', 'beurre de karite', 'creme de coco', 'lait de coco', 'coconut milk', 'coconut cream', 'leche de coco', 'crema de coco',
  'pan fried', 'pan seared', 'pan roasted', 'creme de marron', 'creme de marrons', 'creme de cassis', 'creme de menthe'];
const DIET_WORDS: Record<StrictDiet, string[]> = {
  vegetarian: [...MEAT_WORDS, ...FISH_WORDS],
  vegan: [...MEAT_WORDS, ...FISH_WORDS, ...DAIRY_WORDS, ...EGG_WORDS, ...HONEY_WORDS],
  'gluten-free': GLUTEN_WORDS,
  'dairy-free': DAIRY_WORDS,
};

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Un mot ou une expression : chaque mot d'une expression peut être au pluriel ; le dernier mot est entier (4 lettres ou
// moins) ou un début de mot
const wordSource = (word: string) => {
  const parts = word.split(' ');
  const body = parts.map((part, i) => (i < parts.length - 1 ? `${escape(part)}(?:s|x|es)?` : escape(part))).join(' ');
  return word.length <= 4 ? `${body}(?:s|x|es)?(?= )` : body;
};
const wordsPattern = (words: string[], flags = '') => new RegExp(` (?:${words.map(wordSource).join('|')})`, flags);
const NAME_PATTERNS = Object.fromEntries(STRICT_DIETS.map((diet) => [diet, wordsPattern(DIET_WORDS[diet], 'g')])) as Record<StrictDiet, RegExp>;
const TEXT_PATTERNS = Object.fromEntries(STRICT_DIETS.map((diet) => [diet, wordsPattern(DIET_WORDS[diet].filter((w) => !TEXT_AMBIGUOUS.has(w)))])) as Record<StrictDiet, RegExp>;
const QUALIFIER_PATTERNS = Object.fromEntries(STRICT_DIETS.map((diet) => [diet, wordsPattern(QUALIFIERS[diet])])) as Record<StrictDiet, RegExp>;
const BASE_PATTERNS = Object.fromEntries(STRICT_DIETS.map((diet) => [diet, wordsPattern(BASES[diet], 'g')])) as Record<StrictDiet, RegExp>;
const STOCK_PATTERN = wordsPattern(STOCK_WORDS);
const VEGETABLE_STOCK_PATTERN = wordsPattern(VEGETABLE_STOCK);
const withoutHarmless = (text: string, diet: StrictDiet) =>
  [...NOT_FORBIDDEN, ...DIET_EXCEPTIONS[diet]].reduce((padded, phrase) => padded.replaceAll(` ${phrase} `, ' '), ` ${normalizeName(text)} `);

// Mots trouvés (début et fin du mot entier, dans le texte entouré d'espaces)
function spans(pattern: RegExp, padded: string): { start: number; end: number }[] {
  return [...padded.matchAll(pattern)].map((match) => {
    const start = match.index! + 1;
    return { start, end: padded.indexOf(' ', match.index! + match[0].length) };
  });
}
const LINKS = new Set(['de', 'd', 'du', 'des', 'a', 'au', 'aux', 'la', 'l', 'en', 'al', 'del', 'of']);

// Mot interdit rendu compatible par un ingrédient de base accolé (« lait de riz », « oat milk », « farine de maïs »)
function freeByBase(padded: string, word: { start: number; end: number }, bases: { start: number; end: number }[]): boolean {
  let next = word.end + 1;
  for (;;) {
    const following = padded.slice(next, padded.indexOf(' ', next));
    if (!LINKS.has(following)) break;
    next += following.length + 1;
  }
  return bases.some((base) => (base.start < word.end && base.end > word.start) || base.end === word.start - 1 || base.start === next);
}

// Nom d'ingrédient qui ne respecte pas le régime
export function dietWordInName(name: string, diet: StrictDiet): boolean {
  if (isDietException(name, diet)) return false;
  const padded = withoutHarmless(name, diet);
  if ((diet === 'vegetarian' || diet === 'vegan') && STOCK_PATTERN.test(padded) && !VEGETABLE_STOCK_PATTERN.test(padded)) return true;
  if (QUALIFIER_PATTERNS[diet].test(padded)) return false;
  const bases = spans(BASE_PATTERNS[diet], padded);
  return spans(NAME_PATTERNS[diet], padded).some((word) => !freeByBase(padded, word, bases));
}

// Titre ou étape qui nomme un aliment interdit par le régime (farine d'une béchamel absente de la liste)
export function dietWordInText(text: string, diet: StrictDiet): boolean {
  return TEXT_PATTERNS[diet].test(withoutHarmless(text, diet));
}

// Ingrédient qui ne respecte pas un régime : signalé par le modèle (hors exceptions) ou repéré par le serveur, par son
// nom dans la recette ou dans le garde-manger
export function ingredientBreaksDiet(ingredient: { name?: unknown; diet_violations?: unknown }, diet: StrictDiet, pantryName?: string): boolean {
  const name = typeof ingredient.name === 'string' ? ingredient.name : '';
  const flagged = Array.isArray(ingredient.diet_violations) && ingredient.diet_violations.includes(diet);
  if (flagged && !isDietException(name, diet)) return true;
  return dietWordInName(name, diet) || (pantryName !== undefined && dietWordInName(pantryName, diet));
}

// Étiquettes de régime vérifiées (« diet:vegan », « diet:gluten-free »…) : chaque ingrédient respecte le régime, et ni
// le titre ni les étapes ne nomment un aliment interdit (béchamel, farine non listée). Vegan l'emporte sur végétarien.
// Aucune étiquette nutritionnelle (« riche en protéines ») : rien ne permet de la vérifier.
export const VERIFIED_DIET_PREFIX = 'diet:';
export function verifiedDietTags(raw: any, pantry: Pantry): string[] {
  const ingredients = Array.isArray(raw?.ingredients) ? raw.ingredients : [];
  const texts = [String(raw?.title ?? ''), ...(Array.isArray(raw?.instructions) ? raw.instructions.map(String) : [])];
  const respects = (diet: StrictDiet) => ingredients.length > 0
    && !ingredients.some((ingredient: any) => ingredientBreaksDiet(ingredient, diet, pantry.aliasOf.get(ingredient?.pantry_id)?.name))
    && !texts.some((text) => dietWordInText(text, diet));
  return [
    ...(respects('vegan') ? ['vegan'] : respects('vegetarian') ? ['vegetarian'] : []),
    ...(respects('gluten-free') ? ['gluten-free'] : []),
    ...(respects('dairy-free') ? ['dairy-free'] : []),
  ].map((diet) => `${VERIFIED_DIET_PREFIX}${diet}`);
}

// ---------- Schéma de sortie ----------

// ---------- Sélection d'ingrédients ----------

// Basiques (sel, poivre, huile, eau) : disponibles partout, jamais « à acheter » ; avec une sélection, jamais
// considérés comme « un autre ingrédient du garde-manger » (même liste dans l'app : lib/basics.ts)
export const BASICS = ['sel', 'poivre', 'huile', 'eau', 'salt', 'pepper', 'oil', 'water', 'sal', 'pimienta', 'aceite', 'agua'];
export const MAX_OTHER_PANTRY = 100;

// Nom comparable : minuscules, sans accents, mots au singulier (« tomates » → « tomate »)
function matchKey(name: string): string {
  return normalizeName(name)
    .split(' ')
    .map((word) => (word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word))
    .join(' ');
}

export function isBasic(name: string): boolean {
  const padded = ` ${matchKey(name)} `;
  return BASICS.some((basic) => padded.includes(` ${basic} `));
}

// Reste du garde-manger (ingrédients non sélectionnés), noms nettoyés
export function buildOtherPantry(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
    .map((name) => name.trim().slice(0, 80))
    .slice(0, MAX_OTHER_PANTRY);
}

// Ingrédient de la recette qui est en fait un ingrédient non sélectionné du garde-manger (le modèle l'a
// marqué « missing »), ou null. « tomates cerises » correspond à « tomates » ; les basiques sont permis.
export function otherPantryUsed(raw: any, otherPantry: string[]): string | null {
  if (otherPantry.length === 0) return null;
  const others = otherPantry.map(matchKey).filter((key) => key !== '');
  for (const ingredient of raw.ingredients || []) {
    if (ingredient?.pantry_id !== MISSING || typeof ingredient.name !== 'string' || isBasic(ingredient.name)) continue;
    const padded = ` ${matchKey(ingredient.name)} `;
    const match = others.find((other) => padded.includes(` ${other} `));
    if (match) return ingredient.name;
  }
  return null;
}

// Aliment exclu par l'utilisateur (allergie ou goût) présent dans la recette, qu'il vienne du garde-manger
// ou non, ou null. « arachide » exclut « beurre d'arachide » ; mots entiers seulement.
export function excludedUsed(raw: any, pantry: Pantry, excluded: string[]): string | null {
  const keys = excluded.map(matchKey).filter((key) => key !== '');
  if (keys.length === 0) return null;
  for (const ingredient of raw.ingredients || []) {
    const pantryItem = ingredient?.pantry_id === MISSING ? undefined : pantry.aliasOf.get(ingredient?.pantry_id);
    const name = pantryItem ? pantryItem.name : typeof ingredient?.name === 'string' ? ingredient.name : '';
    const padded = ` ${matchKey(name)} `;
    if (keys.some((key) => padded.includes(` ${key} `))) return name;
  }
  return null;
}

// Préférences de l'utilisateur envoyées par l'app : liste nettoyée (20 aliments au plus)
export function cleanExcluded(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 40))
    .filter((item) => item !== '')
    .slice(0, 20);
}

// Nombre de personnes : 1 à 12, sinon null (pas de préférence)
export function cleanServings(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

export const DIFFICULTIES = ['easy', 'medium', 'expert'];

// Schéma construit à chaque requête : les alias du garde-manger et les régimes sélectionnés y sont
// des listes fermées (enum). Mode strict de Groq : tous les champs sont requis, sans champ en plus.
// unitHint : description de l'unité (version candidate du prompt : unités dans la langue de la recette)
export function buildRecipeSchema(pantry: Pantry, diets: StrictDiet[], unitHint = 'Unité abrégée (g, kg, ml, cl, l, c. à soupe, c. à café, pièce…)'): Record<string, unknown> {
  const ingredientProperties: Record<string, unknown> = {
    name: { type: 'string' },
    quantity: { type: 'string', description: 'Nombre seul, sans unité (ex. "500", "2", "1/2")' },
    unit: { type: 'string', description: unitHint },
    pantry_id: { type: 'string', enum: [...pantry.aliasOf.keys(), MISSING] },
  };
  // Toujours, pour les quatre régimes : régimes choisis (recette écartée) et étiquettes vérifiées
  ingredientProperties.diet_violations = {
    type: 'array',
    // Texte libre : une liste fermée fait refuser la réponse par Groq dès que le modèle écrit une autre valeur (03/10) ;
    // seules les quatre valeurs connues comptent
    items: { type: 'string' },
    description: `Régimes que cet ingrédient ne respecte pas, parmi ${STRICT_DIETS.join(', ')} (liste vide s'il les respecte tous)`,
  };

  const recipe = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      difficulty: { type: 'string', enum: DIFFICULTIES },
      prep_time: { type: 'integer' },
      cook_time: { type: 'integer' },
      total_time: { type: 'integer' },
      servings: { type: 'integer' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: ingredientProperties,
          required: Object.keys(ingredientProperties),
          additionalProperties: false,
        },
      },
      instructions: { type: 'array', items: { type: 'string' } },
      tips: { type: 'array', items: { type: 'string' } },
      suggestion: { type: 'string', description: 'Chaîne vide sauf si la recette convient mieux à un autre moment de la journée' },
      image_prompt: { type: 'string' },
    },
    required: [
      'title', 'description', 'difficulty', 'prep_time', 'cook_time', 'total_time', 'servings',
      'ingredients', 'instructions', 'tips', 'suggestion', 'image_prompt',
    ],
    additionalProperties: false,
  };

  return {
    type: 'object',
    properties: {
      recipes: { type: 'array', items: recipe },
      refusal: { type: 'string', description: 'Chaîne vide, sauf si les régimes empêchent toute recette' },
    },
    required: ['recipes', 'refusal'],
    additionalProperties: false,
  };
}

// ---------- Lecture de la réponse ----------

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
  // Identifiant de l'ingrédient du garde-manger, ou null s'il manque
  pantry_id: string | null;
}

export interface Recipe {
  title: string;
  description: string;
  difficulty: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  meal_type: string;
  cuisine: string;
  dietary_tags: string[];
  ingredients_used: RecipeIngredient[];
  // Noms des ingrédients du garde-manger utilisés, et des ingrédients à acheter (affichés par l'app)
  ingredients_from_list: string[];
  missing_ingredients: string[];
  instructions: string[];
  tips: string[];
  suggestion?: string;
  image_prompt: string;
}

export interface ParsedRecipes {
  recipes: Recipe[];
  // Recettes écartées parce qu'un ingrédient ne respecte pas un régime (après exceptions)
  dietaryRejections: string[];
  // Refus explicite du modèle (régimes impossibles à respecter)
  refusal: string;
  // Recettes mal formées, ou qui n'utilisent aucun ingrédient du garde-manger, écartées
  invalid: string[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Raison pour laquelle une recette ne respecte pas le schéma, ou null si elle est utilisable
export function recipeViolation(recipe: any, pantry: Pantry): string | null {
  if (!recipe || typeof recipe !== 'object') return 'pas un objet';
  if (typeof recipe.title !== 'string' || recipe.title.trim() === '') return '"title" invalide';
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) return '"ingredients" vide';
  if (!isStringArray(recipe.instructions) || recipe.instructions.length === 0) return '"instructions" vide';
  for (const ingredient of recipe.ingredients) {
    if (!ingredient || typeof ingredient.name !== 'string' || ingredient.name.trim() === '') return 'ingrédient sans nom';
    if (ingredient.pantry_id !== MISSING && !pantry.aliasOf.has(ingredient.pantry_id)) {
      return `pantry_id inconnu "${ingredient.pantry_id}"`;
    }
  }
  return null;
}

// Régimes non respectés par la recette, après les exceptions du serveur
export function dietViolations(recipe: any, diets: StrictDiet[], pantry?: Pantry): string[] {
  const violations: string[] = [];
  for (const ingredient of recipe.ingredients || []) {
    const pantryName = pantry?.aliasOf.get(ingredient?.pantry_id)?.name;
    for (const diet of diets) {
      if (ingredientBreaksDiet(ingredient, diet, pantryName)) violations.push(`${ingredient.name} (${diet})`);
    }
  }
  return violations;
}

// Repères internes du prompt recopiés par le modèle dans un texte affiché : identifiants du garde-manger (« (p10) »),
// « (buy) », « (missing) », étiquettes de la liste (« [URGENT : …] », « [reste de plat] »)
const INTERNAL_CODES = [
  /\s*[([]\s*(?:p\d{1,3}|buy|to buy|missing|à acheter|a comprar|pantry_id[^)\]]*)(?:\s*[,;/]\s*(?:p\d{1,3}|buy|missing))*\s*[)\]]/gi,
  /\s*\[(?:URGENT[^\]]*|reste de plat|date dépassée)\]/gi,
  /\b(?:pantry_id\s*[:=]?\s*)?p\d{1,3}\b/g,
];
export function withoutInternalCodes(text: string): string {
  return INTERNAL_CODES.reduce((current, pattern) => current.replace(pattern, ''), String(text ?? ''))
    .replace(/\s+([,.;:!?)])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
// « Urgent » et ses équivalents ne s'affichent jamais (« urgent bell peppers », « les poivrons urgents ») : le
// prompt marque les aliments [URGENT] et le modèle recopie parfois le mot. Retiré avec « le plus », « most »,
// « más » qui le précèdent, et les parenthèses laissées vides
const NOT_LETTER_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_LETTER_AFTER = String.raw`(?![\p{L}\p{N}])`;
const URGENCY_WORDS = [
  new RegExp(String.raw`\s*${NOT_LETTER_BEFORE}(?:(?:le|la|les)\s+plus\s+|most\s+|más\s+)?(?:urgent(?:e|s|es|ly)?|urgemment|urgente(?:s|mente)?|urgency|(?:d['’]|en\s+|de\s+|con\s+)?urgen(?:ce|cia))${NOT_LETTER_AFTER}`, 'giu'),
];
export function withoutUrgencyWords(text: string): string {
  const source = String(text ?? '');
  const cleaned = URGENCY_WORDS.reduce((current, pattern) => current.replace(pattern, ''), source)
    .replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s+([,.)])/g, '$1').replace(/\(\s+/g, '(').replace(/\s{2,}/g, ' ').replace(/^[\s,;:]+/, '').trim();
  if (cleaned === source.trim()) return cleaned;
  // Mot retiré en tête de phrase : majuscule rétablie
  return /^\p{Lu}/u.test(source.trim()) ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}
export const hasUrgencyWords = (text: string) => URGENCY_WORDS.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(text));

// Texte affiché : sans repères internes ni mot « urgent »
export const displayText = (text: string) => withoutUrgencyWords(withoutInternalCodes(text));

export const hasInternalCodes = (text: string) => INTERNAL_CODES.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(text));

const PIECE_UNITS = new Set(['piece', 'pieces', 'pc', 'pcs', 'unite', 'unites', 'unit', 'units', 'pieza', 'piezas', 'unidad', 'unidades', 'x']);

// Mentions de style ou d'origine ajoutées au titre (« – West African Inspired », « (East African Style) »,
// « Coconut-Style », « façon tajine ») : retirées, le titre garde la description du plat (tests du 03/10)
const STYLE_WORD = String.raw`(?:inspired|style|styled|inspiré|inspirée|inspirés|inspirées|estilo|inspirado|inspirada|comfort)`;
const TITLE_MENTIONS = [
  new RegExp(String.raw`\s*\([^()]*\b${STYLE_WORD}\b[^()]*\)`, 'giu'),
  new RegExp(String.raw`\s+[–—-]\s+[^–—]*\b${STYLE_WORD}\b[^–—]*$`, 'iu'),
  /\s+(?:al\s+)?estilo\s+[\p{L}'’ -]+$/iu,
  /\s+(?:à la\s+)?façon\s+[\p{L}'’ -]+$/iu,
  /\s+inspired by\s+[\p{L}'’ -]+$/iu,
  // « Coconut-Style », « Sub-Saharan Inspired », « West African-Style » : un mot, ou deux si le premier précise une région
  new RegExp(String.raw`(?:^|\s)(?:(?:west|east|north|south|central|southern|northern|eastern|western|sub|middle|latin|southeast|south-east)[\s-])?[\p{L}'’]+[\s-]${STYLE_WORD.replace('|comfort', '')}\b`, 'giu'),
];
export function withoutStyleMentions(title: string): string {
  // Traits d'union insécables (« Spanish‑Style ») : traits d'union ordinaires
  const cleaned = TITLE_MENTIONS.reduce((text, pattern) => text.replace(pattern, ''), title.replace(/[‐‑]/g, '-')).replace(/\s{2,}/g, ' ').replace(/^[\s,–—-]+|[\s,–—-]+$/g, '').trim();
  // Titre vidé par erreur : on garde l'original
  return cleaned.length >= 4 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : title;
}

export function toRecipe(raw: any, pantry: Pantry, context: { mealType: string; cuisine: string; difficulty: string; dietary: string[]; servings?: number | null }): Recipe {
  const ingredients: RecipeIngredient[] = raw.ingredients.map((ingredient: any) => {
    const pantryItem = ingredient.pantry_id === MISSING ? undefined : pantry.aliasOf.get(ingredient.pantry_id);
    return {
      // Nom écrit par le modèle, dans la langue de la recette (« eggs » pour « œufs » du garde-manger) ; le nom du
      // garde-manger seulement si le modèle n'en donne pas
      name: displayText(ingredient.name) || pantryItem?.name || '',
      quantity: String(ingredient.quantity ?? '').replace(/[a-zA-ZÀ-ÿ\s]/g, '').trim() || '1',
      // Ce qui se compte n'a pas d'unité : « 4 œufs », jamais « 4 pièces d'œufs »
      unit: typeof ingredient.unit === 'string' && !PIECE_UNITS.has(normalizeName(ingredient.unit)) ? ingredient.unit.trim() : '',
      pantry_id: pantryItem ? pantryItem.id : null,
    };
  });

  const unique = (names: string[]) => names.filter((name, i) => names.findIndex((other) => normalizeName(other) === normalizeName(name)) === i);
  const suggestion = typeof raw.suggestion === 'string' ? displayText(raw.suggestion) : '';

  return {
    title: withoutStyleMentions(displayText(raw.title)),
    description: typeof raw.description === 'string' ? displayText(raw.description) : '',
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : context.difficulty,
    prep_time: isCount(raw.prep_time) ? Math.round(raw.prep_time) : 15,
    cook_time: isCount(raw.cook_time) ? Math.round(raw.cook_time) : 20,
    total_time: isCount(raw.total_time) ? Math.round(raw.total_time) : 35,
    servings: context.servings ?? (isCount(raw.servings) && raw.servings > 0 ? Math.round(raw.servings) : 2),
    meal_type: context.mealType,
    cuisine: context.cuisine,
    // Étiquettes de régime vérifiées par le serveur seulement (« diet:vegan »…), aucune étiquette du modèle
    dietary_tags: verifiedDietTags(raw, pantry),
    ingredients_used: ingredients,
    ingredients_from_list: unique(ingredients.filter((i) => i.pantry_id).map((i) => i.name)),
    // À acheter : sans les basiques (sel, poivre, huile, eau), toujours disponibles
    missing_ingredients: unique(ingredients.filter((i) => !i.pantry_id && !isBasic(i.name)).map((i) => i.name)),
    // Au four, la température suffit : le niveau de feu (« on medium heat ») est retiré
    instructions: raw.instructions.map((step: string) => withoutOvenHeatLevel(displayText(step))),
    tips: isStringArray(raw.tips) ? raw.tips.map(displayText).filter(Boolean) : [],
    ...(suggestion && { suggestion }),
    image_prompt: typeof raw.image_prompt === 'string' && raw.image_prompt.trim() !== ''
      ? raw.image_prompt
      : `Professional food photography, ${raw.title}, appetizing`,
  };
}

export type ParseOutcome =
  | { ok: true; value: ParsedRecipes }
  | { ok: false; failure: string; code: 'invalid_response' };

// Lit la réponse du modèle. Les recettes mal formées ou qui ne respectent pas un régime sont écartées
// une par une. Échec (qui fait passer au fournisseur de secours) seulement si rien n'est exploitable
// et qu'aucun régime n'explique l'absence de recette.
export function parseRecipes(
  text: string,
  pantry: Pantry,
  diets: StrictDiet[],
  context: {
    mealType: string; cuisine: string; difficulty: string; dietary: string[]; maxRecipes: number;
    mode?: GenerationMode;
    // Sélection : ingrédients du garde-manger non choisis, interdits dans les recettes
    otherPantry?: string[];
    // Aliments exclus (allergies, goûts) et nombre de personnes (préférences)
    excluded?: string[];
    servings?: number | null;
  },
): ParseOutcome {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, failure: `JSON invalide (${text.slice(0, 120)})`, code: 'invalid_response' };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.recipes)) {
    return { ok: false, failure: 'champ "recipes" absent ou pas un tableau', code: 'invalid_response' };
  }

  const recipes: Recipe[] = [];
  const invalid: string[] = [];
  const dietaryRejections: string[] = [];
  parsed.recipes.forEach((raw: any, index: number) => {
    const violation = recipeViolation(raw, pantry);
    if (violation) return invalid.push(`n°${index} ${violation}`);
    // Une recette sans aucun ingrédient du garde-manger ne sert pas l'anti-gaspi (cas typique : régime
    // impossible à respecter, le modèle invente une recette avec d'autres ingrédients)
    if (!raw.ingredients.some((ingredient: any) => ingredient.pantry_id !== MISSING)) {
      return invalid.push(`n°${index} "${raw.title}" n'utilise aucun ingrédient du garde-manger`);
    }
    // « Transformer mes restes » : chaque recette part d'au moins un reste de plat
    if (context.mode === 'leftovers' && !raw.ingredients.some((ingredient: any) => pantry.aliasOf.get(ingredient.pantry_id)?.kind === 'dish')) {
      return invalid.push(`n°${index} "${raw.title}" n'utilise aucun reste`);
    }
    const excludedIngredient = excludedUsed(raw, pantry, context.excluded ?? []);
    if (excludedIngredient) {
      return invalid.push(`n°${index} "${raw.title}" contient « ${excludedIngredient} », exclu par l'utilisateur`);
    }
    const outsideSelection = otherPantryUsed(raw, context.otherPantry ?? []);
    if (outsideSelection) {
      return invalid.push(`n°${index} "${raw.title}" utilise « ${outsideSelection} », hors de la sélection`);
    }
    const diet = dietViolations(raw, diets, pantry);
    if (diet.length > 0) return dietaryRejections.push(`"${raw.title}" : ${diet.join(', ')}`);
    recipes.push(toRecipe(raw, pantry, context));
  });

  const refusal = typeof parsed.refusal === 'string' ? parsed.refusal.trim() : '';
  // Avec un régime, l'absence de recette utilisable est un refus lié au régime (pas un échec du modèle)
  if (recipes.length === 0 && diets.length === 0) {
    const reason = invalid.length > 0 ? `aucune recette valide (${invalid.slice(0, 3).join(' ; ')})` : 'aucune recette';
    return { ok: false, failure: reason, code: 'invalid_response' };
  }
  return { ok: true, value: { recipes: recipes.slice(0, context.maxRecipes), dietaryRejections, refusal, invalid } };
}

// 2 recettes pour 1 ou 2 aliments, 3 à partir de 3
export function recipeCount(pantrySize: number): number {
  return pantrySize <= 2 ? 2 : 3;
}
