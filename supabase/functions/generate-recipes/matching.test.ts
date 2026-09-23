// deno test supabase/functions/generate-recipes/matching.test.ts
import { ingredientsMatch, sameIngredient } from './matching.ts';

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label} : obtenu ${actual}, attendu ${expected}`);
}

const MATCHES: Array<[string, string]> = [
  ['Banane', 'bananes mûres'],
  ['bananes', 'Banane'],
  ['Œufs', 'oeuf'],
  ['pomme de terre', 'pommes de terre'],
  ['tomate cerise', 'tomates cerises'],
  ['Poireaux', 'poireau'],
  ['CAROTTES', 'carotte râpée'],
  ['Crème fraîche', 'creme fraiche epaisse'],
  ['limón', 'limones'],
  ['Tomatoes', 'tomato'],
];

const NO_MATCH: Array<[string, string]> = [
  ['lait', 'laitue'],
  ['ail', 'caille'],
  ['riz', 'cerises'],
  ['banane', 'flocons d\'avoine'],
  ['sel', 'persil'],
];

Deno.test('ingrédients équivalents malgré pluriels, accents et majuscules', () => {
  for (const [a, b] of MATCHES) assertEquals(ingredientsMatch(a, b), true, `${a} / ${b}`);
});

Deno.test('ingrédients différents qui se ressemblent à l\'écrit', () => {
  for (const [a, b] of NO_MATCH) assertEquals(ingredientsMatch(a, b), false, `${a} / ${b}`);
});

Deno.test('dédoublonnage de missing_ingredients', () => {
  assertEquals(sameIngredient('Œuf', 'oeufs'), true, 'Œuf / oeufs');
  assertEquals(sameIngredient('lait', 'lait de coco'), false, 'lait / lait de coco');
});
