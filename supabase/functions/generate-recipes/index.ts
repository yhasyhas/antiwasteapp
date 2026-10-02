import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, dailyLimit, refundQuota } from '../_shared/quota.ts';
import { logUserQuota, reportInBackground, reportProviderQuota } from '../_shared/quotaAlerts.ts';
import { readSimulation } from '../_shared/simulate.ts';
import { withCors } from '../_shared/cors.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import {
  buildPantry,
  buildOtherPantry,
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
} from './recipes.ts';
import { buildPrompts, CUISINES, type Cuisine, PROMPT_VERSIONS, type PromptVersion } from './prompt.ts';
import { sampleDishes } from './library.ts';
import { recentTitles } from './history.ts';
import { safetyPass } from './safetyPass.ts';

// Modèles configurables par secret : les fournisseurs retirent régulièrement des modèles
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_RECIPE_MODEL = Deno.env.get('GEMINI_RECIPE_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

// Ordre des fournisseurs (principal, puis secours), réglable par secret. Choix et mesures : journal de PLAN.md.
const RECIPE_PROVIDERS = Deno.env.get('RECIPE_PROVIDERS') || 'groq,gemini';

const PROVIDERS: AiProvider[] = orderProviders([
  // gpt-oss raisonne avant de répondre : effort bas, suffisant pour une recette
  groqProvider({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, timeoutMs: 40_000, reasoningEffort: 'low' }),
  geminiProvider({ apiKey: GEMINI_API_KEY, model: GEMINI_RECIPE_MODEL, timeoutMs: 45_000, thinkingLevel: 'low' }),
], RECIPE_PROVIDERS);

// 3 recettes détaillées tiennent dans ~3 500 tokens ; le raisonnement de gpt-oss compte aussi
const MAX_OUTPUT_TOKENS = 8000;

// Version du prompt (évaluation de la phase 9 : scripts/recipe-eval), réglable par secret sans redéployer ;
// v1 : l'ancienne version, sans contrôle de sécurité ni plats de référence
const DEFAULT_PROMPT_VERSION: PromptVersion = 'v4.1';
const requestedVersion = Deno.env.get('RECIPE_PROMPT_VERSION') || '';
const PROMPT_VERSION: PromptVersion = (PROMPT_VERSIONS as readonly string[]).includes(requestedVersion) ? requestedVersion as PromptVersion : DEFAULT_PROMPT_VERSION;
// v4 et suivantes : plats de référence, titres récents, contrôle de sécurité, unités dans la langue de la recette
const V4_FAMILY = !['v1', 'v2', 'v3'].includes(PROMPT_VERSION);
const UNIT_HINT = PROMPT_VERSION === 'v1' ? undefined : 'Unité abrégée, dans la langue de la recette';

interface GenerateRecipeRequest {
  // { id, name, quantity } depuis la phase 3, + days_left, kind, priority depuis la phase 5 ; simples noms acceptés
  ingredients: unknown[];
  // leftovers : « Transformer mes restes », chaque recette part d'un plat cuisiné du garde-manger
  mode?: GenerationMode;
  // Sélection de l'utilisateur : ingredients ne contient que les ingrédients choisis, other_pantry le
  // reste du garde-manger (noms), que les recettes ne doivent pas utiliser
  selection?: boolean;
  other_pantry?: unknown[];
  preferences: {
    dietary?: string[];
    difficulty?: 'easy' | 'medium' | 'expert';
    maxCookTime?: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    cuisine?: string;
    language: string;
    // Préférences : aliments exclus (allergies, goûts) et nombre de personnes
    excluded?: string[];
    servings?: number;
  };
  // true : ajoute le détail des appels (durées, tokens) ; permet aussi d'imposer l'ordre des fournisseurs (mesures)
  debug?: boolean;
  providers?: string;
}

// Causes d'échec distinguées dans la réponse envoyée à l'app
// provider_quota : quota épuisé chez tous les fournisseurs ; api_error et invalid_json : panne
type FailureReason = 'api_error' | 'invalid_json' | 'dietary_refusal' | 'provider_quota';

const FAILURE_MESSAGES: Record<string, Record<FailureReason, string>> = {
  fr: {
    api_error: 'Le service de génération de recettes est momentanément indisponible. Réessaie dans quelques instants.',
    invalid_json: 'La réponse de l\'IA était illisible. Réessaie.',
    dietary_refusal: 'Impossible de créer une recette qui respecte tes régimes alimentaires avec ces ingrédients. Ajoute des ingrédients ou retire un régime.',
    provider_quota: 'Le service de recettes a atteint sa limite pour le moment. Réessaie plus tard.',
  },
  en: {
    api_error: 'The recipe generation service is temporarily unavailable. Please try again in a moment.',
    invalid_json: 'The AI response could not be read. Please try again.',
    dietary_refusal: 'No recipe can respect your dietary restrictions with these ingredients. Add ingredients or remove a restriction.',
    provider_quota: 'The recipe service has reached its limit for now. Please try again later.',
  },
  es: {
    api_error: 'El servicio de generación de recetas no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_json: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
    dietary_refusal: 'No es posible crear una receta que respete tus restricciones alimentarias con estos ingredientes. Añade ingredientes o quita una restricción.',
    provider_quota: 'El servicio de recetas ha alcanzado su límite por ahora. Inténtalo más tarde.',
  },
};

const FAILURE_STATUS: Record<FailureReason, number> = {
  api_error: 502,
  invalid_json: 502,
  dietary_refusal: 422,
  provider_quota: 503,
};

// Raison transmise à l'app pour les échecs liés à un quota ou à une panne (pas pour un refus de régime)
const FAILURE_KIND: Partial<Record<FailureReason, string>> = {
  api_error: 'provider_error',
  invalid_json: 'provider_error',
  provider_quota: 'provider_quota',
};

// Erreurs de la requête elle-même (avant toute génération)
type RequestError = 'unauthorized' | 'quota_exceeded' | 'no_leftovers';

const REQUEST_ERROR_MESSAGES: Record<string, Record<RequestError, string>> = {
  fr: {
    unauthorized: 'Tu dois être connecté pour générer des recettes.',
    quota_exceeded: 'Tu as atteint la limite de {limit} générations de recettes par jour. Réessaie demain.',
    no_leftovers: 'Aucun reste dans ton garde-manger. Ajoute un plat cuisiné (scan ou ajout à la main, « C\'est un reste de plat »).',
  },
  en: {
    unauthorized: 'You must be signed in to generate recipes.',
    quota_exceeded: 'You have reached the limit of {limit} recipe generations per day. Try again tomorrow.',
    no_leftovers: 'No leftovers in your pantry. Add a cooked dish (scan, or add manually with "It\'s a leftover dish").',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para generar recetas.',
    quota_exceeded: 'Has alcanzado el límite de {limit} generaciones de recetas por día. Vuelve a intentarlo mañana.',
    no_leftovers: 'No hay sobras en tu despensa. Añade un plato cocinado (escaneo o a mano, «Son sobras de un plato»).',
  },
};

const REQUEST_ERROR_STATUS: Record<RequestError, number> = {
  unauthorized: 401,
  quota_exceeded: 429,
  no_leftovers: 400,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function requestErrorResponse(code: RequestError, language: string, limit?: number): Response {
  const messages = REQUEST_ERROR_MESSAGES[language] || REQUEST_ERROR_MESSAGES['en'];
  const message = messages[code].replace('{limit}', String(limit));
  return jsonResponse({ error: code, ...(code === 'quota_exceeded' && { reason: 'user_quota' }), message, ...(limit !== undefined && { limit }) }, REQUEST_ERROR_STATUS[code]);
}

function failureResponse(reason: FailureReason, language: string, extra: Record<string, unknown> = {}): Response {
  const messages = FAILURE_MESSAGES[language] || FAILURE_MESSAGES['en'];
  return jsonResponse({ error: reason, ...(FAILURE_KIND[reason] && { reason: FAILURE_KIND[reason] }), message: messages[reason], ...extra }, FAILURE_STATUS[reason]);
}

// ---------- Requête ----------

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  // Utilisateur dont le quota a été compté : rendu si la génération échoue
  let quotaUserId: string | null = null;
  let language = 'fr';

  try {
    const body = await req.json();
    const { ingredients, preferences, mode: requestedMode, selection: requestedSelection, other_pantry, debug, providers: requestedOrder }: GenerateRecipeRequest = body;
    // Tests : erreurs de quota simulées (clé secrète exigée)
    const simulation = readSimulation(req, body);
    const mode: GenerationMode = requestedMode === 'leftovers' ? 'leftovers' : 'standard';
    const selection = requestedSelection === true;
    const otherPantry = selection ? buildOtherPantry(other_pantry) : [];
    language = (preferences?.language || 'fr').substring(0, 2).toLowerCase();

    // Chaque génération consomme les quotas des fournisseurs : réservé aux utilisateurs connectés
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return requestErrorResponse('unauthorized', language);
    }

    const pantry = buildPantry(ingredients);
    if (pantry.items.length === 0) {
      return jsonResponse({ error: 'Aucun ingrédient fourni' }, 400);
    }
    if (!preferences?.mealType) {
      return jsonResponse({ error: 'Type de repas requis (mealType)' }, 400);
    }
    // Vérifié avant le quota : sans reste, le mode « Transformer mes restes » n'a rien à transformer
    if (mode === 'leftovers' && leftoverItems(pantry).length === 0) {
      return requestErrorResponse('no_leftovers', language);
    }
    if (PROVIDERS.length === 0) {
      return jsonResponse({ error: 'api_error', message: (FAILURE_MESSAGES[language] || FAILURE_MESSAGES['en']).api_error, details: 'GROQ_API_KEY and GEMINI_API_KEY missing' }, 500);
    }

    // Une génération = un appel de l'app, quel que soit le nombre de recettes renvoyées
    if (simulation?.user_quota || !await consumeQuota(user, 'generations')) {
      logUserQuota('generate-recipes', 'generations', dailyLimit(user, 'generations'), user.id);
      return requestErrorResponse('quota_exceeded', language, dailyLimit(user, 'generations'));
    }
    quotaUserId = user.id;
    // Titres des recettes récentes et des favoris (à ne pas reproposer), lus pendant la préparation du prompt
    const recentPromise = V4_FAMILY ? recentTitles(user.id) : Promise.resolve([]);

    const dietary = Array.isArray(preferences.dietary) ? preferences.dietary : [];
    const diets = strictDietsOf(dietary);
    const cuisine: Cuisine = (CUISINES as readonly string[]).includes(preferences.cuisine || '') ? preferences.cuisine as Cuisine : 'any';
    const difficulty = preferences.difficulty || 'easy';
    const count = recipeCount(pantry.items.length);
    const excluded = cleanExcluded(preferences.excluded);
    const servings = cleanServings(preferences.servings);
    const context = { mealType: preferences.mealType, cuisine, difficulty, dietary, maxRecipes: count, mode, otherPantry, excluded, servings };

    const promptOptions = {
      pantryText: pantryForPrompt(pantry),
      count,
      language,
      mealType: preferences.mealType,
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
      version: PROMPT_VERSION,
      // Quelques plats de référence tirés au hasard, seulement avec une cuisine précise
      examples: V4_FAMILY ? sampleDishes(cuisine, { mealType: preferences.mealType, diets }) : [],
      recentTitles: await recentPromise,
    };
    const { system, prompt } = buildPrompts(promptOptions);
    const schema = buildRecipeSchema(pantry, diets, UNIT_HINT);

    const providers = debug === true && requestedOrder
      ? orderProviders(PROVIDERS, requestedOrder).filter((p) => requestedOrder.split(',').includes(p.name))
      : PROVIDERS;
    const log: AttemptLog[] = [];
    const result = await runWithFallback(providers, {
      system,
      prompt,
      schema,
      schemaName: 'recipes',
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, (text) => parseRecipes(text, pantry, diets, context), { label: 'generate-recipes', log, t0, simulate: simulation?.providers });
    // Quotas de fournisseurs épuisés, même si le secours a répondu : alerte (une fois par jour et par fournisseur)
    for (const hit of result.quotaHits) {
      reportInBackground(reportProviderQuota(hit.provider, 'generate-recipes', hit.details, simulation !== null));
    }
    const debugInfo = debug === true ? { debug: { total_ms: Date.now() - t0, attempts: log } } : {};

    if (!result.ok) {
      // Panne ou réponse illisible des deux fournisseurs : la génération n'est pas comptée
      await refundQuota(user.id, 'generations');
      console.error(`[generate-recipes] ÉCHEC (${result.reason}) : ${result.failure}`);
      const failure: FailureReason = result.reason === 'provider_quota' ? 'provider_quota' : result.code === 'ai_error' ? 'api_error' : 'invalid_json';
      return failureResponse(failure, language, debugInfo);
    }

    const { dietaryRejections, refusal, invalid } = result.value;
    let recipes = result.value.recipes;
    if (invalid.length > 0) console.warn(`[generate-recipes] recettes mal formées écartées : ${invalid.join(' ; ')}`);
    if (dietaryRejections.length > 0) console.warn(`[generate-recipes] recettes écartées (régime) : ${dietaryRejections.join(' ; ')}`);

    // Recettes écartées (mal formées ou hors régime) : une nouvelle demande pour celles qui manquent, un seul
    // essai, sans compter une autre génération dans le quota
    const missing = count - recipes.length;
    if (recipes.length > 0 && missing > 0 && invalid.length + dietaryRejections.length > 0) {
      const again = buildPrompts({ ...promptOptions, count: missing, avoidTitles: recipes.map((recipe) => recipe.title) });
      const second = await runWithFallback(providers, {
        system: again.system,
        prompt: again.prompt,
        schema,
        schemaName: 'recipes',
        temperature: 0.8,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      }, (text) => parseRecipes(text, pantry, diets, { ...context, maxRecipes: missing }), { label: 'generate-recipes', log, t0, simulate: simulation?.providers });
      for (const hit of second.quotaHits) {
        reportInBackground(reportProviderQuota(hit.provider, 'generate-recipes', hit.details, simulation !== null));
      }
      if (second.ok) {
        const titles = new Set(recipes.map((recipe) => recipe.title.toLowerCase()));
        recipes = [...recipes, ...second.value.recipes.filter((recipe) => !titles.has(recipe.title.toLowerCase()))].slice(0, count);
      }
      console.log(`[generate-recipes] nouvelle demande après ${missing} recette(s) écartée(s) : ${recipes.length}/${count}`);
    }

    if (recipes.length === 0) {
      // Seul cas sans recette accepté : les régimes. Un refus reste compté dans le quota.
      console.warn(`[generate-recipes] aucune recette compatible avec ${diets.join(', ')}${refusal ? ` : ${refusal}` : ''}`);
      return failureResponse('dietary_refusal', language, debug === true ? { debug: { ...debugInfo.debug, dietary_rejections: dietaryRejections, invalid, refusal } } : debugInfo);
    }

    // Contrôle de sécurité (v4 et suivantes, safety.ts) : une demande de correction pour les recettes en défaut,
    // puis celles qui restent en défaut sont écartées ; aucune génération de plus comptée dans le quota
    let safetyReport = null;
    if (V4_FAMILY) {
      const pass = await safetyPass(recipes, {
        pantry, pantryText: promptOptions.pantryText, diets, context, providers, log, t0, label: 'generate-recipes:correction',
        request: { system, prompt, schema, schemaName: 'recipes', temperature: 0.8, maxOutputTokens: MAX_OUTPUT_TOKENS },
        ...(simulation?.providers && { simulate: simulation.providers }),
      });
      for (const hit of pass.report.correction?.quotaHits ?? []) {
        reportInBackground(reportProviderQuota(hit.provider, 'generate-recipes', hit.details, simulation !== null));
      }
      recipes = pass.recipes;
      safetyReport = { first: pass.report.first, corrected: pass.report.corrected, dropped: pass.report.dropped };
      if (pass.report.first.length > 0) {
        console.warn(`[generate-recipes] sécurité : ${pass.report.first.length} en défaut, ${pass.report.corrected.length} corrigée(s), ${pass.report.dropped.length} écartée(s) (${pass.report.dropped.map((d) => `${d.title} : ${d.issues.map((i) => i.code).join(', ')}`).join(' ; ')})`);
      }
      if (recipes.length === 0) {
        // Toutes écartées (rare) : panne du point de vue de l'utilisateur, la génération n'est pas comptée
        await refundQuota(user.id, 'generations');
        return failureResponse('api_error', language, debug === true ? { debug: { ...debugInfo.debug, safety: safetyReport } } : debugInfo);
      }
    }

    console.log(`[generate-recipes] ${result.provider.name} (${result.provider.model}) : ${recipes.length}/${count} recette(s) en ${Date.now() - t0} ms, prompt ${PROMPT_VERSION}, cuisine ${cuisine}, langue ${language}`);
    return jsonResponse({
      recipes,
      totalGenerated: recipes.length,
      requested: count,
      // Recettes écartées et non remplacées (l'app l'explique) ; moins de 3 demandées avec peu d'aliments
      rejected: Math.max(0, count - recipes.length),
      fewIngredients: count < 3,
      provider: result.provider.name,
      ...(debug === true && { debug: { ...debugInfo.debug, dietary_rejections: dietaryRejections, invalid, version: PROMPT_VERSION, safety: safetyReport } }),
    }, 200);
  } catch (error) {
    console.error('Error generating recipes:', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'generations');
    return jsonResponse({ error: 'api_error', reason: 'provider_error', message: (FAILURE_MESSAGES[language] || FAILURE_MESSAGES['en']).api_error, details: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
