import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, DAILY_LIMITS, refundQuota } from '../_shared/quota.ts';
import { logUserQuota, reportInBackground, reportProviderQuota } from '../_shared/quotaAlerts.ts';
import { readSimulation } from '../_shared/simulate.ts';
import { withCors } from '../_shared/cors.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, runWithFallback } from '../_shared/ai.ts';
import { parseIngredients, RESPONSE_SCHEMA } from './ingredients.ts';

// Modèles configurables par secret : les fournisseurs retirent régulièrement des modèles
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.8-27b';

// Gemini est essayé une seule fois : ses modèles saturent tous en même temps, réessayer ne fait
// que consommer le quota. N'importe quel échec (erreur HTTP, délai dépassé, JSON invalide, réponse
// vide ou non conforme au schéma) fait lancer Groq aussitôt.
const GEMINI_TIMEOUT_MS = 20_000;
const GROQ_TIMEOUT_MS = 30_000;
// Si Gemini n'a pas répondu après ce délai, Groq est lancé en parallèle : la première réponse valide
// l'emporte. Réglable par secret (objectif : moins de 5 s pour 90 % des scans).
const HEDGE_DELAY_MS = Number(Deno.env.get('SCAN_HEDGE_DELAY_MS') || 5000);

// Gemini et Groq limitent la requête à 20 Mo ; l'app envoie des photos d'environ 100-300 Ko
const MAX_IMAGE_BASE64_LENGTH = 15 * 1024 * 1024;

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
};

// photo : frigo, placard, plan de travail ; receipt : ticket de caisse
type AnalyzeMode = 'photo' | 'receipt';

interface AnalyzeImageRequest {
  image_base64: string;
  mime_type?: string;
  language?: string;
  mode?: AnalyzeMode;
  // true : ajoute à la réponse le détail des appels aux fournisseurs (durées, tokens)
  debug?: boolean;
}

const MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    unauthorized: 'Tu dois être connecté pour analyser une photo.',
    no_image: 'Aucune image reçue.',
    image_too_large: 'L\'image est trop lourde.',
    not_configured: 'Le service d\'analyse n\'est pas configuré.',
    ai_error: 'Le service d\'analyse d\'image est momentanément indisponible. Réessaie dans quelques instants.',
    invalid_response: 'La réponse de l\'IA était illisible. Réessaie.',
    quota_exceeded: 'Tu as atteint la limite de {limit} analyses de photos par jour. Réessaie demain, ou ajoute tes ingrédients à la main.',
    provider_quota: 'Le service d\'analyse a atteint sa limite pour le moment. Ajoute tes ingrédients à la main, ou réessaie plus tard.',
  },
  en: {
    unauthorized: 'You must be signed in to analyze a photo.',
    no_image: 'No image received.',
    image_too_large: 'The image is too large.',
    not_configured: 'The analysis service is not configured.',
    ai_error: 'The image analysis service is temporarily unavailable. Please try again in a moment.',
    invalid_response: 'The AI response could not be read. Please try again.',
    quota_exceeded: 'You have reached the limit of {limit} photo scans per day. Try again tomorrow, or add your ingredients manually.',
    provider_quota: 'The analysis service has reached its limit for now. Add your ingredients manually, or try again later.',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para analizar una foto.',
    no_image: 'No se recibió ninguna imagen.',
    image_too_large: 'La imagen es demasiado pesada.',
    not_configured: 'El servicio de análisis no está configurado.',
    ai_error: 'El servicio de análisis de imágenes no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_response: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
    quota_exceeded: 'Has alcanzado el límite de {limit} análisis de fotos por día. Vuelve a intentarlo mañana o añade tus ingredientes a mano.',
    provider_quota: 'El servicio de análisis ha alcanzado su límite por ahora. Añade tus ingredientes a mano o inténtalo más tarde.',
  },
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorBody(code: string, language: string, details?: string) {
  const messages = MESSAGES[language] || MESSAGES['en'];
  return { error: code, message: messages[code] || code, ...(details && { details }) };
}

function errorResponse(code: string, language: string, status: number, details?: string): Response {
  return jsonResponse(errorBody(code, language, details), status);
}

// Les codes de catégorie sont en anglais : on précise leur sens pour éviter les confusions
// (ex. un modèle qui range les légumes dans "legume" à cause du mot français « légume »)
const CATEGORY_GUIDE = `un de ces codes : fruit (fruits frais), vegetable (légumes, y compris tomates, pommes de terre, salades), meat (viande, charcuterie), fish (poisson, fruits de mer), dairy (lait, fromage, yaourt, beurre, crème), egg (œufs), grain (pâtes, riz, céréales, farine), legume (légumineuses : lentilles, pois chiches, haricots secs), bakery (pain, viennoiseries, biscuits), condiment (sauces, huile, vinaigre, confiture), spice (épices, herbes séchées), beverage (boissons, y compris jus de fruits), snack (gâteaux apéritif, chocolat, confiseries), frozen (surgelés), other.`;

// Court pour limiter les tokens de sortie (temps de réponse, limite de Groq). La durée est dans
// shelf_life_days, le conseil dit seulement où et comment ranger l'aliment.
const STORAGE_TIP_GUIDE = (languageName: string) =>
  `conseil de conservation court en ${languageName} (10 mots au plus), adapté à l'aliment tel qu'il est sur la photo : où et comment le ranger, sans durée (ex. « Au frigo, dans une boîte fermée »).`;

const SHELF_LIFE_GUIDE = `nombre de jours pendant lesquels l'aliment reste bon à partir d'aujourd'hui, dans de bonnes conditions de conservation, selon l'aliment et son état (ex. salade 4, lait ouvert 3, yaourt 15, pâtes sèches 365). Plat cuisiné ou reste ("kind" = "dish") : 2 ou 3.`;

function buildPrompt(language: string, mode: AnalyzeMode): string {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES['en'];

  if (mode === 'receipt') {
    return `Tu analyses la photo d'un ticket de caisse prise par un utilisateur d'une application anti-gaspi.

Liste uniquement les produits alimentaires achetés.
- "name" : nom courant et générique en ${languageName}, en décodant les libellés abrégés (ex. "TOM GRAPPE 1KG" → "tomate", "LAIT DEMI-ECR" → "lait"), sans marque.
- "quantity" : quantité d'après le ticket, avec son unité (ex. "1 kg", "6", "1 l") ; chaîne vide si elle n'est pas indiquée.
- "category" : ${CATEGORY_GUIDE}
- "confidence" : entre 0 et 1, selon la lisibilité de la ligne et ta certitude sur le produit.
- "kind" : "ingredient".
- "storage_tip" : ${STORAGE_TIP_GUIDE(languageName)}
- "shelf_life_days" : ${SHELF_LIFE_GUIDE} Produit neuf, non ouvert.
- Un même produit n'apparaît qu'une fois : additionne les quantités.
- Ignore les produits non alimentaires (hygiène, entretien…), les totaux, remises, moyens de paiement et TVA.
- Si l'image n'est pas un ticket lisible, renvoie une liste vide.`;
  }

  return `Tu analyses une photo prise par un utilisateur d'une application anti-gaspi (frigo, placard, plan de travail, courses).

Liste les aliments et ingrédients de cuisine visibles.
- "name" : nom courant et générique en ${languageName} (ex. "tomate", "lait", "poulet"), sans marque ni emballage.
- "quantity" : quantité estimée avec son unité (ex. "3", "500 g", "1 l", "1 botte") ; chaîne vide si impossible à estimer.
- "category" : ${CATEGORY_GUIDE}
- "confidence" : entre 0 et 1, ta certitude que l'aliment est bien présent.
- "kind" : "dish" pour un plat cuisiné ou un reste de repas (ex. "gratin de pâtes", "reste de poulet rôti", "soupe"), dont "name" est alors le nom du plat ; "ingredient" pour tout le reste.
- "storage_tip" : ${STORAGE_TIP_GUIDE(languageName)}
- "shelf_life_days" : ${SHELF_LIFE_GUIDE}
- Un même aliment n'apparaît qu'une fois : additionne les quantités.
- 20 aliments au plus, les plus visibles d'abord.
- Ignore ce qui n'est pas comestible (ustensiles, meubles, emballages vides).
- S'il n'y a aucun aliment, renvoie une liste vide.`;
}

// Fournisseur principal, puis secours (ordre fixe pour le scan : Gemini lit mieux les photos chargées)
const PROVIDERS: AiProvider[] = [
  geminiProvider({ apiKey: GEMINI_API_KEY, model: GEMINI_MODEL, timeoutMs: GEMINI_TIMEOUT_MS, thinkingLevel: 'minimal' }),
  // Mode sans réflexion : réponse plus rapide
  groqProvider({ apiKey: GROQ_API_KEY, model: GROQ_VISION_MODEL, timeoutMs: GROQ_TIMEOUT_MS, reasoningEffort: 'none' }),
];

// L'offre gratuite de Groq limite ce modèle à 1 000 tokens de sortie par minute : une valeur plus haute
// fait refuser la requête. 20 aliments avec leur conseil et leur durée de conservation tiennent dans ~900 tokens.
const MAX_OUTPUT_TOKENS = 1000;

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  let language = 'fr';
  // Utilisateur dont le quota a été compté : rendu si l'analyse échoue
  let quotaUserId: string | null = null;

  try {
    const body = await req.json();
    const { image_base64, mime_type, language: requestedLanguage, mode: requestedMode, debug }: AnalyzeImageRequest = body;
    // Tests : erreurs de quota simulées (clé secrète exigée)
    const simulation = readSimulation(req, body);
    language = (requestedLanguage || 'fr').substring(0, 2).toLowerCase();
    const mode: AnalyzeMode = requestedMode === 'receipt' ? 'receipt' : 'photo';

    // Chaque analyse consomme les quotas Gemini / Groq : réservé aux utilisateurs connectés
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse('unauthorized', language, 401);
    }

    if (!image_base64) {
      return errorResponse('no_image', language, 400);
    }
    if (image_base64.length > MAX_IMAGE_BASE64_LENGTH) {
      return errorResponse('image_too_large', language, 413);
    }

    const providers = PROVIDERS.filter((provider) => provider.configured);
    if (providers.length === 0) {
      return errorResponse('not_configured', language, 500, 'GEMINI_API_KEY and GROQ_API_KEY missing');
    }

    if (simulation?.user_quota || !await consumeQuota(user.id, 'scans')) {
      logUserQuota('analyze-image', 'scans', DAILY_LIMITS.scans, user.id);
      const message = (MESSAGES[language] || MESSAGES['en']).quota_exceeded.replace('{limit}', String(DAILY_LIMITS.scans));
      return jsonResponse({ error: 'quota_exceeded', reason: 'user_quota', message, limit: DAILY_LIMITS.scans }, 429);
    }
    quotaUserId = user.id;

    const beforeAi = Date.now() - t0;
    const log: AttemptLog[] = [];
    const result = await runWithFallback(providers, {
      prompt: buildPrompt(language, mode),
      image: { base64: image_base64, mimeType: mime_type || 'image/jpeg' },
      schema: RESPONSE_SCHEMA,
      schemaName: 'detected_ingredients',
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, parseIngredients, { label: 'analyze-image', log, t0, hedgeDelayMs: HEDGE_DELAY_MS, simulate: simulation?.providers });
    // Quotas de fournisseurs épuisés, même si le secours a répondu : alerte (une fois par jour et par fournisseur)
    for (const hit of result.quotaHits) {
      reportInBackground(reportProviderQuota(hit.provider, 'analyze-image', hit.details, simulation !== null));
    }
    // Détail des appels (durées, tokens), sur demande, pour mesurer les temps d'analyse
    const debugInfo = debug === true ? { debug: { before_ai_ms: beforeAi, total_ms: Date.now() - t0, attempts: log } } : {};

    if (!result.ok) {
      await refundQuota(user.id, 'scans');
      // Tous les fournisseurs ont échoué : quota épuisé chez chacun (provider_quota) ou panne (provider_error)
      const code = result.reason === 'provider_quota' ? 'provider_quota' : result.code;
      console.error(`[analyze-image] ÉCHEC (${result.reason}) : ${result.failure.slice(0, 200)}`);
      return jsonResponse({ ...errorBody(code, language, result.failure), reason: result.reason, ...debugInfo }, result.reason === 'provider_quota' ? 503 : 502);
    }

    const { ingredients, invalid } = result.value;
    if (invalid.length > 0) {
      console.warn(`[analyze-image] ${result.provider.name} : ${invalid.length} aliment(s) mal formé(s) écarté(s) : ${invalid.slice(0, 5).join(' ; ')}`);
    }
    const elapsed = Date.now() - t0;
    console.log(`[analyze-image] ${result.provider.name} retenu, ${ingredients.length} aliment(s) en ${elapsed} ms (${log.map((a) => `${a.provider} ${a.ok ? 'ok' : 'échec'} ${a.ms} ms`).join(', ')}), mode ${mode}, langue ${language}`);
    // fallback_reason : pourquoi le fournisseur principal a échoué (utile dans les logs [scan] de l'app)
    const primaryFailure = log.find((a) => a.provider === providers[0].name && !a.ok);
    const fallbackReason = result.provider === providers[0] ? null
      : primaryFailure?.details ?? `${providers[0].name} : pas de réponse après ${HEDGE_DELAY_MS} ms`;
    return jsonResponse({
      ingredients,
      provider: result.provider.name,
      ...(fallbackReason && { fallback_reason: fallbackReason }),
      ...debugInfo,
    }, 200);
  } catch (error) {
    console.error('Error analyzing image:', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'scans');
    return jsonResponse({ ...errorBody('ai_error', language, error instanceof Error ? error.message : String(error)), reason: 'provider_error' }, 500);
  }
}));
