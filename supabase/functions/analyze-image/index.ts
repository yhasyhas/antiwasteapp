import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
// Modèle configurable par secret : les fournisseurs retirent régulièrement des modèles
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// En dessous de ce niveau de confiance, l'ingrédient n'est pas proposé à l'utilisateur
const MIN_CONFIDENCE = 0.5;
const MAX_INGREDIENTS = 20;
// Gemini limite la requête entière à 20 Mo ; l'app envoie des photos d'environ 100-300 Ko
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

// Sortie structurée : Gemini doit renvoyer exactement ce schéma
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
      },
    },
  },
  required: ['ingredients'],
};

interface AnalyzeImageRequest {
  image_base64: string;
  mime_type?: string;
  language?: string;
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

function buildPrompt(language: string): string {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES['en'];
  return `Tu analyses une photo prise par un utilisateur d'une application anti-gaspi (frigo, placard, plan de travail, courses).

Liste les aliments et ingrédients de cuisine visibles.
- "name" : nom courant et générique en ${languageName} (ex. "tomate", "lait", "poulet"), sans marque ni emballage.
- "quantity" : quantité estimée avec son unité (ex. "3", "500 g", "1 l", "1 botte") ; chaîne vide si impossible à estimer.
- "category" : une des catégories autorisées.
- "confidence" : entre 0 et 1, ta certitude que l'aliment est bien présent.
- Un même aliment n'apparaît qu'une fois : additionne les quantités.
- Ignore ce qui n'est pas comestible (ustensiles, meubles, emballages vides).
- S'il n'y a aucun aliment, renvoie une liste vide.`;
}

// Réponse de l'Interactions API : le texte est dans steps[type=model_output].content[type=text]
function extractText(interaction: any): string {
  return (interaction?.steps || [])
    .filter((step: any) => step.type === 'model_output')
    .flatMap((step: any) => step.content || [])
    .filter((item: any) => item.type === 'text' && typeof item.text === 'string')
    .map((item: any) => item.text)
    .join('');
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
    const { image_base64, mime_type, language: requestedLanguage }: AnalyzeImageRequest = await req.json();
    language = (requestedLanguage || 'fr').substring(0, 2).toLowerCase();

    // Chaque analyse consomme le quota Gemini : réservé aux utilisateurs connectés
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
    if (!GEMINI_API_KEY) {
      return errorResponse('not_configured', language, 500, 'GEMINI_API_KEY missing');
    }

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        // Ne pas conserver les photos des utilisateurs chez Google
        store: false,
        input: [
          { type: 'text', text: buildPrompt(language) },
          { type: 'image', data: image_base64, mime_type: mime_type || 'image/jpeg' },
        ],
        response_format: { type: 'text', mime_type: 'application/json', schema: RESPONSE_SCHEMA },
        generation_config: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error ${response.status}:`, errorText);
      return errorResponse('ai_error', language, 502, `Gemini ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const interaction = await response.json();
    if (interaction.status !== 'completed') {
      console.error('Gemini interaction not completed:', interaction.status);
      return errorResponse('invalid_response', language, 502, `status ${interaction.status}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(extractText(interaction));
    } catch {
      console.error('Unreadable JSON from Gemini:', extractText(interaction).slice(0, 500));
      return errorResponse('invalid_response', language, 502);
    }

    return jsonResponse({ ingredients: cleanIngredients(parsed?.ingredients) }, 200);
  } catch (error) {
    console.error('Error analyzing image:', error);
    return errorResponse('ai_error', language, 500, error instanceof Error ? error.message : String(error));
  }
});
