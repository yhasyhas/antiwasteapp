import { assertEquals } from 'jsr:@std/assert@1';
import type { AiProvider } from '../_shared/ai.ts';
import { buildPantry, parseRecipes } from './recipes.ts';
import { safetyPass } from './safetyPass.ts';

const pantry = buildPantry([{ id: 'chicken', name: 'Cuisses de poulet', quantity: '4' }]);
const context = { mealType: 'dinner', cuisine: 'any', difficulty: 'easy', dietary: [], maxRecipes: 3 };
const raw = (title: string, step: string) => ({
  title, description: '', difficulty: 'easy', prep_time: 10, cook_time: 20, total_time: 30, servings: 2,
  ingredients: [{ name: 'Cuisses de poulet', quantity: '4', unit: 'pièce', pantry_id: 'p1' }],
  instructions: [step], tips: [], suggestion: '', image_prompt: '',
});
const recipesOf = (...items: ReturnType<typeof raw>[]) => {
  const parsed = parseRecipes(JSON.stringify({ recipes: items, refusal: '' }), pantry, [], context);
  if (!parsed.ok) throw new Error(parsed.failure);
  return parsed.value.recipes;
};
// Fournisseur factice : renvoie toujours la même réponse, compte ses appels
const provider = (answer: unknown) => {
  const fake = { calls: 0 } as AiProvider & { calls: number };
  Object.assign(fake, { name: 'fake', model: 'fake', configured: true, call: async () => { fake.calls++; return { ok: true, text: JSON.stringify(answer) }; } });
  return fake;
};
const SAFE = 'Fais dorer le poulet 25 minutes à feu moyen, jusqu\'à ce que le jus soit clair (74 °C à cœur).';
const options = (providers: AiProvider[]) => ({ pantry, pantryText: '- p1 : Cuisses de poulet', diets: [], context, providers, request: { prompt: '', schema: {}, schemaName: 'recipes', temperature: 0, maxOutputTokens: 100 }, log: [], t0: Date.now(), label: 'test' });

Deno.test('safetyPass : rien à corriger, aucun appel', async () => {
  const fake = provider({});
  const result = await safetyPass(recipesOf(raw('Poulet doré', SAFE)), options([fake]));
  assertEquals([result.recipes.length, fake.calls, result.report.first.length], [1, 0, 0]);
});

Deno.test('safetyPass : recette corrigée gardée, recette toujours en défaut écartée', async () => {
  const flawed = recipesOf(raw('Poulet A', 'Fais dorer le poulet 25 minutes.'), raw('Poulet sûr', SAFE), raw('Poulet B', 'Fais dorer le poulet 20 minutes.'));
  // Correction : la première est corrigée, la seconde reste sans température ni signe
  const fake = provider({ recipes: [raw('Poulet A corrigé', SAFE), raw('Poulet B', 'Fais dorer le poulet 20 minutes.')], refusal: '' });
  const result = await safetyPass(flawed, options([fake]));
  assertEquals(result.recipes.map((r) => r.title), ['Poulet A corrigé', 'Poulet sûr']);
  assertEquals(result.report.corrected, ['Poulet A corrigé']);
  assertEquals(result.report.dropped.map((d) => d.title), ['Poulet B']);
  assertEquals(fake.calls, 1);
});
