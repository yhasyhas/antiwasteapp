// Évaluation des recettes (phase 9) : copie de generate-recipes réservée aux essais, jamais appelée par l'app.
// Accès par l'en-tête x-eval-key égal à la clé secrète (script scripts/recipe-eval/run.mjs) ; aucun quota
// d'utilisateur compté, aucune alerte de quota envoyée.
//
//   { action: "generate", prompt_version, ingredients, preferences, mode, selection, other_pantry,
//     providers?, model?, library?, recent_titles?, safety? }
//     même génération que generate-recipes (mêmes fournisseurs, même lecture de la réponse, une demande de plus
//     si des recettes sont écartées), avec la version du prompt demandée (v1 : celle de l'app). En v4 : plats de
//     référence tirés au hasard (library: false pour s'en passer), titres récents à ne pas reproposer, et
//     contrôle de sécurité (safety.ts) qui fait corriger, puis écarte, les recettes en défaut.
//     model : un autre modèle du fournisseur nommé dans providers (comparaison de modèles)
//   { action: "models" } : modèles disponibles chez les deux fournisseurs (choix du juge)
//   { action: "judge", case, recipes, judge_model, judge_provider }
//     notes d'un modèle juge (Gemini) sur la grille d'évaluation, pour chaque recette et pour la diversité
//   { action: "variety", generations, library_names } : plats différents sur plusieurs générations (juge)
//   { action: "quota", model? } : le quota du jour de Groq laisse-t-il passer une génération ? (≈ 10 tokens)
//   { action: "recent_titles" } : vérifie la lecture des titres récents (nombres seulement, aucun titre)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import {
  buildOtherPantry,
  buildPantry,
  buildRecipeSchema,
  cleanExcluded,
  cleanServings,
  type GenerationMode,
  leftoverItems,
  MISSING,
  type Pantry,
  pantryForPrompt,
  parseRecipes,
  type Recipe,
  recipeCount,
  strictDietsOf,
  urgentItems,
} from '../generate-recipes/recipes.ts';
import { buildPrompts, CUISINES, type Cuisine, PROMPT_VERSIONS, type PromptVersion } from '../generate-recipes/prompt.ts';
import { sampleDishes } from '../generate-recipes/library.ts';
import { resolveCuisine } from '../generate-recipes/cuisines.ts';
import { type SafetyReport, safetyPass } from '../generate-recipes/safetyPass.ts';
import { recentTitles } from '../generate-recipes/history.ts';
import { JUDGE_SCHEMA, judgePrompt, VARIETY_SCHEMA, varietyPrompt } from './judge.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_RECIPE_MODEL = Deno.env.get('GEMINI_RECIPE_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const RECIPE_PROVIDERS = Deno.env.get('RECIPE_PROVIDERS') || 'groq,gemini';
const MAX_OUTPUT_TOKENS = 8000;

// v5 : v4 et ses ajustements (évaluation des régions et de la variété)
const v4Family = (version: string) => version === 'v4' || version === 'v5' || version === 'v4.1';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function providersFor(order: string | undefined, model?: string): AiProvider[] {
  // Autre modèle (comparaison) : raisonnement réglé seulement pour gpt-oss, comme dans l'app
  const groqModel = model && order?.startsWith('groq') ? model : GROQ_MODEL;
  const geminiModel = model && order?.startsWith('gemini') ? model : GEMINI_RECIPE_MODEL;
  const all = orderProviders([
    groqProvider({ apiKey: GROQ_API_KEY, model: groqModel, timeoutMs: 60_000, ...(groqModel.includes('gpt-oss') && { reasoningEffort: 'low' as const }) }),
    geminiProvider({ apiKey: GEMINI_API_KEY, model: geminiModel, timeoutMs: 90_000, thinkingLevel: 'low' }),
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
  const legacyCuisine = (CUISINES as readonly string[]).includes(preferences.cuisine || '');
  const cuisine: Cuisine = legacyCuisine ? preferences.cuisine : 'any';
  // Découpage de la phase 9 (v4) : région, famille ou « Autre cuisine… » (cuisineOther) ; les 7 valeurs actuelles
  // de l'app gardent leur traitement
  const resolved = legacyCuisine || !v4Family(version) ? { kind: 'any' as const } : resolveCuisine(preferences.cuisine, preferences.cuisineOther);
  const difficulty = preferences.difficulty || 'easy';
  const count = recipeCount(pantry.items.length);
  const excluded = cleanExcluded(preferences.excluded);
  const servings = cleanServings(preferences.servings);
  const context = { mealType: preferences.mealType || 'dinner', cuisine: resolved.kind === 'regions' ? resolved.id : resolved.kind === 'other' ? 'other' : cuisine, difficulty, dietary, maxRecipes: count, mode, otherPantry, excluded, servings };
  const v4 = v4Family(version);
  // Plats de référence : seulement avec une cuisine précise ; library: false pour mesurer sans
  const examples = !v4 || body.library === false || resolved.kind === 'other' ? []
    : sampleDishes(cuisine, { mealType: context.mealType, diets, ...(resolved.kind === 'regions' && { regions: resolved.regions }),
      // library: 'pantry' : la moitié des exemples partage un ingrédient avec le garde-manger, et chaque recette
      // s'appuie sur un exemple différent (variante mesurée par variety.mjs)
      ...((body.library === 'pantry' || (version === 'v5' && body.library !== true)) && { pantry: pantry.items.map((item) => item.name) }) });
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
    examples,
    examplesHint: body.library === 'pantry',
    ...(resolved.kind === 'regions' && { cuisineChoice: { label: resolved.prompt } }),
    ...(resolved.kind === 'other' && { cuisineChoice: { other: resolved.text } }),
    recentTitles: Array.isArray(body.recent_titles) ? body.recent_titles.filter((t: unknown) => typeof t === 'string').slice(0, 30) : [],
  };
  const providers = providersFor(body.providers, typeof body.model === 'string' && body.model ? body.model : undefined);
  const log: AttemptLog[] = [];
  const schema = version !== 'v1' ? buildRecipeSchema(pantry, diets, 'Unité abrégée, dans la langue de la recette') : buildRecipeSchema(pantry, diets);
  const request = (prompts: { system: string; prompt: string }) => ({
    system: prompts.system,
    prompt: prompts.prompt,
    schema,
    schemaName: 'recipes',
    temperature: 0.8,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });
  const prompts = buildPrompts(promptOptions);
  const result = await runWithFallback(providers, request(prompts),
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

  // Contrôle de sécurité (v4 et suivantes, ou safety: true) : même code que generate-recipes (safetyPass.ts)
  let safety: Omit<SafetyReport, 'correction'> & { checked: boolean } = { checked: false, first: [], corrected: [], dropped: [] };
  if (body.safety ?? v4) {
    const pass = await safetyPass(recipes, { pantry, pantryText: promptOptions.pantryText, diets, context, providers, request: request(prompts), log, t0, label: 'generate-recipes-eval:correction' });
    recipes = pass.recipes;
    safety = { checked: true, first: pass.report.first, corrected: pass.report.corrected, dropped: pass.report.dropped };
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
    safety,
    // Plats de référence envoyés au modèle pour cette génération
    examples: examples.map((dish) => ({ name: dish.name, region: dish.region })),
    provider: result.provider.name,
    model: result.provider.model,
    // Alias du garde-manger envoyés au modèle (vérifications du script)
    pantry: [...pantry.aliasOf.entries()].map(([alias, item]) => ({ alias, ...item })),
    ms: Date.now() - t0,
    attempts: log,
  });
}

async function askJudge(model: string, prompt: string, schema: Record<string, unknown>, isValid: (value: any) => boolean) {
  const t0 = Date.now();
  const provider = geminiProvider({ apiKey: GEMINI_API_KEY, model, timeoutMs: 120_000, thinkingLevel: 'medium' });
  const log: AttemptLog[] = [];
  const result = await runWithFallback([provider], { prompt, schema, schemaName: 'judgement', temperature: 0, maxOutputTokens: 12000 }, (text) => {
    try {
      const value = JSON.parse(text);
      return isValid(value) ? { ok: true, value } : { ok: false, failure: 'notes absentes', code: 'invalid_response' };
    } catch {
      return { ok: false, failure: 'JSON invalide', code: 'invalid_response' };
    }
  }, { label: 'generate-recipes-eval:judge', log, t0 });
  if (!result.ok) return json({ error: result.reason, failure: result.failure, attempts: log }, 502);
  return json({ ...result.value, judge_model: model, ms: Date.now() - t0, usage: log.at(-1)?.usage ?? null });
}

const judgeModel = (body: any) => (typeof body.judge_model === 'string' && body.judge_model ? body.judge_model : Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite');

// Modèles disponibles chez les deux fournisseurs (choix du juge), sans les clés
async function models() {
  const groq = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } }).then((r) => r.json()).catch(() => null);
  const gemini = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GEMINI_API_KEY } }).then((r) => r.json()).catch(() => null);
  return json({
    groq: (groq?.data ?? []).map((m: any) => m.id).sort(),
    gemini: (gemini?.models ?? []).map((m: any) => String(m.name).replace('models/', '')).sort(),
  });
}

// Quota du jour de Groq (fenêtre glissante de 24 h) : une requête minuscule qui réserve `reserve` tokens ;
// refusée (429) si le reste du jour est plus petit. Le message de refus donne la consommation des 24 h.
async function quota(body: any) {
  const model = typeof body.model === 'string' && body.model ? body.model : GROQ_MODEL;
  const reserve = Math.min(Number(body.reserve) || 6000, 7500);
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Réponds OK.' }], max_completion_tokens: reserve, ...(model.includes('gpt-oss') && { reasoning_effort: 'low' }) }),
  });
  const text = await response.text();
  if (response.ok) return json({ model, available: true, reserve, usage: JSON.parse(text).usage ?? null });
  const numbers = text.match(/Limit (\d+), Used (\d+), Requested (\d+)/);
  return json({
    model,
    available: false,
    status: response.status,
    per_day: /TPD|per day/.test(text),
    limit: numbers ? Number(numbers[1]) : null,
    used: numbers ? Number(numbers[2]) : null,
    retry_in: text.match(/try again in ([\dhms.]+)/)?.[1] ?? null,
  });
}

Deno.serve(withCors(async (req: Request) => {
  if (!SUPABASE_SECRET_KEY || req.headers.get('x-eval-key') !== SUPABASE_SECRET_KEY) return json({ error: 'unauthorized' }, 401);
  try {
    const body = await req.json();
    if (body.action === 'generate') return await generate(body);
    if (body.action === 'judge') {
      return await askJudge(judgeModel(body), judgePrompt(body.case, body.recipes), JUDGE_SCHEMA, (value) => Array.isArray(value?.recipes));
    }
    if (body.action === 'variety') {
      return await askJudge(judgeModel(body), varietyPrompt(body.cuisine ?? 'any', body.generations ?? [], body.library_names ?? []), VARIETY_SCHEMA, (value) => Array.isArray(value?.recipes));
    }
    if (body.action === 'models') return await models();
    if (body.action === 'quota') return await quota(body);
    if (body.action === 'recent_titles') {
      // Utilisateur qui a la recette la plus récente : nombres seulement, aucun titre ni identifiant renvoyé
      const latest = await fetch(`${SUPABASE_URL}/rest/v1/recipes?select=user_id&order=created_at.desc&limit=1`, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` } }).then((r) => r.json());
      const titles = latest?.[0]?.user_id ? await recentTitles(latest[0].user_id) : [];
      return json({ titles: titles.length, distinct: new Set(titles).size, longest: Math.max(0, ...titles.map((t) => t.length)) });
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    return json({ error: 'exception', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
