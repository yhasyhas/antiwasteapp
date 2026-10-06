// Variété au sein d'une génération (variety.ts). Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { cleanKind, DISH_TYPES, TECHNIQUES } from './kinds.ts';
import { closeness, titleWithKind, tooCloseIndexes, varietyPass, withoutKind } from './variety.ts';
import { buildPantry, buildRecipeSchema, type Recipe } from './recipes.ts';
import { buildPrompts, dishExamples } from './prompt.ts';

function recipe(title: string, names: string[], dish_type: Recipe['dish_type'], technique: Recipe['technique']): Recipe {
  return {
    title, description: '', difficulty: 'easy', prep_time: 10, cook_time: 20, total_time: 30, servings: 2, meal_type: 'dinner', cuisine: 'east_africa',
    dietary_tags: [], ingredients_used: names.map((name) => ({ name, quantity: '1', unit: '', pantry_id: null })),
    ingredients_from_list: [], missing_ingredients: [], instructions: ['…'], tips: [], image_prompt: '', dish_type, technique,
  };
}

// Cas relevé sur téléphone (cuisine d'Afrique de l'Est) : même ragoût, l'un au poivron, l'autre à la tomate
const stewPepper = recipe('Ragoût de bœuf au poivron', ['bœuf', 'oignon', 'ail', 'poivron', 'gingembre', 'huile', 'sel'], 'stew', 'simmer');
const stewTomato = recipe('Ragoût de bœuf à la tomate', ['bœuf', 'oignons', 'ail', 'tomates', 'gingembre', 'huile', 'sel'], 'stew', 'simmer');
const grilled = recipe('Brochettes de bœuf grillées', ['bœuf', 'oignon', 'citron', 'piment'], 'grill', 'grill');
const salad = recipe('Salade de haricots', ['haricots rouges', 'oignon rouge', 'tomate', 'coriandre'], 'salad', 'no_cook');

Deno.test('variété : valeurs du modèle ramenées à la liste', () => {
  assertEquals(cleanKind('Stir-Fry', DISH_TYPES), 'stir_fry');
  assertEquals(cleanKind(' oven dish ', DISH_TYPES), 'oven_dish');
  assertEquals(cleanKind('mijoté', TECHNIQUES), 'other');
  assertEquals(cleanKind(undefined, TECHNIQUES), 'other');
});

Deno.test('variété : même plat à un ingrédient près, trop proche ; autre type de plat, non', () => {
  assert(closeness(stewPepper, stewTomato).close, 'ragoût au poivron et ragoût à la tomate');
  assert(!closeness(stewPepper, grilled).close, 'ragoût et brochettes, même viande');
  assert(!closeness(stewTomato, salad).close, 'ragoût et salade');
  // Petit garde-manger : une soupe et un sauté avec les mêmes ingrédients restent deux plats différents
  assert(!closeness(stewPepper, { ...stewTomato, dish_type: 'stir_fry', technique: 'saute' }).close, 'mêmes ingrédients, types différents');
  // Type « other » jamais comparé ; mais presque les mêmes ingrédients suffisent
  const sameOther = recipe('Bœuf aux oignons', ['bœuf', 'oignon', 'ail', 'gingembre', 'poivron'], 'other', 'other');
  assert(!closeness({ ...grilled, dish_type: 'other', technique: 'other' }, { ...stewTomato, dish_type: 'other', technique: 'other' }).sameKind);
  assert(closeness(stewPepper, sameOther).close, 'mêmes ingrédients, types non déclarés');
  // Basiques (sel, huile…) non comptés
  assert(closeness(recipe('A', ['sel', 'huile', 'poivre', 'riz'], 'rice_or_grain', 'boil'), recipe('B', ['sel', 'huile', 'poivre', 'lentilles'], 'soup', 'simmer')).overlap === 0);
});

Deno.test('variété : la première recette de chaque groupe est gardée', () => {
  assertEquals(tooCloseIndexes([stewPepper, grilled, stewTomato]), [2]);
  assertEquals(tooCloseIndexes([stewPepper, grilled, salad]), []);
});

Deno.test('variété : recette trop proche remplacée, gardée si la nouvelle l’est encore, pas de demande trop tard', async () => {
  let asked: { count: number; keep: string[] } | null = null;
  const replaced = await varietyPass([stewPepper, stewTomato, grilled], {
    latestStart: Date.now() + 10_000,
    request: (count, keep) => {
      asked = { count, keep: keep.map((r) => r.title) };
      return Promise.resolve([salad]);
    },
  });
  assertEquals(asked, { count: 1, keep: ['Ragoût de bœuf au poivron', 'Brochettes de bœuf grillées'] });
  assertEquals(replaced.recipes.map((r) => r.title), ['Ragoût de bœuf au poivron', 'Salade de haricots', 'Brochettes de bœuf grillées']);
  assertEquals(replaced.report, { close: ['Ragoût de bœuf à la tomate'], replaced: ['Ragoût de bœuf à la tomate'], kept: [] });

  const stillClose = await varietyPass([stewPepper, stewTomato], {
    latestStart: Date.now() + 10_000,
    request: () => Promise.resolve([recipe('Ragoût de bœuf aux carottes', ['bœuf', 'oignon', 'ail', 'gingembre', 'carotte'], 'stew', 'simmer')]),
  });
  assertEquals(stillClose.recipes, [stewPepper, stewTomato]);
  assertEquals(stillClose.report.kept, ['Ragoût de bœuf à la tomate']);

  let called = false;
  const late = await varietyPass([stewPepper, stewTomato], {
    latestStart: Date.now() - 1,
    request: () => {
      called = true;
      return Promise.resolve([salad]);
    },
  });
  assert(!called, 'aucune demande après l’échéance');
  assertEquals(late.report.kept, ['Ragoût de bœuf à la tomate']);

  const failed = await varietyPass([stewPepper, stewTomato], { latestStart: Date.now() + 10_000, request: () => Promise.reject(new Error('panne')) });
  assertEquals(failed.recipes.length, 2);
});

Deno.test('variété : schéma, consigne v4.1 et champs retirés avant l’envoi à l’app', () => {
  const pantry = buildPantry([{ id: 'p1', name: 'bœuf' }]);
  const schema = buildRecipeSchema(pantry, []) as any;
  const required: string[] = schema.properties.recipes.items.required;
  assert(required.includes('dish_type') && required.includes('technique'));
  const base = { pantryText: 'A : bœuf', count: 3, language: 'fr', mealType: 'dinner', difficulty: 'easy', maxCookTime: 60, cuisine: 'any' as const, dietary: [], hasStrictDiet: false, hasUrgent: false, hasLeftovers: false, mode: 'standard' as const, selection: false, otherPantry: [], excluded: [], servings: null };
  assert(buildPrompts({ ...base, version: 'v4.1' }).prompt.includes('l’une au poivron, l’autre à la tomate'));
  assert(!buildPrompts({ ...base, version: 'v4' }).prompt.includes('l’une au poivron'));
  // Exemples de types tirés au hasard : différents, ordre variable
  const first = dishExamples(5, () => 0);
  const last = dishExamples(5, () => 0.99);
  assertEquals(new Set(first).size, 5);
  assert(first[0] !== last[0], 'ordre variable');
  // Recettes à ne pas refaire : type et technique joints au titre
  assertEquals(titleWithKind(stewPepper), 'Ragoût de bœuf au poivron (stew, simmer)');
  assertEquals(titleWithKind({ title: 'Ancienne', dish_type: undefined, technique: undefined }), 'Ancienne');
  const sent = withoutKind(stewPepper);
  assert(!('dish_type' in sent) && !('technique' in sent));
});
