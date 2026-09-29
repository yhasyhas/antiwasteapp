// Tests de la traduction des recettes sans appel réseau : texte source, structure identique à l'original.
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { parseTranslation, sourceOf, TRANSLATION_SCHEMA } from './translation.ts';

const row = {
  title: 'Riz sauté à la tomate',
  description: 'Un plat rapide.',
  suggestion: null,
  ingredients_used: [
    { name: 'riz', quantity: '200', unit: 'g', pantry_id: 'x' },
    { name: 'huile', quantity: '1', unit: 'cuillère à soupe' },
    'sel',
  ],
  ingredients_from_list: ['riz'],
  missing_ingredients: ['tomate'],
  instructions: ['Cuire le riz.', { text: 'Faire sauter.' }],
  tips: [],
};

const answer = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  title: 'Tomato fried rice',
  description: 'A quick dish.',
  suggestion: '',
  ingredients_used: [{ name: 'rice', unit: 'g' }, { name: 'oil', unit: 'tablespoon' }, { name: 'salt', unit: 'pinch' }],
  ingredients_from_list: ['rice'],
  missing_ingredients: ['tomato'],
  instructions: ['Cook the rice.', 'Stir-fry.'],
  tips: [],
  ...overrides,
});

Deno.test('texte source : anciennes recettes (étapes en objets, ingrédients en texte), sans quantités', () => {
  const source = sourceOf(row);
  assertEquals(source.instructions, ['Cuire le riz.', 'Faire sauter.']);
  assertEquals(source.ingredients_used, [{ name: 'riz', unit: 'g' }, { name: 'huile', unit: 'cuillère à soupe' }, { name: 'sel', unit: '' }]);
  assertEquals(source.suggestion, '');
});

Deno.test('schéma strict : tous les champs requis', () => {
  assertEquals(TRANSLATION_SCHEMA.additionalProperties, false);
  assertEquals(TRANSLATION_SCHEMA.required.length, Object.keys(TRANSLATION_SCHEMA.properties).length);
});

Deno.test('traduction acceptée ; unité vide de l\'original gardée vide', () => {
  const parsed = parseTranslation(answer(), sourceOf(row));
  assert(parsed.ok);
  assertEquals(parsed.value.title, 'Tomato fried rice');
  assertEquals(parsed.value.ingredients_used[2], { name: 'salt', unit: '' });
});

Deno.test('structure différente de l\'original : refusée', () => {
  assert(!parseTranslation(answer({ instructions: ['Cook everything.'] }), sourceOf(row)).ok);
  assert(!parseTranslation(answer({ ingredients_used: [{ name: 'rice', unit: 'g' }] }), sourceOf(row)).ok);
  assert(!parseTranslation(answer({ title: ' ' }), sourceOf(row)).ok);
  assert(!parseTranslation('pas du JSON', sourceOf(row)).ok);
});
