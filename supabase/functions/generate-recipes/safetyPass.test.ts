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

Deno.test('safetyPass : plus de 3 ingrédients à acheter (hors basiques), corrigée puis gardée', async () => {
  const buying = (title: string, extra: string[]) => ({ ...raw(title, SAFE), ingredients: [...raw(title, SAFE).ingredients, ...['sel', 'huile', ...extra].map((name) => ({ name, quantity: '1', unit: 'pièce', pantry_id: 'missing' }))] });
  const fake = provider({ recipes: [buying('Poulet aux épices', ['cumin', 'gingembre'])], refusal: '' });
  const result = await safetyPass(recipesOf(buying('Poulet aux épices', ['cumin', 'gingembre', 'coriandre', 'citron'])), { ...options([fake]), maxPurchases: 3 });
  assertEquals(result.report.first[0].issues.map((i) => i.code), ['too_many_purchases']);
  assertEquals(result.recipes[0].missing_ingredients, ['cumin', 'gingembre']);
  // Sans limite (v4) : rien à corriger
  const free = await safetyPass(recipesOf(buying('Poulet aux épices', ['cumin', 'gingembre', 'coriandre', 'citron'])), options([provider({})]));
  assertEquals(free.report.first.length, 0);
});

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

// Fournisseur factice qui répond selon la demande : correction (« ne respectent pas les règles ») ou nouvelle recette
const byRequest = (correction: unknown, replacement: unknown, delayMs = 0) => {
  const fake = { calls: 0 } as AiProvider & { calls: number };
  Object.assign(fake, {
    name: 'fake', model: 'fake', configured: true,
    call: async (request: { prompt: string }) => {
      fake.calls++;
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { ok: true, text: JSON.stringify(request.prompt.includes('ne respectent pas les règles') ? correction : replacement) };
    },
  });
  return fake;
};
const replacementRequest = (count: number) => ({ prompt: `nouvelles recettes : ${count}`, schema: {}, schemaName: 'recipes', temperature: 0, maxOutputTokens: 100 });

Deno.test('safetyPass : recette toujours en défaut remplacée par une nouvelle recette demandée en parallèle', async () => {
  const fake = byRequest({ recipes: [raw('Poulet B', 'Fais dorer le poulet 20 minutes.')], refusal: '' }, { recipes: [raw('Poulet rôti', SAFE)], refusal: '' });
  const result = await safetyPass(recipesOf(raw('Poulet sûr', SAFE), raw('Poulet B', 'Fais dorer le poulet 20 minutes.')), { ...options([fake]), replacementRequest });
  assertEquals(result.recipes.map((r) => r.title), ['Poulet sûr', 'Poulet rôti']);
  assertEquals([result.report.dropped.map((d) => d.title), result.report.replaced], [['Poulet B'], ['Poulet rôti']]);
  // Correction et remplacement : deux appels, lancés ensemble
  assertEquals(fake.calls, 2);
});

Deno.test('safetyPass : défaut sans risque (four sans température) jamais écarté, même sans correction', async () => {
  const oven = 'Fais dorer le poulet 25 minutes au four, jusqu\'à ce que le jus soit clair (74 °C à cœur).';
  const fake = byRequest({ recipes: [], refusal: '' }, { recipes: [], refusal: '' });
  const result = await safetyPass(recipesOf(raw('Poulet au four', oven)), { ...options([fake]), replacementRequest });
  assertEquals(result.report.first[0].issues.map((i) => i.code), ['oven_celsius']);
  assertEquals(result.recipes.map((r) => r.title), ['Poulet au four']);
  // Pas de remplacement demandé pour un défaut sans risque
  assertEquals(fake.calls, 1);
});

Deno.test('safetyPass : échéance dépassée, les recettes déjà valides sont servies', async () => {
  const fake = byRequest({ recipes: [raw('Poulet B corrigé', SAFE)], refusal: '' }, { recipes: [raw('Poulet rôti', SAFE)], refusal: '' }, 300);
  const t = Date.now();
  const result = await safetyPass(recipesOf(raw('Poulet sûr', SAFE), raw('Poulet B', 'Fais dorer le poulet 20 minutes.')), { ...options([fake]), replacementRequest, deadline: Date.now() + 50 });
  assertEquals(result.recipes.map((r) => r.title), ['Poulet sûr']);
  assertEquals(result.report.dropped.map((d) => d.title), ['Poulet B']);
  assertEquals(Date.now() - t < 250, true);
});

Deno.test('safetyPass : four sans température non bloquant, mais température à cœur manquante bloquante', async () => {
  // Poulet au four sans °C du four ni à cœur : la correction échoue, la recette est écartée (pas gardée comme défaut du four)
  const step = 'Fais dorer le poulet 25 minutes au four, jusqu\'à ce que le jus soit clair.';
  const fake = byRequest({ recipes: [], refusal: '' }, { recipes: [], refusal: '' });
  const result = await safetyPass(recipesOf(raw('Poulet au four', step)), { ...options([fake]), replacementRequest });
  assertEquals(result.report.first[0].issues.map((i) => i.code), ['core_temperature', 'oven_celsius']);
  assertEquals([result.recipes.length, result.report.dropped.length], [0, 1]);
});
