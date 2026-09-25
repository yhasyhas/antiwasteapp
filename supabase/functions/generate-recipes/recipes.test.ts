// Tests de generate-recipes sans appel réseau : alias du garde-manger, schéma, lecture de la réponse,
// correspondance des identifiants, régimes et exceptions.
// Lancement : deno test --no-config supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  buildPantry,
  buildRecipeSchema,
  isDietException,
  MAX_PANTRY_ITEMS,
  MISSING,
  pantryForPrompt,
  parseRecipes,
  recipeCount,
  strictDietsOf,
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

Deno.test('correspondance des identifiants : alias → uuid et nom du garde-manger ; missing → null', () => {
  const result = parse([recipe([ing('Bananes mûres', 'p1'), ing('lait', 'p2'), ing('cannelle', MISSING)])]);
  assert(result.ok);
  const [r] = result.value.recipes;
  assertEquals(r.ingredients_used.map((i) => [i.name, i.pantry_id]), [['banane', 'uuid-banane'], ['lait', 'uuid-lait'], ['cannelle', null]]);
  assertEquals(r.ingredients_from_list, ['banane', 'lait']);
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
  assertEquals([1, 2, 3, 5, 6, 20].map(recipeCount), [1, 1, 2, 2, 3, 3]);
});
