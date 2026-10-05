// Catégorie d'un ingrédient de recette d'après son nom (français, anglais, espagnol), pour son icône
// (mêmes catégories que le garde-manger, colonne ingredients.category). Sert quand l'ingrédient ne vient pas du
// garde-manger, ou quand son lot n'y est plus. Inconnu : null (icône feuille par défaut).
// Aucune dépendance : testé avec Deno (lib/foodCategory.test.ts).

type Category = 'fruit' | 'vegetable' | 'legume' | 'meat' | 'fish' | 'egg' | 'dairy' | 'grain' | 'bakery' | 'condiment' | 'spice' | 'beverage';

// Mots (sans accents, en minuscules), pluriels en s, x ou es acceptés. Les expressions de plusieurs mots passent
// avant les mots seuls : « pomme de terre » n'est pas une pomme, « haricots verts » pas des légumes secs
const WORDS: Record<Category, string[]> = {
  vegetable: [
    'pomme de terre', 'patate douce', 'haricot vert', 'petit pois', 'green bean', 'sweet potato', 'bell pepper', 'red pepper',
    'green pepper', 'yellow pepper', 'spring onion', 'judia verde', 'cebolla de verdeo', 'chou fleur', 'cauliflower',
    'carotte', 'oignon', 'ail', 'tomate', 'courgette', 'poivron', 'aubergine', 'patate', 'poireau', 'chou', 'epinard', 'salade',
    'laitue', 'concombre', 'champignon', 'brocoli', 'celeri', 'navet', 'betterave', 'radis', 'echalote', 'manioc', 'igname',
    'gombo', 'okra', 'courge', 'potiron', 'citrouille', 'butternut', 'fenouil', 'artichaut', 'asperge', 'persil', 'coriandre',
    'basilic', 'menthe', 'ciboulette', 'aneth', 'blette', 'mais doux', 'carrot', 'onion', 'garlic', 'tomato', 'zucchini',
    'eggplant', 'potato', 'leek', 'cabbage', 'spinach', 'lettuce', 'cucumber', 'mushroom', 'broccoli', 'celery', 'shallot',
    'cassava', 'yam', 'pumpkin', 'squash', 'parsley', 'cilantro', 'basil', 'mint', 'scallion', 'kale', 'cebolla', 'ajo',
    'zanahoria', 'calabacin', 'pimiento', 'berenjena', 'papa', 'puerro', 'col', 'repollo', 'espinaca', 'lechuga', 'pepino',
    'champinon', 'seta', 'apio', 'nabo', 'remolacha', 'yuca', 'calabaza', 'perejil', 'albahaca', 'menta', 'cebollino',
  ],
  fruit: [
    'citron vert', 'banane plantain', 'noix de coco', 'pomme', 'banane', 'citron', 'orange', 'fraise', 'mangue', 'ananas', 'poire',
    'raisin', 'avocat', 'lime', 'coco', 'peche', 'abricot', 'cerise', 'framboise', 'myrtille', 'kiwi', 'melon', 'pasteque',
    'datte', 'figue', 'prune', 'plantain', 'apple', 'banana', 'lemon', 'strawberry', 'mango', 'pineapple', 'pear', 'grape',
    'avocado', 'peach', 'apricot', 'cherry', 'cherrie', 'raspberry', 'raspberrie', 'blueberry', 'blueberrie', 'date', 'fig',
    'manzana', 'platano', 'limon', 'fresa', 'pina', 'pera', 'uva', 'aguacate', 'melocoton', 'durazno', 'cereza', 'datil', 'higo',
  ],
  legume: [
    'pois chiche', 'haricot rouge', 'haricot blanc', 'haricot', 'lentille', 'feve', 'arachide', 'cacahuete', 'tofu', 'soja',
    'chickpea', 'lentil', 'kidney bean', 'black bean', 'bean', 'peanut', 'garbanzo', 'lenteja', 'frijol', 'alubia', 'judia',
    'mani', 'haba',
  ],
  meat: [
    'poulet', 'boeuf', 'porc', 'agneau', 'veau', 'dinde', 'jambon', 'lardon', 'bacon', 'saucisse', 'chorizo', 'viande', 'steak',
    'merguez', 'canard', 'lapin', 'mouton', 'escalope', 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'ham', 'sausage', 'meat',
    'duck', 'mutton', 'pollo', 'carne', 'cerdo', 'cordero', 'pavo', 'jamon', 'salchicha', 'ternera', 'pato', 'res',
  ],
  fish: [
    'poisson', 'saumon', 'thon', 'cabillaud', 'dorade', 'daurade', 'merlu', 'sardine', 'maquereau', 'crevette', 'moule', 'calamar',
    'truite', 'anchois', 'colin', 'tilapia', 'capitaine', 'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'sea bream', 'trout',
    'anchovy', 'anchovie', 'mackerel', 'mussel', 'squid', 'pescado', 'atun', 'bacalao', 'gamba', 'camaron', 'langostino',
    'mejillon', 'trucha', 'anchoa', 'merluza', 'sardina', 'dorada',
  ],
  egg: ['oeuf', 'egg', 'huevo'],
  dairy: [
    'creme fraiche', 'lait', 'beurre', 'creme', 'fromage', 'yaourt', 'yogourt', 'mozzarella', 'emmental', 'gruyere', 'parmesan',
    'feta', 'ricotta', 'mascarpone', 'comte', 'cheddar', 'milk', 'butter', 'cream', 'cheese', 'yogurt', 'yoghurt', 'leche',
    'mantequilla', 'nata', 'queso', 'yogur', 'crema',
  ],
  grain: [
    'riz', 'pate', 'penne', 'spaghetti', 'tagliatelle', 'fusilli', 'macaroni', 'nouille', 'vermicelle', 'semoule', 'couscous',
    'farine', 'quinoa', 'boulgour', 'avoine', 'mais', 'fonio', 'mil', 'rice', 'pasta', 'noodle', 'vermicelli', 'flour', 'oat',
    'corn', 'bulgur', 'arroz', 'fideo', 'harina', 'avena', 'maiz', 'cuscus',
  ],
  bakery: ['pain', 'baguette', 'brioche', 'tortilla', 'pita', 'bread', 'croissant', 'pan', 'chapelure', 'breadcrumb'],
  condiment: [
    'lait de coco', 'coconut milk', 'leche de coco', 'sauce soja', 'soy sauce', 'salsa de soja', 'beurre de cacahuete',
    'pate d arachide', 'peanut butter', 'mantequilla de mani', 'huile', 'vinaigre', 'moutarde', 'sauce', 'ketchup',
    'mayonnaise', 'miel', 'sucre', 'bouillon', 'concentre', 'oil', 'vinegar', 'mustard', 'honey', 'sugar', 'stock', 'broth',
    'aceite', 'vinagre', 'mostaza', 'azucar', 'caldo', 'salsa',
  ],
  spice: [
    'poivre noir', 'black pepper', 'ras el hanout', 'sel', 'poivre', 'cumin', 'curcuma', 'paprika', 'cannelle', 'piment',
    'gingembre', 'curry', 'muscade', 'thym', 'laurier', 'origan', 'herbe', 'salt', 'pepper', 'chili', 'chilli', 'ginger',
    'cinnamon', 'turmeric', 'nutmeg', 'thyme', 'oregano', 'bay leaf', 'sal', 'pimienta', 'comino', 'canela', 'jengibre',
    'oregano', 'tomillo', 'laurel', 'aji', 'guindilla',
  ],
  beverage: ['eau', 'vin', 'biere', 'jus', 'water', 'wine', 'beer', 'juice', 'agua', 'vino', 'cerveza', 'zumo', 'jugo'],
};

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();

// Un mot du nom correspond à un mot de la liste, au singulier ou au pluriel
const sameWord = (word: string, key: string) => word === key || word === `${key}s` || word === `${key}x` || word === `${key}es`;

interface Entry { category: Category; words: string[] }
const ENTRIES: Entry[] = Object.entries(WORDS)
  .flatMap(([category, list]) => list.map((key) => ({ category: category as Category, words: key.split(' ') })))
  // Les expressions les plus longues d'abord
  .sort((a, b) => b.words.length - a.words.length);

// Catégorie du nom ; à longueur d'expression égale, le premier mot du nom l'emporte (« cuisses de poulet »,
// « sauce tomate »), sauf en anglais où le nom principal vient en dernier (« tomato sauce »)
export function guessFoodCategory(name: string, language?: string): Category | null {
  const words = normalize(name).split(' ').filter(Boolean);
  if (words.length === 0) return null;
  let best: { category: Category; length: number; position: number } | null = null;
  for (const entry of ENTRIES) {
    if (best && entry.words.length < best.length) break;
    for (let i = 0; i + entry.words.length <= words.length; i++) {
      if (!entry.words.every((key, j) => sameWord(words[i + j], key))) continue;
      const better = !best || (language === 'en' ? i > best.position : i < best.position);
      if (better) best = { category: entry.category, length: entry.words.length, position: i };
    }
  }
  return best?.category ?? null;
}
