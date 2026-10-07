// « Mes basiques » : reconnaissance en trois langues, liste nettoyée, effet sur les achats, le prompt et l'anti-répétition.
// Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { basicsForPrompt, cleanBasics, DEFAULT_BASICS, isBasicFor } from './basics.ts';
import { buildPantry, toRecipe } from './recipes.ts';
import { buildPrompts } from './prompt.ts';
import { mergeTitles } from './titles.ts';

Deno.test('basiques par défaut : sel, poivre, huile, eau en trois langues', () => {
  for (const name of ['sel', 'Poivre noir', "huile d'olive", 'eau', 'Salt', 'black pepper', 'aceite de oliva', 'agua']) assert(isBasicFor(name, DEFAULT_BASICS), name);
  for (const name of ['ail', 'cumin', "selle d'agneau", 'poivron rouge', 'red bell pepper', 'green peppers', 'tomate']) assert(!isBasicFor(name, DEFAULT_BASICS), name);
});

Deno.test('basiques choisis : identifiants reconnus en trois langues, épices courantes, noms libres', () => {
  const basics = ['salt', 'garlic', 'onion', 'spices', 'sauce soja'];
  for (const name of ['gousses d’ail', 'garlic cloves', 'dientes de ajo', 'oignons', 'cebolla', 'cumin moulu', 'ground cinnamon', 'pimentón', 'feuilles de laurier', 'clous de girofle', 'Sauce soja salée']) {
    assert(isBasicFor(name, basics), name);
  }
  // Poivre retiré de la liste : plus un basique ; beurre de cacahuète jamais
  assert(!isBasicFor('poivre', basics));
  assert(!isBasicFor('beurre de cacahuète', ['butter']));
  assert(isBasicFor('beurre doux', ['butter']));
});

Deno.test('basiques : liste nettoyée (doublons, longueur, nombre) ; absente : liste par défaut', () => {
  assertEquals(cleanBasics(undefined), DEFAULT_BASICS);
  assertEquals(cleanBasics('sel'), DEFAULT_BASICS);
  assertEquals(cleanBasics([]), []);
  assertEquals(cleanBasics(['salt', ' salt ', 'Sauce soja', 'sauces soja', 42, '']), ['salt', 'Sauce soja']);
  assertEquals(cleanBasics([`x${'y'.repeat(60)}`])[0].length, 40);
  assertEquals(cleanBasics(Array.from({ length: 40 }, (_, i) => `épice ${i}`)).length, 30);
});

Deno.test('basiques : jamais comptés comme achats', () => {
  const pantry = buildPantry([{ id: 'a', name: 'poulet', quantity: '', days_left: 3, kind: 'ingredient' }]);
  const ing = (name: string, pantry_id: string) => ({ name, quantity: '1', unit: '', pantry_id, diet_violations: [] });
  const raw = {
    title: 'Poulet', description: '', difficulty: 'easy', prep_time: 5, cook_time: 20, total_time: 25, servings: 2, dietary_tags: [],
    ingredients: [ing('poulet', 'p1'), ing('ail', 'missing'), ing('cumin', 'missing'), ing('sel', 'missing'), ing('citron', 'missing')],
    instructions: ['Cuisez.'], tips: [], suggestion: '', image_prompt: 'x',
  };
  const context = { mealType: 'dinner', cuisine: 'any', difficulty: 'easy', dietary: [] };
  assertEquals(toRecipe(raw, pantry, context).missing_ingredients, ['ail', 'cumin', 'citron']);
  assertEquals(toRecipe(raw, pantry, { ...context, basics: ['salt', 'garlic', 'spices'] }).missing_ingredients, ['citron']);
});

Deno.test('basiques : écrits dans le prompt', () => {
  assertEquals(basicsForPrompt(['salt', 'garlic', 'sauce soja']), 'sel, ail, sauce soja');
  const options = {
    pantryText: '- p1 : poulet', count: 2, language: 'fr', mealType: 'dinner', difficulty: 'easy', maxCookTime: 60, cuisine: 'any' as const,
    dietary: [], hasStrictDiet: false, hasUrgent: false, hasLeftovers: false, mode: 'standard' as const, selection: false, otherPantry: [],
    excluded: [], servings: null, version: 'v4.1' as const,
  };
  assert(buildPrompts({ ...options, basicsText: 'sel, ail, sauce soja' }).system.includes('jamais comptés comme achats : sel, ail, sauce soja.'));
  assert(buildPrompts(options).system.includes('jamais comptés comme achats : sel, poivre, huile, eau.'));
});

Deno.test('anti-répétition : recettes « Pas pour nous » en tête, sans doublon, 30 au plus', () => {
  const titles = mergeTitles(['Soupe ratée', ' Soupe ratée '], ['Mafé', null], ['Soupe ratée', ...Array.from({ length: 40 }, (_, i) => `R${i}`)]);
  assertEquals(titles.slice(0, 3), ['Soupe ratée', 'Mafé', 'R0']);
  assertEquals(titles.length, 30);
});
