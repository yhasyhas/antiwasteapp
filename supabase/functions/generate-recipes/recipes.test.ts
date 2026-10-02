// Tests de generate-recipes sans appel réseau : alias du garde-manger, schéma, lecture de la réponse,
// correspondance des identifiants, régimes et exceptions.
// Lancement : deno test --no-config supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  buildPantry,
  buildRecipeSchema,
  cleanExcluded,
  cleanServings,
  excludedUsed,
  hasInternalCodes,
  isBasic,
  dietViolations,
  isDietException,
  otherPantryUsed,
  leftoverItems,
  MAX_PANTRY_ITEMS,
  MISSING,
  pantryForPrompt,
  parseRecipes,
  recipeCount,
  strictDietsOf,
  withoutInternalCodes,
  toRecipe,
  urgentItems,
} from './recipes.ts';

const PANTRY = buildPantry([
  { id: 'uuid-banane', name: 'banane', quantity: '3' },
  { id: 'uuid-lait', name: 'lait', quantity: '' },
  { id: 'uuid-lait-coco', name: 'lait de coco', quantity: '1 boîte' },
]);
const CONTEXT = { mealType: 'snack', cuisine: 'any', difficulty: 'easy', dietary: [], maxRecipes: 3 };

const recipe = (ingredients: unknown[], overrides: Record<string, unknown> = {}) => ({
  title: 'Smoothie',
  description: 'Frais',
  difficulty: 'easy',
  prep_time: 5,
  cook_time: 0,
  total_time: 5,
  servings: 2,
  dietary_tags: [],
  ingredients,
  instructions: ['Mixez 1 minute à vitesse maximale.'],
  tips: [],
  suggestion: '',
  image_prompt: 'Professional food photography, smoothie',
  ...overrides,
});
const ing = (name: string, pantry_id: string, diet_violations: string[] = []) => ({ name, quantity: '1', unit: 'pièce', pantry_id, diet_violations });
const parse = (recipes: unknown[], diets: string[] = [], refusal = '') =>
  parseRecipes(JSON.stringify({ recipes, refusal }), PANTRY, strictDietsOf(diets), { ...CONTEXT, dietary: diets });

Deno.test('garde-manger : alias p1, p2… dans l\'ordre, noms simples acceptés, doublons et vides écartés', () => {
  assertEquals([...PANTRY.aliasOf.keys()], ['p1', 'p2', 'p3']);
  assertEquals(PANTRY.aliasOf.get('p2')?.id, 'uuid-lait');
  assertEquals(pantryForPrompt(PANTRY).split('\n')[0], '- p1 : banane (3)');

  const legacy = buildPantry(['tomate', '', { id: 'x', name: 'riz' }, { id: 'x', name: 'riz bis' }]);
  assertEquals(legacy.items.map((i) => i.name), ['tomate', 'riz']);
  assertEquals(buildPantry(Array.from({ length: 80 }, (_, i) => `aliment ${i}`)).items.length, MAX_PANTRY_ITEMS);
});

Deno.test('schéma : alias et « missing » en liste fermée ; diet_violations seulement avec un régime strict', () => {
  const schema: any = buildRecipeSchema(PANTRY, []);
  const ingredient = schema.properties.recipes.items.properties.ingredients.items;
  assertEquals(ingredient.properties.pantry_id.enum, ['p1', 'p2', 'p3', MISSING]);
  assertEquals(ingredient.properties.diet_violations, undefined);
  assertEquals(ingredient.additionalProperties, false);

  const vegan: any = buildRecipeSchema(PANTRY, strictDietsOf(['Vegan', 'Low-Carb']));
  const veganIngredient = vegan.properties.recipes.items.properties.ingredients.items;
  assertEquals(veganIngredient.properties.diet_violations.items.enum, ['vegan']);
  assert(veganIngredient.required.includes('diet_violations'));
});

Deno.test('correspondance des identifiants : alias → uuid ; nom écrit par le modèle (langue de la recette) ; missing → null', () => {
  const result = parse([recipe([ing('Bananes mûres', 'p1'), ing('milk', 'p2'), ing('cannelle', MISSING)])]);
  assert(result.ok);
  const [r] = result.value.recipes;
  assertEquals(r.ingredients_used.map((i) => [i.name, i.pantry_id]), [['Bananes mûres', 'uuid-banane'], ['milk', 'uuid-lait'], ['cannelle', null]]);
  assertEquals(r.ingredients_from_list, ['Bananes mûres', 'milk']);
  assertEquals(r.missing_ingredients, ['cannelle']);
});

Deno.test('recette avec un alias inconnu, ou sans aucun ingrédient du garde-manger : écartée', () => {
  const result = parse([
    recipe([ing('banane', 'p9')], { title: 'Alias inconnu' }),
    recipe([ing('quinoa', MISSING)], { title: 'Rien du garde-manger' }),
    recipe([ing('banane', 'p1')], { title: 'Valide' }),
  ]);
  assert(result.ok);
  assertEquals(result.value.recipes.map((r) => r.title), ['Valide']);
  assertEquals(result.value.invalid.length, 2);
});

Deno.test('sans régime, aucune recette exploitable : échec (bascule sur le secours)', () => {
  const result = parse([recipe([ing('quinoa', MISSING)])]);
  assert(!result.ok);
  assert(!parseRecipes('{ pas du json', PANTRY, [], CONTEXT).ok);
  assert(!parseRecipes('{"refusal": ""}', PANTRY, [], CONTEXT).ok);
});

Deno.test('régimes : un ingrédient signalé fait écarter la recette, sauf exception du serveur', () => {
  const result = parse([
    recipe([ing('lait de coco', 'p3', ['vegan'])], { title: 'Curry coco' }),
    recipe([ing('beurre', MISSING, ['vegan']), ing('banane', 'p1')], { title: 'Banane au beurre' }),
  ], ['Vegan']);
  assert(result.ok);
  assertEquals(result.value.recipes.map((r) => r.title), ['Curry coco']);
  assertEquals(result.value.dietaryRejections.length, 1);
});

Deno.test('régimes : low-carb n\'écarte jamais de recette', () => {
  const result = parse([recipe([ing('banane', 'p1', ['low-carb'])])], ['Low-Carb']);
  assert(result.ok);
  assertEquals(result.value.recipes.length, 1);
});

Deno.test('régime impossible : aucune recette, résultat valide (refus lié au régime, pas de secours)', () => {
  const refused = parse([], ['Vegan'], 'Tous les ingrédients sont d\'origine animale');
  assert(refused.ok);
  assertEquals(refused.value.recipes, []);
  const invented = parse([recipe([ing('quinoa', MISSING)])], ['Vegan']);
  assert(invented.ok);
  assertEquals(invented.value.recipes, []);
});

Deno.test('exceptions : nom normalisé (accents, majuscules, apostrophes), mot entier seulement', () => {
  assert(isDietException('Lait de coco bio', 'vegan'));
  assert(isDietException("Lait d'amande", 'dairy-free'));
  assert(isDietException('Beurre de cacahuète', 'vegan'));
  assert(isDietException('Farine de SARRASIN', 'gluten-free'));
  assert(!isDietException('lait', 'vegan'));
  assert(!isDietException('farine de blé', 'gluten-free'));
  assert(!isDietException('lait de coco', 'vegetarian'));
});

Deno.test('lecture : valeurs par défaut, suggestion vide retirée, nombre de recettes limité', () => {
  const many = parse(Array.from({ length: 5 }, (_, i) => recipe([ing('banane', 'p1')], { title: `R${i}`, servings: -1, difficulty: 'x', suggestion: '  ' })));
  assert(many.ok);
  assertEquals(many.value.recipes.length, 3);
  const [r] = many.value.recipes;
  assertEquals([r.servings, r.difficulty, r.suggestion], [2, 'easy', undefined]);
});

Deno.test('nombre de recettes selon le garde-manger', () => {
  assertEquals([1, 2, 3, 5, 6, 20].map(recipeCount), [2, 2, 3, 3, 3, 3]);
});

// ---------- Anti-gaspi (phase 5) ----------

const URGENT_PANTRY = buildPantry([
  { id: 'sans-date', name: 'pâtes', quantity: '500 g' },
  { id: 'loin', name: 'carottes', days_left: 10 },
  { id: 'perime', name: 'yaourt', days_left: -2 },
  { id: 'demain', name: 'tomates', days_left: 1 },
  { id: 'reste', name: 'riz cuit', days_left: 2, kind: 'dish' },
  { id: 'choisi', name: 'courgette', days_left: 6, priority: true },
  { id: 'aujourdhui', name: 'poulet', days_left: 0 },
]);

Deno.test('garde-manger trié par urgence : choisis, puis dates proches, dates dépassées, sans date', () => {
  assertEquals(URGENT_PANTRY.items.map((i) => i.id), ['choisi', 'aujourdhui', 'demain', 'reste', 'loin', 'perime', 'sans-date']);
  assertEquals(urgentItems(URGENT_PANTRY).map((i) => i.id), ['choisi', 'aujourdhui', 'demain', 'reste']);
  assertEquals(leftoverItems(URGENT_PANTRY).map((i) => i.id), ['reste']);
});

Deno.test('prompt : ingrédients urgents, restes et dates dépassées signalés', () => {
  const lines = pantryForPrompt(URGENT_PANTRY).split('\n');
  assertEquals(lines[0], "- p1 : courgette [URGENT : choisi par l'utilisateur]");
  assertEquals(lines[1], "- p2 : poulet [URGENT : expire aujourd'hui]");
  assertEquals(lines[2], '- p3 : tomates [URGENT : expire demain]');
  assertEquals(lines[3], '- p4 : riz cuit [reste de plat] [URGENT : expire dans 2 jours]');
  assertEquals(lines[4], '- p5 : carottes');
  assertEquals(lines[5], '- p6 : yaourt [date dépassée]');
  assertEquals(lines[6], '- p7 : pâtes (500 g)');
});

Deno.test('les plus urgents restent dans la liste quand elle dépasse la limite', () => {
  const many = buildPantry([
    ...Array.from({ length: MAX_PANTRY_ITEMS }, (_, i) => ({ id: `x${i}`, name: `aliment ${i}` })),
    { id: 'urgent', name: 'lait', days_left: 0 },
  ]);
  assertEquals(many.items[0].id, 'urgent');
  assertEquals(many.items.length, MAX_PANTRY_ITEMS);
});

Deno.test('mode « Transformer mes restes » : une recette sans reste est écartée', () => {
  const context = { ...CONTEXT, mode: 'leftovers' as const };
  const withLeftover = recipe([ing('riz cuit', 'p4'), ing('œuf', MISSING)], { title: 'Riz sauté' });
  const withoutLeftover = recipe([ing('tomates', 'p3')], { title: 'Salade' });
  const result = parseRecipes(JSON.stringify({ recipes: [withLeftover, withoutLeftover], refusal: '' }), URGENT_PANTRY, [], context);
  assert(result.ok);
  assertEquals(result.value.recipes.map((r) => r.title), ['Riz sauté']);
  assertEquals(result.value.invalid.length, 1);

  const none = parseRecipes(JSON.stringify({ recipes: [withoutLeftover], refusal: '' }), URGENT_PANTRY, [], context);
  assert(!none.ok);
  // En mode normal, la même recette est acceptée
  assert(parseRecipes(JSON.stringify({ recipes: [withoutLeftover], refusal: '' }), URGENT_PANTRY, [], CONTEXT).ok);
});

// ---------- Sélection (retours de test de la phase 5) ----------

Deno.test('sélection : les basiques sont toujours permis', () => {
  for (const name of ['sel', 'poivre noir', "huile d'olive", 'eau', 'Salt', 'aceite de oliva']) assert(isBasic(name), name);
  for (const name of ['gâteau', "selle d'agneau", 'tomate']) assert(!isBasic(name), name);
});

Deno.test('sélection : un ingrédient non sélectionné du garde-manger est repéré, même au pluriel ou précisé', () => {
  const other = ['tomates', 'crème fraîche', 'lait de coco'];
  const raw = (names: string[]) => ({ ingredients: names.map((name) => ({ name, pantry_id: MISSING })) });
  assertEquals(otherPantryUsed(raw(['tomate cerise', 'sel']), other), 'tomate cerise');
  assertEquals(otherPantryUsed(raw(['Crème fraîche épaisse']), other), 'Crème fraîche épaisse');
  assertEquals(otherPantryUsed(raw(['lait', 'poivre', 'oignon']), other), null);
  // Un ingrédient de la sélection (identifiant) n'est jamais refusé
  assertEquals(otherPantryUsed({ ingredients: [{ name: 'tomates', pantry_id: 'p1' }] }, other), null);
});

Deno.test('sélection : la recette qui utilise un ingrédient réservé est écartée', () => {
  const context = { ...CONTEXT, otherPantry: ['lait de coco'] };
  const ok = recipe([ing('banane', 'p1'), ing('sel', MISSING)], { title: 'Banane poêlée' });
  const outside = recipe([ing('banane', 'p1'), ing('lait de coco', MISSING)], { title: 'Smoothie coco' });
  const result = parseRecipes(JSON.stringify({ recipes: [ok, outside], refusal: '' }), PANTRY, [], context);
  assert(result.ok);
  assertEquals(result.value.recipes.map((r) => r.title), ['Banane poêlée']);
  assert(result.value.invalid[0].includes('hors de la sélection'));
});

Deno.test('aliments exclus : recette écartée si elle en contient un (garde-manger ou à acheter), mots entiers', () => {
  const withPeanut = recipe([ing('banane', 'p1'), ing("beurre d'arachide", MISSING)]);
  assertEquals(excludedUsed(withPeanut, PANTRY, ['Arachide']), "beurre d'arachide");
  assertEquals(excludedUsed(recipe([ing('ignoré', 'p2')]), PANTRY, ['lait']), 'lait');
  assertEquals(excludedUsed(recipe([ing('lait de coco', 'p3')]), PANTRY, ['coco']), 'lait de coco');
  assertEquals(excludedUsed(recipe([ing('banane', 'p1')]), PANTRY, ['ban']), null);
  const outcome = parseRecipes(JSON.stringify({ recipes: [withPeanut, recipe([ing('banane', 'p1')], { title: 'Banane' })], refusal: '' }), PANTRY, [], { ...CONTEXT, excluded: ['arachide'] });
  assert(outcome.ok);
  assertEquals(outcome.value.recipes.map((r) => r.title), ['Banane']);
});

Deno.test('préférences : aliments exclus nettoyés, nombre de personnes imposé à la recette', () => {
  assertEquals(cleanExcluded([' arachide ', '', 3, 'x'.repeat(60)]), ['arachide', 'x'.repeat(40)]);
  assertEquals(cleanExcluded('arachide'), []);
  assertEquals([cleanServings(4), cleanServings(0), cleanServings(13), cleanServings(2.5), cleanServings('4')], [4, null, null, null, null]);
  const outcome = parseRecipes(JSON.stringify({ recipes: [recipe([ing('banane', 'p1')])], refusal: '' }), PANTRY, [], { ...CONTEXT, servings: 6 });
  assert(outcome.ok);
  assertEquals(outcome.value.recipes[0].servings, 6);
});

Deno.test('végétarien : produits laitiers, œufs et miel toujours permis, sauf dans un nom qui contient autre chose', () => {
  for (const name of ['Crème fraîche', 'Beurre', 'beurre doux', 'Lait entier', 'Œufs', "Jaunes d'œufs", 'Yaourt grec', 'Miel', 'Heavy cream', 'Nata para montar', 'Huevos']) {
    assert(isDietException(name, 'vegetarian'), name);
  }
  for (const name of ["Beurre d'anchois", 'Fond de veau au beurre', 'Crème de crabe', 'Lardons', 'Bouillon de poulet']) {
    assert(!isDietException(name, 'vegetarian'), name);
  }
  assert(!isDietException('Beurre', 'vegan'));
  const flagged = recipe([ing('crème fraîche', 'p1', ['vegetarian']), ing('beurre', 'missing', ['vegetarian'])]);
  assertEquals(dietViolations(flagged, ['vegetarian']), []);
});

Deno.test('produits laitiers, œufs et miel : acceptés seulement pour le régime végétarien', () => {
  const animal = ['Crème fraîche', 'Beurre doux', 'Lait entier', 'Œufs', 'Yaourt nature', 'Miel', 'Heavy cream', 'Huevos'];
  for (const name of animal) {
    assert(isDietException(name, 'vegetarian'), `végétarien : ${name}`);
    assert(!isDietException(name, 'vegan'), `vegan : ${name}`);
  }
  for (const name of ['Crème fraîche', 'Beurre doux', 'Lait entier', 'Yaourt nature', 'Heavy cream']) {
    assert(!isDietException(name, 'dairy-free'), `sans lactose : ${name}`);
  }
  // Mêmes ingrédients signalés par le modèle : écartés en vegan et sans lactose, gardés en végétarien
  const flagged = recipe([ing('crème fraîche', 'p1', ['vegetarian', 'vegan', 'dairy-free']), ing('miel', 'missing', ['vegetarian', 'vegan'])]);
  assertEquals(dietViolations(flagged, ['vegetarian']), []);
  assertEquals(dietViolations(flagged, ['vegan']), ['crème fraîche (vegan)', 'miel (vegan)']);
  assertEquals(dietViolations(flagged, ['dairy-free']), ['crème fraîche (dairy-free)']);
  assertEquals(dietViolations(flagged, ['vegetarian', 'vegan']), ['crème fraîche (vegan)', 'miel (vegan)']);
});

Deno.test('à acheter : sans sel, poivre, huile ni eau, avec ou sans sélection', () => {
  const pantry = buildPantry([{ id: 'a', name: 'tomates', quantity: '', days_left: 3, kind: 'ingredient' }]);
  const raw = recipe([ing('tomates', 'p1'), ing('sel', 'missing'), ing("huile d'olive", 'missing'), ing('eau', 'missing'), ing('poivre noir', 'missing'), ing('oignon', 'missing')]);
  const result = toRecipe(raw, pantry, { mealType: 'dinner', cuisine: 'any', difficulty: 'easy', dietary: [] });
  assertEquals(result.missing_ingredients, ['oignon']);
});

Deno.test('repères internes retirés des textes affichés : (p10), (buy), [URGENT…], pantry_id', () => {
  assertEquals(withoutInternalCodes('Serve with Greek yogurt (p10) and grated cheese (buy).'), 'Serve with Greek yogurt and grated cheese.');
  assertEquals(withoutInternalCodes('Ajoute le riz [URGENT : expire demain] (p3, p4).'), 'Ajoute le riz.');
  assertEquals(withoutInternalCodes('Use p2 for the sauce.'), 'Use for the sauce.');
  // Rien d'autre n'est touché
  assertEquals(withoutInternalCodes('Cuis 2 minutes (jusqu’à ce que ce soit doré).'), 'Cuis 2 minutes (jusqu’à ce que ce soit doré).');
  const result = parse([recipe([ing('banane', 'p1')], { tips: ['Remplace la banane (p1) par une pomme.'], instructions: ['Écrase la banane (p1).'] })]);
  assert(result.ok);
  const [r] = result.value.recipes;
  assertEquals([r.tips[0], r.instructions[0]], ['Remplace la banane par une pomme.', 'Écrase la banane.']);
  assert(![r.title, r.description, ...r.instructions, ...r.tips].some(hasInternalCodes));
});
