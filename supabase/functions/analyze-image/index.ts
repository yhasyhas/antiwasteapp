import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, DAILY_LIMITS, refundQuota } from '../_shared/quota.ts';
import { withCors } from '../_shared/cors.ts';

// Modèles configurables par secret : les fournisseurs retirent régulièrement des modèles
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.8-27b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Gemini est essayé une seule fois : ses modèles saturent tous en même temps, réessayer ne fait
// que consommer le quota. N'importe quel échec (erreur HTTP, délai dépassé, JSON invalide, réponse
// vide ou non conforme au schéma) fait lancer Groq aussitôt.
const GEMINI_TIMEOUT_MS = 20_000;
const GROQ_TIMEOUT_MS = 30_000;
// Si Gemini n'a pas répondu après ce délai, Groq est lancé en parallèle : la première réponse valide
// l'emporte. Réglable par secret (objectif : moins de 5 s pour 90 % des scans).
const HEDGE_DELAY_MS = Number(Deno.env.get('SCAN_HEDGE_DELAY_MS') || 5000);

// En dessous de ce niveau de confiance, l'ingrédient n'est pas proposé à l'utilisateur
const MIN_CONFIDENCE = 0.5;
const MAX_INGREDIENTS = 20;
// Gemini et Groq limitent la requête à 20 Mo ; l'app envoie des photos d'environ 100-300 Ko
const MAX_IMAGE_BASE64_LENGTH = 15 * 1024 * 1024;

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
};

const CATEGORIES = [
  'fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume',
  'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other',
];

// ingredient : aliment brut ou produit acheté ; dish : plat cuisiné ou reste de repas
const KINDS = ['ingredient', 'dish'];
type FoodKind = 'ingredient' | 'dish';
const MAX_STORAGE_TIP_LENGTH = 160;

// Sortie structurée, identique pour Gemini et Groq (additionalProperties: false est exigé par le
// mode strict de Groq). La réponse est de toute façon revalidée par cleanIngredients.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nom courant et générique de l\'aliment, dans la langue demandée' },
          quantity: { type: 'string', description: 'Quantité estimée avec son unité (ex. "3", "500 g", "1 l"), ou chaîne vide si impossible à estimer' },
          category: { type: 'string', enum: CATEGORIES },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          kind: { type: 'string', enum: KINDS },
          storage_tip: { type: 'string', description: 'Conseil de conservation court, dans la langue demandée' },
        },
        required: ['name', 'quantity', 'category', 'confidence', 'kind', 'storage_tip'],
        additionalProperties: false,
      },
    },
  },
  required: ['ingredients'],
  additionalProperties: false,
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

interface DetectedIngredient {
  name: string;
  quantity: string;
  category: string;
  confidence: number;
  kind: FoodKind;
  storage_tip: string;
}

const MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    unauthorized: 'Vous devez être connecté pour analyser une photo.',
    no_image: 'Aucune image reçue.',
    image_too_large: 'L\'image est trop lourde.',
    not_configured: 'Le service d\'analyse n\'est pas configuré.',
    ai_error: 'Le service d\'analyse d\'image est momentanément indisponible. Réessayez dans quelques instants.',
    invalid_response: 'La réponse de l\'IA était illisible. Réessayez.',
    quota_exceeded: 'Vous avez atteint la limite de {limit} analyses de photos par jour. Réessayez demain, ou ajoutez vos ingrédients à la main.',
  },
  en: {
    unauthorized: 'You must be signed in to analyze a photo.',
    no_image: 'No image received.',
    image_too_large: 'The image is too large.',
    not_configured: 'The analysis service is not configured.',
    ai_error: 'The image analysis service is temporarily unavailable. Please try again in a moment.',
    invalid_response: 'The AI response could not be read. Please try again.',
    quota_exceeded: 'You have reached the limit of {limit} photo scans per day. Try again tomorrow, or add your ingredients manually.',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para analizar una foto.',
    no_image: 'No se recibió ninguna imagen.',
    image_too_large: 'La imagen es demasiado pesada.',
    not_configured: 'El servicio de análisis no está configurado.',
    ai_error: 'El servicio de análisis de imágenes no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_response: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
    quota_exceeded: 'Has alcanzado el límite de {limit} análisis de fotos por día. Vuelve a intentarlo mañana o añade tus ingredientes a mano.',
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

// Court pour limiter les tokens de sortie (temps de réponse, limite de Groq)
const STORAGE_TIP_GUIDE = (languageName: string) =>
  `conseil de conservation court en ${languageName} (une phrase, 12 mots au plus), adapté à l'aliment tel qu'il est sur la photo : où le ranger et combien de temps (ex. « Au frigo, dans une boîte fermée, 3 jours »).`;

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
- Un même aliment n'apparaît qu'une fois : additionne les quantités.
- 20 aliments au plus, les plus visibles d'abord.
- Ignore ce qui n'est pas comestible (ustensiles, meubles, emballages vides).
- S'il n'y a aucun aliment, renvoie une liste vide.`;
}

interface VisionRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
}

// text : le JSON brut renvoyé par le modèle (lu et validé ensuite, identique pour tous les fournisseurs)
// usage : consommation de tokens renvoyée par le fournisseur (mode debug uniquement)
type ProviderResult =
  | { ok: true; text: string; usage?: unknown }
  | { ok: false; status?: number; details: string };

interface VisionProvider {
  name: string;
  model: string;
  configured: boolean;
  call: (request: VisionRequest, signal: AbortSignal) => Promise<ProviderResult>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// Délai propre au fournisseur, et annulation quand l'autre fournisseur a déjà répondu
function withTimeout(signal: AbortSignal, timeoutMs: number): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
}

async function callGemini({ prompt, imageBase64, mimeType }: VisionRequest, signal: AbortSignal): Promise<ProviderResult> {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        // Ne pas conserver les photos des utilisateurs chez Google
        store: false,
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: imageBase64, mime_type: mimeType },
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
        // Reconnaître des aliments ne demande pas de réflexion : réponse plus rapide
        generation_config: { temperature: 0.2, thinking_level: 'minimal' },
      }),
      signal: withTimeout(signal, GEMINI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, details: `Gemini ${response.status}: ${errorText.slice(0, 300)}` };
    }

    // Interactions API : le texte est dans steps[type=model_output].content[type=text]
    const interaction = await response.json();
    if (interaction.status !== 'completed') {
      return { ok: false, details: `Gemini status ${interaction.status}` };
    }
    const text = (interaction.steps || [])
      .filter((step: any) => step.type === 'model_output')
      .flatMap((step: any) => step.content || [])
      .filter((item: any) => item.type === 'text' && typeof item.text === 'string')
      .map((item: any) => item.text)
      .join('');
    return { ok: true, text, usage: interaction.usage };
  } catch (error) {
    // Délai dépassé, annulation ou erreur réseau
    return { ok: false, details: `Gemini: ${describeError(error)}` };
  }
}

async function requestGroq({ prompt, imageBase64, mimeType }: VisionRequest, signal: AbortSignal): Promise<ProviderResult> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'detected_ingredients', strict: true, schema: RESPONSE_SCHEMA },
        },
        temperature: 0,
        // Mode sans réflexion : réponse plus rapide
        reasoning_effort: 'none',
        // L'offre gratuite de Groq limite ce modèle à 1 000 tokens de sortie par minute : une valeur plus
        // haute fait refuser la requête. 20 aliments avec leur conseil de conservation tiennent dans ~900 tokens.
        max_completion_tokens: 1000,
      }),
      signal: withTimeout(signal, GROQ_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, status: response.status, details: `Groq ${response.status}: ${errorText.slice(0, 300)}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { ok: false, details: `Groq: réponse sans contenu (${data.choices?.[0]?.finish_reason})` };
    }
    return { ok: true, text, usage: data.usage };
  } catch (error) {
    return { ok: false, details: `Groq: ${describeError(error)}` };
  }
}

// Groq refuse parfois sa propre sortie en mode JSON Schema strict (400 json_validate_failed, JSON coupé
// du type "{ conto"). C'est aléatoire, rapide (< 1 s) et presque gratuit : on réessaie une fois.
async function callGroq(request: VisionRequest, signal: AbortSignal): Promise<ProviderResult> {
  const first = await requestGroq(request, signal);
  if (first.ok || first.status !== 400 || !first.details.includes('json_validate_failed') || signal.aborted) return first;

  console.warn(`[analyze-image] groq (${GROQ_VISION_MODEL}) json_validate_failed, nouvel essai : ${first.details.slice(0, 200)}`);
  const second = await requestGroq(request, signal);
  console.log(`[analyze-image] groq (${GROQ_VISION_MODEL}) nouvel essai après json_validate_failed : ${second.ok ? 'réussi' : 'échec'}`);
  return second.ok ? second : { ...second, details: `${second.details} (après un nouvel essai sur json_validate_failed)` };
}

// Fournisseur principal, puis secours
const PROVIDERS: VisionProvider[] = [
  { name: 'gemini', model: GEMINI_MODEL, configured: GEMINI_API_KEY !== '', call: callGemini },
  { name: 'groq', model: GROQ_VISION_MODEL, configured: GROQ_API_KEY !== '', call: callGroq },
];

// Raison pour laquelle un aliment ne respecte pas RESPONSE_SCHEMA, ou null s'il est utilisable.
// kind et storage_tip ne sont pas bloquants : valeurs par défaut dans cleanIngredients.
function ingredientViolation(item: any): string | null {
  if (!item || typeof item !== 'object') return 'pas un objet';
  if (typeof item.name !== 'string' || item.name.trim() === '') return '"name" invalide';
  if (typeof item.quantity !== 'string') return '"quantity" invalide';
  if (!CATEGORIES.includes(item.category)) return `catégorie inconnue "${item.category}"`;
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) return '"confidence" invalide';
  return null;
}

type ValidationResult =
  | { ok: true; valid: unknown[]; invalid: string[] }
  | { ok: false; reason: string };

// Écarte les aliments mal formés et garde les autres. La réponse n'est un échec que si elle n'a pas
// de liste d'aliments, ou si elle en proposait et qu'aucun n'est valide. Une liste vide dès le
// départ reste valide (aucun aliment sur la photo).
function validateResponse(parsed: any): ValidationResult {
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ingredients)) {
    return { ok: false, reason: 'champ "ingredients" absent ou pas un tableau' };
  }

  const valid: unknown[] = [];
  const invalid: string[] = [];
  parsed.ingredients.forEach((item: unknown, index: number) => {
    const violation = ingredientViolation(item);
    if (violation) invalid.push(`n°${index} ${violation}`);
    else valid.push(item);
  });

  if (valid.length === 0 && invalid.length > 0) {
    return { ok: false, reason: `aucun aliment valide sur ${invalid.length} (${invalid.slice(0, 3).join(' ; ')})` };
  }
  return { ok: true, valid, invalid };
}

function cleanIngredients(raw: unknown): DetectedIngredient[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();

  return list
    .filter((item: any) => item && typeof item.name === 'string' && item.name.trim() !== '')
    .map((item: any) => ({
      name: item.name.trim(),
      quantity: typeof item.quantity === 'string' ? item.quantity.trim() : '',
      category: CATEGORIES.includes(item.category) ? item.category : 'other',
      confidence: typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0,
      kind: (KINDS.includes(item.kind) ? item.kind : 'ingredient') as FoodKind,
      storage_tip: typeof item.storage_tip === 'string' ? item.storage_tip.trim().slice(0, MAX_STORAGE_TIP_LENGTH) : '',
    }))
    .filter((item) => item.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence)
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_INGREDIENTS);
}

// Résultat d'un fournisseur, une fois sa réponse lue et validée
type AttemptResult =
  | { ok: true; provider: VisionProvider; ingredients: DetectedIngredient[] }
  | { ok: false; provider: VisionProvider; failure: string; code: 'ai_error' | 'invalid_response' };

interface AttemptLog {
  provider: string;
  started_at_ms: number;
  ms: number;
  ok: boolean;
  details?: string;
  usage?: unknown;
}

async function attempt(provider: VisionProvider, request: VisionRequest, signal: AbortSignal, log: AttemptLog[], t0: number): Promise<AttemptResult> {
  const started = Date.now();
  const result = await provider.call(request, signal);
  const elapsed = Date.now() - started;
  const label = `[analyze-image] ${provider.name} (${provider.model})`;
  const entry: AttemptLog = { provider: provider.name, started_at_ms: started - t0, ms: elapsed, ok: false, ...(result.ok && { usage: result.usage }) };
  log.push(entry);

  let failed: AttemptResult | null = null;
  let validation: ValidationResult | null = null;
  if (!result.ok) {
    failed = { ok: false, provider, failure: result.details, code: 'ai_error' };
    if (result.status === 401 || result.status === 403) {
      // Pas une panne passagère : la clé est à corriger. On bascule quand même pour ne pas bloquer l'utilisateur.
      console.error(`${label} CLÉ ${provider.name.toUpperCase()} INVALIDE (HTTP ${result.status}) : vérifier le secret de sa clé API`);
    }
  } else if (result.text.trim() === '') {
    failed = { ok: false, provider, failure: `${provider.name} : réponse vide`, code: 'invalid_response' };
  } else {
    try {
      validation = validateResponse(JSON.parse(result.text));
      if (!validation.ok) {
        failed = { ok: false, provider, failure: `${provider.name} : réponse non conforme au schéma, ${validation.reason}`, code: 'invalid_response' };
      }
    } catch {
      failed = { ok: false, provider, failure: `${provider.name} : JSON invalide (${result.text.slice(0, 120)})`, code: 'invalid_response' };
    }
  }

  if (failed || !validation?.ok) {
    const failure = failed && !failed.ok ? failed : { ok: false as const, provider, failure: 'échec inconnu', code: 'ai_error' as const };
    entry.details = failure.failure.slice(0, 300);
    // Une annulation n'est pas une panne : l'autre fournisseur a déjà répondu
    if (!signal.aborted) console.error(`${label} échec en ${elapsed} ms : ${failure.failure}`);
    return failure;
  }

  if (validation.invalid.length > 0) {
    console.warn(`${label} ${validation.invalid.length} aliment(s) mal formé(s) écarté(s) : ${validation.invalid.slice(0, 5).join(' ; ')}`);
  }
  entry.ok = true;
  return { ok: true, provider, ingredients: cleanIngredients(validation.valid) };
}

// Lance le fournisseur principal ; si sa réponse n'est pas arrivée après HEDGE_DELAY_MS (ou s'il échoue
// avant), lance le secours en parallèle. La première réponse valide l'emporte et l'autre appel est annulé.
// Renvoie le dernier échec si aucun fournisseur ne répond correctement.
function analyzeWithHedging(providers: VisionProvider[], request: VisionRequest, log: AttemptLog[], t0: number): Promise<AttemptResult> {
  const controller = new AbortController();
  return new Promise((resolve) => {
    let next = 0;
    let pending = 0;
    let settled = false;
    let lastFailure: AttemptResult | null = null;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: AttemptResult) => {
      settled = true;
      clearTimeout(hedgeTimer);
      controller.abort();
      resolve(result);
    };

    const startNext = () => {
      clearTimeout(hedgeTimer);
      if (settled || next >= providers.length) return;
      const provider = providers[next++];
      pending++;
      attempt(provider, request, controller.signal, log, t0).then((result) => {
        pending--;
        if (settled) return;
        if (result.ok) return finish(result);
        lastFailure = result;
        if (next < providers.length) startNext();
        else if (pending === 0) finish(lastFailure);
      });
      if (next < providers.length) hedgeTimer = setTimeout(startNext, HEDGE_DELAY_MS);
    };

    startNext();
  });
}

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  let language = 'fr';
  // Utilisateur dont le quota a été compté : rendu si l'analyse échoue
  let quotaUserId: string | null = null;

  try {
    const { image_base64, mime_type, language: requestedLanguage, mode: requestedMode, debug }: AnalyzeImageRequest = await req.json();
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

    if (!await consumeQuota(user.id, 'scans')) {
      console.warn(`[analyze-image] quota atteint (${DAILY_LIMITS.scans} scans/jour) pour ${user.id}`);
      const message = (MESSAGES[language] || MESSAGES['en']).quota_exceeded.replace('{limit}', String(DAILY_LIMITS.scans));
      return jsonResponse({ error: 'quota_exceeded', message, limit: DAILY_LIMITS.scans }, 429);
    }
    quotaUserId = user.id;

    const visionRequest: VisionRequest = {
      prompt: buildPrompt(language, mode),
      imageBase64: image_base64,
      mimeType: mime_type || 'image/jpeg',
    };
    const beforeAi = Date.now() - t0;
    const log: AttemptLog[] = [];
    const result = await analyzeWithHedging(providers, visionRequest, log, t0);
    // Détail des appels (durées, tokens), sur demande, pour mesurer les temps d'analyse
    const debugInfo = debug === true ? { debug: { before_ai_ms: beforeAi, total_ms: Date.now() - t0, attempts: log } } : {};

    if (!result.ok) {
      await refundQuota(user.id, 'scans');
      return jsonResponse({ ...errorBody(result.code, language, result.failure), ...debugInfo }, 502);
    }

    const elapsed = Date.now() - t0;
    console.log(`[analyze-image] ${result.provider.name} retenu, ${result.ingredients.length} aliment(s) en ${elapsed} ms (${log.map((a) => `${a.provider} ${a.ok ? 'ok' : 'échec'} ${a.ms} ms`).join(', ')}), mode ${mode}, langue ${language}`);
    // fallback_reason : pourquoi le fournisseur principal a échoué (utile dans les logs [scan] de l'app)
    const primaryFailure = log.find((a) => a.provider === providers[0].name && !a.ok);
    const fallbackReason = result.provider === providers[0] ? null
      : primaryFailure?.details ?? `${providers[0].name} : pas de réponse après ${HEDGE_DELAY_MS} ms`;
    return jsonResponse({
      ingredients: result.ingredients,
      provider: result.provider.name,
      ...(fallbackReason && { fallback_reason: fallbackReason }),
      ...debugInfo,
    }, 200);
  } catch (error) {
    console.error('Error analyzing image:', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'scans');
    return errorResponse('ai_error', language, 500, error instanceof Error ? error.message : String(error));
  }
}));
