import { assert, assertEquals } from 'jsr:@std/assert@1';
import { CRITERIA, JUDGE_SCHEMA, judgePrompt } from './judge.ts';

const situation = {
  id: 'cas', language: 'fr', cuisine: 'maghreb', meal_type: 'dinner', dietary: ['vegetarian'], excluded: ['arachide'],
  mode: 'leftovers', selection: true, other_pantry: ['Poulet'],
  pantry: [{ name: 'Reste de couscous', kind: 'dish', days_left: 1 }, { name: 'Carottes', quantity: '3' }],
};

Deno.test('juge : chaque critère de la grille est demandé et noté', () => {
  const prompt = judgePrompt(situation, [{ title: 'Galettes', ingredients_used: [{ name: 'Reste de couscous', quantity: '1', unit: 'portion' }], instructions: ['…'] }]);
  for (const criterion of CRITERIA) assert(prompt.includes(`- ${criterion} :`), criterion);
  const scores = (JUDGE_SCHEMA.properties.recipes.items.properties.scores as { required: string[] }).required;
  assertEquals(scores, [...CRITERIA]);
});

Deno.test('juge : la situation demandée est décrite (cuisine, régimes, exclusions, restes, sélection)', () => {
  const prompt = judgePrompt(situation, []);
  for (const text of ['maghreb', 'vegetarian', 'arachide', 'transformer les restes', 'réservés, à ne pas utiliser : Poulet', 'Reste de couscous [reste de plat déjà cuisiné] [à utiliser vite]']) {
    assert(prompt.includes(text), text);
  }
});
