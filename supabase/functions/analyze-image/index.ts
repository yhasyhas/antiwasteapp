import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

// Modèles configurables par secret : les fournisseurs retirent régulièrement des modèles
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_VISION_MODEL = Deno.env.get('GROQ_VISION_MODEL') || 'qwen/qwen3.8-27b';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Gemini est essayé une seule fois : ses modèles saturent tous en même temps, réessayer ne fait
// que consommer le quota. En cas de surcharge, quota, délai dépassé ou modèle retiré → Groq.
const GEMINI_TIMEOUT_MS = 20_000;
const GROQ_TIMEOUT_MS = 30_000;
const FALLBACK_STATUSES = new Set([404, 429, 500, 502, 503, 504]);

// En dessous de ce niveau de confiance, l'ingrédient n'est pas proposé à l'utilisateur
const MIN_CONFIDENCE = 0.5;
const MAX_INGREDIENTS = 20;
// Gemini et Groq limitent la requête à 20 Mo ; l'app envoie des photos d'environ 100-300 Ko
const MAX_IMAGE_BASE64_LENGTH = 15 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
};

const CATEGORIES = [
  'fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume',
  'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other',
];

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
        },
        required: ['name', 'quantity', 'category', 'confidence'],
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
}

interface DetectedIngredient {
  name: string;
  quantity: string;
  category: string;
  confidence: number;
}

const MESSAGES: Record<string, Record<string, string>> = {
  fr: {
    unauthorized: 'Vous devez être connecté pour analyser une photo.',
    no_image: 'Aucune image reçue.',
    image_too_large: 'L\'image est trop lourde.',
    not_configured: 'Le service d\'analyse n\'est pas configuré.',
    ai_error: 'Le service d\'analyse d\'image est momentanément indisponible. Réessayez dans quelques instants.',
    invalid_response: 'La réponse de l\'IA était illisible. Réessayez.',
  },
  en: {
    unauthorized: 'You must be signed in to analyze a photo.',
    no_image: 'No image received.',
    image_too_large: 'The image is too large.',
    not_configured: 'The analysis service is not configured.',
    ai_error: 'The image analysis service is temporarily unavailable. Please try again in a moment.',
    invalid_response: 'The AI response could not be read. Please try again.',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para analizar una foto.',
    no_image: 'No se recibió ninguna imagen.',
    image_too_large: 'La imagen es demasiado pesada.',
    not_configured: 'El servicio de análisis no está configurado.',
    ai_error: 'El servicio de análisis de imágenes no está disponible en este momento. Inténtalo de nuevo en unos instantes.',
    invalid_response: 'No se pudo leer la respuesta de la IA. Inténtalo de nuevo.',
  },
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, language: string, status: number, details?: string): Response {
  const messages = MESSAGES[language] || MESSAGES['en'];
  return jsonResponse({ error: code, message: messages[code] || code, ...(details && { details }) }, status);
}

// Les codes de catégorie sont en anglais : on précise leur sens pour éviter les confusions
// (ex. un modèle qui range les légumes dans "legume" à cause du mot français « légume »)
const CATEGORY_GUIDE = `un de ces codes : fruit (fruits frais), vegetable (légumes, y compris tomates, pommes de terre, salades), meat (viande, charcuterie), fish (poisson, fruits de mer), dairy (lait, fromage, yaourt, beurre, crème), egg (œufs), grain (pâtes, riz, céréales, farine), legume (légumineuses : lentilles, pois chiches, haricots secs), bakery (pain, viennoiseries, biscuits), condiment (sauces, huile, vinaigre, confiture), spice (épices, herbes séchées), beverage (boissons, y compris jus de fruits), snack (gâteaux apéritif, chocolat, confiseries), frozen (surgelés), other.`;

function buildPrompt(language: string, mode: AnalyzeMode): string {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES['en'];

  if (mode === 'receipt') {
    return `Tu analyses la photo d'un ticket de caisse prise par un utilisateur d'une application anti-gaspi.

Liste uniquement les produits alimentaires achetés.
- "name" : nom courant et générique en ${languageName}, en décodant les libellés abrégés (ex. "TOM GRAPPE 1KG" → "tomate", "LAIT DEMI-ECR" → "lait"), sans marque.
- "quantity" : quantité d'après le ticket, avec son unité (ex. "1 kg", "6", "1 l") ; chaîne vide si elle n'est pas indiquée.
- "category" : ${CATEGORY_GUIDE}
- "confidence" : entre 0 et 1, selon la lisibilité de la ligne et ta certitude sur le produit.
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
- Un même aliment n'apparaît qu'une fois : additionne les quantités.
- Ignore ce qui n'est pas comestible (ustensiles, meubles, emballages vides).
- S'il n'y a aucun aliment, renvoie une liste vide.`;
}

interface VisionRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
}

// text : le JSON renvoyé par le modèle ; fallback : l'échec justifie de passer au fournisseur suivant
type ProviderResult =
  | { ok: true; text: string }
  | { ok: false; fallback: boolean; details: string };

interface VisionProvider {
  name: string;
  model: string;
  configured: boolean;
  call: (request: VisionRequest) => Promise<ProviderResult>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function callGemini({ prompt, imageBase64, mimeType }: VisionRequest): Promise<ProviderResult> {
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
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        fallback: FALLBACK_STATUSES.has(response.status),
        details: `Gemini ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    // Interactions API : le texte est dans steps[type=model_output].content[type=text]
    const interaction = await response.json();
    if (interaction.status !== 'completed') {
      return { ok: false, fallback: true, details: `Gemini status ${interaction.status}` };
    }
    const text = (interaction.steps || [])
      .filter((step: any) => step.type === 'model_output')
      .flatMap((step: any) => step.content || [])
      .filter((item: any) => item.type === 'text' && typeof item.text === 'string')
      .map((item: any) => item.text)
      .join('');
    return { ok: true, text };
  } catch (error) {
    // Délai dépassé ou erreur réseau
    return { ok: false, fallback: true, details: `Gemini: ${describeError(error)}` };
  }
}

async function callGroq({ prompt, imageBase64, mimeType }: VisionRequest): Promise<ProviderResult> {
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
        temperature: 0.2,
        // Mode sans réflexion : réponse plus rapide
        reasoning_effort: 'none',
        // L'offre gratuite de Groq limite ce modèle à 1 000 tokens de sortie par minute : une valeur plus
        // haute fait refuser la requête. 20 ingrédients tiennent dans ~600 tokens.
        max_completion_tokens: 800,
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, fallback: false, details: `Groq ${response.status}: ${errorText.slice(0, 300)}` };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { ok: false, fallback: false, details: `Groq: réponse sans contenu (${data.choices?.[0]?.finish_reason})` };
    }
    return { ok: true, text };
  } catch (error) {
    return { ok: false, fallback: false, details: `Groq: ${describeError(error)}` };
  }
}

// Ordre des tentatives : Gemini, puis Groq
const PROVIDERS: VisionProvider[] = [
  { name: 'gemini', model: GEMINI_MODEL, configured: GEMINI_API_KEY !== '', call: callGemini },
  { name: 'groq', model: GROQ_VISION_MODEL, configured: GROQ_API_KEY !== '', call: callGroq },
];

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let language = 'fr';

  try {
    const { image_base64, mime_type, language: requestedLanguage, mode: requestedMode }: AnalyzeImageRequest = await req.json();
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

    const visionRequest: VisionRequest = {
      prompt: buildPrompt(language, mode),
      imageBase64: image_base64,
      mimeType: mime_type || 'image/jpeg',
    };
    let lastFailure = '';

    for (const provider of providers) {
      const started = Date.now();
      const result = await provider.call(visionRequest);
      const elapsed = Date.now() - started;

      if (!result.ok) {
        console.error(`[analyze-image] ${provider.name} (${provider.model}) échec en ${elapsed} ms : ${result.details}`);
        lastFailure = result.details;
        if (result.fallback) continue;
        break;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        console.error(`[analyze-image] ${provider.name} (${provider.model}) JSON illisible en ${elapsed} ms :`, result.text.slice(0, 500));
        return errorResponse('invalid_response', language, 502);
      }

      const ingredients = cleanIngredients(parsed?.ingredients);
      console.log(`[analyze-image] ${provider.name} (${provider.model}) OK en ${elapsed} ms, ${ingredients.length} ingrédient(s), mode ${mode}, langue ${language}`);
      // fallback_reason : pourquoi le fournisseur précédent a échoué (utile dans les logs [scan] de l'app)
      return jsonResponse({ ingredients, provider: provider.name, ...(lastFailure && { fallback_reason: lastFailure }) }, 200);
    }

    return errorResponse('ai_error', language, 502, lastFailure);
  } catch (error) {
    console.error('Error analyzing image:', error);
    return errorResponse('ai_error', language, 500, error instanceof Error ? error.message : String(error));
  }
});
