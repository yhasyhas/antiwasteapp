// Évaluation des recettes (phase 9) : copie de generate-recipes réservée aux essais, jamais appelée par l'app.
// Accès par l'en-tête x-eval-key égal à la clé secrète (script scripts/recipe-eval/run.mjs) ; aucun quota
// d'utilisateur compté, aucune alerte de quota envoyée.
//
//   { action: "generate", prompt_version, ingredients, preferences, mode, selection, other_pantry }
//     même génération que generate-recipes (mêmes fournisseurs, même lecture de la réponse, une demande de plus
//     si des recettes sont écartées), avec la version du prompt demandée (v1 : celle de l'app)
//   { action: "models" } : modèles disponibles chez les deux fournisseurs (choix du juge)
//   { action: "judge", case, recipes, judge_model, judge_provider }
//     notes d'un modèle juge (Gemini) sur la grille d'évaluation, pour chaque recette et pour la diversité

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_SECRET_KEY } from '../_shared/keys.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import {
  buildOtherPantry,
  buildPantry,
  buildRecipeSchema,
  cleanExcluded,
  cleanServings,
  type GenerationMode,
  leftoverItems,
  pantryForPrompt,
  parseRecipes,
  recipeCount,
  strictDietsOf,
  urgentItems,
} from '../generate-recipes/recipes.ts';
import { buildPrompts, CUISINES, type Cuisine, PROMPT_VERSIONS, type PromptVersion } from '../generate-recipes/prompt.ts';
import { JUDGE_SCHEMA, judgePrompt } from './judge.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_RECIPE_MODEL = Deno.env.get('GEMINI_RECIPE_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const RECIPE_PROVIDERS = Deno.env.get('RECIPE_PROVIDERS') || 'groq,gemini';
const MAX_OUTPUT_TOKENS = 8000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function providersFor(order: string | undefined): AiProvider[] {
  const all = orderProviders([
    groqProvider({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, timeoutMs: 40_000, reasoningEffort: 'low' }),
    geminiProvider({ apiKey: GEMINI_API_KEY, model: GEMINI_RECIPE_MODEL, timeoutMs: 45_000, thinkingLevel: 'low' }),
  ], order || RECIPE_PROVIDERS);
  // Ordre imposé : seulement les fournisseurs nommés (mesure d'un seul modèle)
  return order ? all.filter((provider) => order.split(',').includes(provider.name)) : all;
}

async function generate(body: any) {
  const t0 = Date.now();
  const version: PromptVersion = PROMPT_VERSIONS.includes(body.prompt_version) ? body.prompt_version : 'v1';
  const preferences = body.preferences ?? {};
  const mode: GenerationMode = body.mode === 'leftovers' ? 'leftovers' : 'standard';
  const selection = body.selection === true;
  const otherPantry = selection ? buildOtherPantry(body.other_pantry) : [];
  const language = (preferences.language || 'fr').substring(0, 2).toLowerCase();
  const pantry = buildPantry(body.ingredients);
  if (pantry.items.length === 0) return json({ error: 'no_ingredients' }, 400);

  const dietary = Array.isArray(preferences.dietary) ? preferences.dietary : [];
  const diets = strictDietsOf(dietary);
  const cuisine: Cuisine = (CUISINES as readonly string[]).includes(preferences.cuisine || '') ? preferences.cuisine : 'any';
  const difficulty = preferences.difficulty || 'easy';
  const count = recipeCount(pantry.items.length);
  const excluded = cleanExcluded(preferences.excluded);
  const servings = cleanServings(preferences.servings);
  const context = { mealType: preferences.mealType || 'dinner', cuisine, difficulty, dietary, maxRecipes: count, mode, otherPantry, excluded, servings };
  const promptOptions = {
    pantryText: pantryForPrompt(pantry),
    count,
    language,
    mealType: context.mealType,
    difficulty,
    maxCookTime: preferences.maxCookTime || 60,
    cuisine,
    dietary,
    hasStrictDiet: diets.length > 0,
    hasUrgent: urgentItems(pantry).length > 0,
    hasLeftovers: leftoverItems(pantry).length > 0,
    mode,
    selection,
    otherPantry,
    excluded,
    servings,
    version,
  };
  const providers = providersFor(body.providers);
  const log: AttemptLog[] = [];
  const request = (prompts: { system: string; prompt: string }) => ({
    system: prompts.system,
    prompt: prompts.prompt,
    schema: version !== 'v1' ? buildRecipeSchema(pantry, diets, 'Unité abrégée, dans la langue de la recette') : buildRecipeSchema(pantry, diets),
    schemaName: 'recipes',
    temperature: 0.8,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  const result = await runWithFallback(providers, request(buildPrompts(promptOptions)),
    (text) => parseRecipes(text, pantry, diets, context), { label: 'generate-recipes-eval', log, t0 });
  if (!result.ok) return json({ error: result.reason, failure: result.failure, attempts: log }, 502);

  const first = result.value;
  let recipes = first.recipes;
  let retried = false;
  const missing = count - recipes.length;
  if (recipes.length > 0 && missing > 0 && first.invalid.length + first.dietaryRejections.length > 0) {
    retried = true;
    const second = await runWithFallback(providers, request(buildPrompts({ ...promptOptions, count: missing, avoidTitles: recipes.map((r) => r.title) })),
      (text) => parseRecipes(text, pantry, diets, { ...context, maxRecipes: missing }), { label: 'generate-recipes-eval', log, t0 });
    if (second.ok) {
      const titles = new Set(recipes.map((r) => r.title.toLowerCase()));
      recipes = [...recipes, ...second.value.recipes.filter((r) => !titles.has(r.title.toLowerCase()))].slice(0, count);
    }
  }
  return json({
    version,
    requested: count,
    recipes,
    // Recettes écartées par le serveur à la première demande (régime, hors sélection, mal formées…)
    invalid: first.invalid,
    dietary_rejections: first.dietaryRejections,
    refusal: first.refusal,
    retried,
    provider: result.provider.name,
    model: result.provider.model,
    // Alias du garde-manger envoyés au modèle (vérifications du script)
    pantry: [...pantry.aliasOf.entries()].map(([alias, item]) => ({ alias, ...item })),
    ms: Date.now() - t0,
    attempts: log,
  });
}

async function judge(body: any) {
  const t0 = Date.now();
  const model = typeof body.judge_model === 'string' && body.judge_model ? body.judge_model : Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
  const provider = geminiProvider({ apiKey: GEMINI_API_KEY, model, timeoutMs: 90_000, thinkingLevel: 'medium' });
  const log: AttemptLog[] = [];
  const result = await runWithFallback([provider], {
    prompt: judgePrompt(body.case, body.recipes),
    schema: JUDGE_SCHEMA,
    schemaName: 'judgement',
    temperature: 0,
    maxOutputTokens: 8000,
  }, (text) => {
    try {
      const value = JSON.parse(text);
      return Array.isArray(value?.recipes) ? { ok: true, value } : { ok: false, failure: 'notes absentes', code: 'invalid_response' };
    } catch {
      return { ok: false, failure: 'JSON invalide', code: 'invalid_response' };
    }
  }, { label: 'generate-recipes-eval:judge', log, t0 });
  if (!result.ok) return json({ error: result.reason, failure: result.failure, attempts: log }, 502);
  return json({ ...result.value, judge_model: model, ms: Date.now() - t0 });
}

// Modèles disponibles chez les deux fournisseurs (choix du juge), sans les clés
async function models() {
  const groq = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } }).then((r) => r.json()).catch(() => null);
  const gemini = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_API_KEY } }).then((r) => r.json()).catch(() => null);
  return json({
    groq: (groq?.data ?? []).map((m: any) => m.id).sort(),
    gemini: (gemini?.models ?? []).map((m: any) => String(m.name).replace('models/', '')).sort(),
  });
}

Deno.serve(withCors(async (req: Request) => {
  if (!SUPABASE_SECRET_KEY || req.headers.get('x-eval-key') !== SUPABASE_SECRET_KEY) return json({ error: 'unauthorized' }, 401);
  try {
    const body = await req.json();
    if (body.action === 'generate') return await generate(body);
    if (body.action === 'judge') return await judge(body);
    if (body.action === 'models') return await models();
    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    return json({ error: 'exception', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
