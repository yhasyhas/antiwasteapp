// Logique de generate-recipes sans appel réseau (testée par recipes.test.ts) :
// schéma de sortie, alias des ingrédients du garde-manger, lecture de la réponse du modèle, régimes.

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
export function isDietException(name: string, diet: StrictDiet): boolean {
  const padded = ` ${normalizeName(name)} `;
  return DIET_EXCEPTIONS[diet].some((exception) => padded.includes(` ${exception} `));
}

// ---------- Schéma de sortie ----------

export const DIFFICULTIES = ['easy', 'medium', 'expert'];

// Schéma construit à chaque requête : les alias du garde-manger et les régimes sélectionnés y sont
// des listes fermées (enum). Mode strict de Groq : tous les champs sont requis, sans champ en plus.
export function buildRecipeSchema(pantry: Pantry, diets: StrictDiet[]): Record<string, unknown> {
  const ingredientProperties: Record<string, unknown> = {
    name: { type: 'string' },
    quantity: { type: 'string', description: 'Nombre seul, sans unité (ex. "500", "2", "1/2")' },
    unit: { type: 'string', description: 'Unité abrégée (g, kg, ml, cl, l, c. à soupe, c. à café, pièce…)' },
    pantry_id: { type: 'string', enum: [...pantry.aliasOf.keys(), MISSING] },
  };
  if (diets.length > 0) {
    ingredientProperties.diet_violations = {
      type: 'array',
      items: { type: 'string', enum: diets },
      description: 'Régimes sélectionnés que cet ingrédient ne respecte pas (liste vide s\'il les respecte tous)',
    };
  }

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
      dietary_tags: { type: 'array', items: { type: 'string' } },
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
      'title', 'description', 'difficulty', 'prep_time', 'cook_time', 'total_time', 'servings', 'dietary_tags',
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
export function dietViolations(recipe: any, diets: StrictDiet[]): string[] {
  const violations: string[] = [];
  for (const ingredient of recipe.ingredients || []) {
    const flagged = Array.isArray(ingredient.diet_violations) ? ingredient.diet_violations : [];
    for (const diet of diets) {
      if (flagged.includes(diet) && !isDietException(ingredient.name, diet)) {
        violations.push(`${ingredient.name} (${diet})`);
      }
    }
  }
  return violations;
}

export function toRecipe(raw: any, pantry: Pantry, context: { mealType: string; cuisine: string; difficulty: string; dietary: string[] }): Recipe {
  const ingredients: RecipeIngredient[] = raw.ingredients.map((ingredient: any) => {
    const pantryItem = ingredient.pantry_id === MISSING ? undefined : pantry.aliasOf.get(ingredient.pantry_id);
    return {
      // Un ingrédient du garde-manger garde le nom qu'il a dans le garde-manger
      name: pantryItem ? pantryItem.name : ingredient.name.trim(),
      quantity: String(ingredient.quantity ?? '').replace(/[a-zA-ZÀ-ÿ\s]/g, '').trim() || '1',
      unit: typeof ingredient.unit === 'string' ? ingredient.unit.trim() : '',
      pantry_id: pantryItem ? pantryItem.id : null,
    };
  });

  const unique = (names: string[]) => names.filter((name, i) => names.findIndex((other) => normalizeName(other) === normalizeName(name)) === i);
  const suggestion = typeof raw.suggestion === 'string' ? raw.suggestion.trim() : '';

  return {
    title: raw.title.trim(),
    description: typeof raw.description === 'string' ? raw.description : '',
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : context.difficulty,
    prep_time: isCount(raw.prep_time) ? Math.round(raw.prep_time) : 15,
    cook_time: isCount(raw.cook_time) ? Math.round(raw.cook_time) : 20,
    total_time: isCount(raw.total_time) ? Math.round(raw.total_time) : 35,
    servings: isCount(raw.servings) && raw.servings > 0 ? Math.round(raw.servings) : 2,
    meal_type: context.mealType,
    cuisine: context.cuisine,
    dietary_tags: isStringArray(raw.dietary_tags) ? raw.dietary_tags : context.dietary,
    ingredients_used: ingredients,
    ingredients_from_list: unique(ingredients.filter((i) => i.pantry_id).map((i) => i.name)),
    missing_ingredients: unique(ingredients.filter((i) => !i.pantry_id).map((i) => i.name)),
    instructions: raw.instructions,
    tips: isStringArray(raw.tips) ? raw.tips : [],
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
  context: { mealType: string; cuisine: string; difficulty: string; dietary: string[]; maxRecipes: number; mode?: GenerationMode },
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
    const diet = dietViolations(raw, diets);
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

// 1 recette pour 1 ou 2 ingrédients, 2 jusqu'à 5, sinon 3
export function recipeCount(pantrySize: number): number {
  return pantrySize <= 2 ? 1 : pantrySize <= 5 ? 2 : 3;
}
