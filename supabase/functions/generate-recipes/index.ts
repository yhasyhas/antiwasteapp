import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, DAILY_LIMITS, refundQuota } from '../_shared/quota.ts';
import { withCors } from '../_shared/cors.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import {
  buildPantry,
  buildRecipeSchema,
  type GenerationMode,
  leftoverItems,
  pantryForPrompt,
  parseRecipes,
  recipeCount,
  strictDietsOf,
  urgentItems,
} from './recipes.ts';

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

const CUISINES = ['any', 'african', 'maghreb', 'asian', 'latin', 'mediterranean', 'french'] as const;
type Cuisine = typeof CUISINES[number];

interface GenerateRecipeRequest {
  // { id, name, quantity } depuis la phase 3, + days_left, kind, priority depuis la phase 5 ; simples noms acceptés
  ingredients: unknown[];
  // leftovers : « Transformer mes restes », chaque recette part d'un plat cuisiné du garde-manger
  mode?: GenerationMode;
  preferences: {
    dietary?: string[];
    difficulty?: 'easy' | 'medium' | 'expert';
    maxCookTime?: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    cuisine?: string;
    language: string;
  };
  // true : ajoute le détail des appels (durées, tokens) ; permet aussi d'imposer l'ordre des fournisseurs (mesures)
  debug?: boolean;
  providers?: string;
}

// Causes d'échec distinguées dans la réponse envoyée à l'app
type FailureReason = 'api_error' | 'invalid_json' | 'dietary_refusal';

const FAILURE_MESSAGES: Record<string, Record<FailureReason, string>> = {
  fr: {
    api_error: 'Le service de génération de recettes est momentanément indisponible. Réessaie dans quelques instants.',
    invalid_json: 'La réponse de l\'IA était illisible. Réessaie.',
    dietary_refusal: 'Impossible de créer une recette qui respecte tes régimes alimentaires avec ces ingrédients. Ajoute des ingrédients ou retire un régime.',
  },
  en: {
    api_error: 'The recipe generation service is temporarily unavailable. Please try again in a moment.',
    invalid_json: 'The AI response could not be read. Please try again.',
    dietary_refusal: 'No recipe can respect your dietary restrictions with these ingredients. Add ingredients or remove a restriction.',
  },
  es: {
    api_error: 'El servicio de generación de recetas no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_json: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
    dietary_refusal: 'No es posible crear una receta que respete tus restricciones alimentarias con estos ingredientes. Añade ingredientes o quita una restricción.',
  },
};

const FAILURE_STATUS: Record<FailureReason, number> = {
  api_error: 502,
  invalid_json: 502,
  dietary_refusal: 422,
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
  return jsonResponse({ error: code, message, ...(limit !== undefined && { limit }) }, REQUEST_ERROR_STATUS[code]);
}

function failureResponse(reason: FailureReason, language: string, extra: Record<string, unknown> = {}): Response {
  const messages = FAILURE_MESSAGES[language] || FAILURE_MESSAGES['en'];
  return jsonResponse({ error: reason, message: messages[reason], ...extra }, FAILURE_STATUS[reason]);
}

// ---------- Prompt ----------

const LANGUAGE_NAMES: Record<string, string> = { fr: 'français', en: 'anglais', es: 'espagnol' };

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'petit-déjeuner', lunch: 'déjeuner', dinner: 'dîner', snack: 'goûter',
};

// Le type de repas est une préférence : ces descriptions orientent la recette sans l'interdire
const MEAL_PREFERENCES: Record<string, string> = {
  breakfast: 'Repas du matin. Idéalement : rapide (15-20 min), léger, énergisant. De préférence éviter : plats lourds, viandes grasses, friture.',
  lunch: 'Repas de midi. Idéalement : équilibré, rassasiant, peut être préparé à l\'avance. De préférence : protéine + légume + féculent.',
  dinner: 'Repas du soir. Idéalement : plus léger que le déjeuner, digeste, pas trop épicé ni gras.',
  snack: 'Encas rapide. Idéalement : très rapide (5-10 min), sucré ou salé léger, peu ou pas de cuisson.',
};

const DIETARY_RULES: Record<string, string> = {
  vegan: 'vegan : ni viande, ni poisson, ni fruits de mer, ni œufs, ni lait, fromage, beurre, crème, yaourt, ni miel, gélatine, caséine. Les laits et beurres végétaux (lait de coco, lait d\'amande, beurre de cacahuète…) sont autorisés.',
  vegetarian: 'végétarien : ni viande, ni poisson, ni fruits de mer (œufs et produits laitiers autorisés).',
  'gluten-free': 'sans gluten : ni blé, orge, seigle, épeautre, ni farine de blé, pâtes, pain, semoule, couscous classiques. Sarrasin, riz, maïs, quinoa autorisés.',
  'dairy-free': 'sans lactose : ni lait animal, fromage, beurre, crème, yaourt, lait en poudre, caséine. Les laits végétaux sont autorisés.',
  'low-carb': 'pauvre en glucides (préférence) : limiter pain, pâtes, riz, pommes de terre, sucre ; privilégier viandes, poissons, œufs, légumes verts.',
};

const CUISINE_DESCRIPTIONS: Record<Cuisine, string> = {
  any: '',
  african: 'cuisine d\'Afrique subsaharienne (ex. mafé, yassa, thiéboudienne, ndolé, attiéké, alloco)',
  maghreb: 'cuisine du Maghreb (ex. tajine, couscous, chakchouka, harira, brick, ras-el-hanout)',
  asian: 'cuisine asiatique (ex. sautés au wok, currys, bouillons, riz sauté, sauces soja et gingembre)',
  latin: 'cuisine d\'Amérique latine (ex. tacos, arepas, ceviche, chili, feijoada, épices et agrumes)',
  mediterranean: 'cuisine méditerranéenne (ex. huile d\'olive, légumes grillés, herbes, pois chiches, poisson)',
  french: 'cuisine française (ex. gratins, quiches, ratatouille, blanquette, sauces classiques)',
};

function buildPrompts(options: {
  pantryText: string;
  count: number;
  language: string;
  mealType: string;
  difficulty: string;
  maxCookTime: number;
  cuisine: Cuisine;
  dietary: string[];
  hasStrictDiet: boolean;
  hasUrgent: boolean;
  hasLeftovers: boolean;
  mode: GenerationMode;
}): { system: string; prompt: string } {
  const languageName = LANGUAGE_NAMES[options.language] || LANGUAGE_NAMES['en'];
  const dietaryRules = options.dietary.map((diet) => DIETARY_RULES[diet.toLowerCase()]).filter(Boolean);
  const cuisineRule = options.cuisine === 'any'
    ? 'Cuisine : libre. Varie les styles d\'une recette à l\'autre.'
    : `Cuisine demandée : ${CUISINE_DESCRIPTIONS[options.cuisine]}. Les recettes doivent en être typiques (épices, techniques, noms de plats), en s'adaptant aux ingrédients disponibles.`;

  const system = `Tu es un chef expert en cuisine anti-gaspi. Tu écris en ${languageName} (tous les textes : titre, description, noms d'ingrédients, étapes, astuces, suggestion).

RÉGIMES ALIMENTAIRES (règles strictes) :
${dietaryRules.length > 0 ? dietaryRules.map((rule) => `- ${rule}`).join('\n') : '- aucun'}

TYPE DE REPAS (${MEAL_NAMES[options.mealType] || options.mealType}) — préférence, pas une règle :
${MEAL_PREFERENCES[options.mealType] || ''}
- Si les ingrédients s'y prêtent mal, propose quand même la meilleure recette possible et remplis "suggestion" avec une phrase courte indiquant le moment où elle est idéale (ex. « Idéal aussi en petit-déjeuner »). Sinon, "suggestion" est une chaîne vide.

${cuisineRule}

INGRÉDIENTS :
- Utilise en priorité les ingrédients du garde-manger, pour éviter le gaspillage.${options.hasUrgent ? `
- ANTI-GASPI : les ingrédients marqués [URGENT] passent avant tous les autres. Chaque recette en utilise au moins un, au cœur du plat (pas en simple garniture), et l'ensemble des recettes les utilise tous si c'est possible.` : ''}${options.hasLeftovers ? `
- Un ingrédient marqué [reste de plat] est un plat déjà cuisiné : on le transforme ou on l'intègre, et il n'est réchauffé qu'une fois, bien à cœur.` : ''}
- Un ingrédient marqué [date dépassée] n'est jamais mis en avant ; s'il s'agit d'un produit frais (viande, poisson, produit laitier, plat cuisiné), ne l'utilise pas.
- "pantry_id" : l'identifiant (p1, p2…) de l'ingrédient du garde-manger utilisé, ou "missing" pour tout ingrédient qui n'en vient pas (y compris sel, poivre, huile).
- Pour un ingrédient du garde-manger, "name" reprend son nom tel qu'il est écrit dans la liste.
- "name" : le nom de l'ingrédient seul, sans préparation ni précision (« ail » et non « ail, émincé ») ; la préparation va dans les étapes.
- Chaque recette utilise au moins un ingrédient du garde-manger.
- "quantity" : le nombre seul (ex. "500", "2", "1/2") ; "unit" : l'unité abrégée (g, kg, ml, cl, l, c. à soupe, c. à café, pièce, tranche, gousse, pincée).${options.hasStrictDiet ? `
- "diet_violations" : pour chaque ingrédient, les régimes sélectionnés qu'il ne respecte pas (liste vide s'il les respecte tous). Sois exact : le lait de coco est vegan, le beurre ne l'est pas.` : ''}${options.mode === 'leftovers' ? `

MODE « TRANSFORMER MES RESTES » (règle stricte) :
- Chaque recette part d'au moins un ingrédient marqué [reste de plat] et le transforme en un nouveau plat (ex. riz → riz sauté ou galettes, gratin de pâtes → croquettes, poulet rôti → wraps ou salade composée), au lieu de simplement le réchauffer.
- Le titre et la description présentent la transformation (ex. « Galettes croustillantes avec ton reste de riz »).` : ''}

ÉTAPES :
- Précises et actionnables : technique, température, durée et repère visuel (ex. « Faites dorer à feu vif 3 minutes, jusqu'à ce que les bords soient croustillants »).
- Jamais de consigne vague comme « faites cuire jusqu'à cuisson » ou « assaisonnez ».

"image_prompt" : description en anglais pour une photo culinaire de la recette (ex. "Professional food photography, golden chicken tajine with olives, rustic clay pot, natural light").`;

  const refusal = options.hasStrictDiet
    ? 'Si les régimes empêchent toute recette utilisant au moins un ingrédient du garde-manger, renvoie "recipes": [] et explique pourquoi dans "refusal" ; n’invente pas de recette sans ingrédient du garde-manger. Sinon, "refusal" est une chaîne vide.'
    : '"refusal" est toujours une chaîne vide : propose toujours des recettes.';

  const prompt = `Garde-manger (identifiant : nom) :
${options.pantryText}

Crée exactement ${options.count} recette${options.count > 1 ? 's' : ''}${options.count > 1 ? ' vraiment différentes les unes des autres (plat, technique de cuisson, texture)' : ''}.
- Difficulté : ${options.difficulty}
- Temps total maximum : ${options.maxCookTime} minutes

${refusal}`;

  return { system, prompt };
}

// ---------- Requête ----------

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  // Utilisateur dont le quota a été compté : rendu si la génération échoue
  let quotaUserId: string | null = null;
  let language = 'fr';

  try {
    const { ingredients, preferences, mode: requestedMode, debug, providers: requestedOrder }: GenerateRecipeRequest = await req.json();
    const mode: GenerationMode = requestedMode === 'leftovers' ? 'leftovers' : 'standard';
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
    if (!await consumeQuota(user.id, 'generations')) {
      console.warn(`[generate-recipes] quota atteint (${DAILY_LIMITS.generations} générations/jour) pour ${user.id}`);
      return requestErrorResponse('quota_exceeded', language, DAILY_LIMITS.generations);
    }
    quotaUserId = user.id;

    const dietary = Array.isArray(preferences.dietary) ? preferences.dietary : [];
    const diets = strictDietsOf(dietary);
    const cuisine: Cuisine = (CUISINES as readonly string[]).includes(preferences.cuisine || '') ? preferences.cuisine as Cuisine : 'any';
    const difficulty = preferences.difficulty || 'easy';
    const count = recipeCount(pantry.items.length);
    const context = { mealType: preferences.mealType, cuisine, difficulty, dietary, maxRecipes: count, mode };

    const { system, prompt } = buildPrompts({
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
    });

    const providers = debug === true && requestedOrder
      ? orderProviders(PROVIDERS, requestedOrder).filter((p) => requestedOrder.split(',').includes(p.name))
      : PROVIDERS;
    const log: AttemptLog[] = [];
    const result = await runWithFallback(providers, {
      system,
      prompt,
      schema: buildRecipeSchema(pantry, diets),
      schemaName: 'recipes',
      temperature: 0.8,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, (text) => parseRecipes(text, pantry, diets, context), { label: 'generate-recipes', log, t0 });
    const debugInfo = debug === true ? { debug: { total_ms: Date.now() - t0, attempts: log } } : {};

    if (!result.ok) {
      // Panne ou réponse illisible des deux fournisseurs : la génération n'est pas comptée
      await refundQuota(user.id, 'generations');
      console.error(`[generate-recipes] échec : ${result.failure}`);
      return failureResponse(result.code === 'ai_error' ? 'api_error' : 'invalid_json', language, debugInfo);
    }

    const { recipes, dietaryRejections, refusal, invalid } = result.value;
    if (invalid.length > 0) console.warn(`[generate-recipes] recettes mal formées écartées : ${invalid.join(' ; ')}`);
    if (dietaryRejections.length > 0) console.warn(`[generate-recipes] recettes écartées (régime) : ${dietaryRejections.join(' ; ')}`);

    if (recipes.length === 0) {
      // Seul cas sans recette accepté : les régimes. Un refus reste compté dans le quota.
      console.warn(`[generate-recipes] aucune recette compatible avec ${diets.join(', ')}${refusal ? ` : ${refusal}` : ''}`);
      return failureResponse('dietary_refusal', language, debugInfo);
    }

    console.log(`[generate-recipes] ${result.provider.name} (${result.provider.model}) : ${recipes.length}/${count} recette(s) en ${Date.now() - t0} ms, cuisine ${cuisine}, langue ${language}`);
    return jsonResponse({
      recipes,
      totalGenerated: recipes.length,
      requested: count,
      provider: result.provider.name,
      ...(debug === true && { debug: { ...debugInfo.debug, dietary_rejections: dietaryRejections, invalid } }),
    }, 200);
  } catch (error) {
    console.error('Error generating recipes:', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'generations');
    return jsonResponse({ error: 'api_error', message: (FAILURE_MESSAGES[language] || FAILURE_MESSAGES['en']).api_error, details: error instanceof Error ? error.message : String(error) }, 500);
  }
}));
