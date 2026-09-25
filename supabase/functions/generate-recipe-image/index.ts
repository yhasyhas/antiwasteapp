import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, DAILY_LIMITS, refundQuota } from '../_shared/quota.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';

// Image d'une recette : générée par Cloudflare Workers AI (FLUX), stockée dans le bucket recipe-images,
// URL enregistrée dans recipes.image_url. Appelée par l'app seulement à l'ouverture ou à la sauvegarde
// d'une recette, et une seule fois par recette : si l'image existe déjà, elle est renvoyée sans rien générer.

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '';
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN') || '';
// Modèle configurable par secret : les fournisseurs retirent régulièrement des modèles
const CLOUDFLARE_IMAGE_MODEL = Deno.env.get('CLOUDFLARE_IMAGE_MODEL') || '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_TIMEOUT_MS = 40_000;
// FLUX schnell : 4 étapes suffisent (8 au maximum) ; plus d'étapes coûtent plus de neurones Cloudflare
const FLUX_STEPS = 4;

const BUCKET = 'recipe-images';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ErrorCode = 'unauthorized' | 'bad_request' | 'not_found' | 'not_configured' | 'quota_exceeded' | 'ai_error' | 'storage_error';

const MESSAGES: Record<string, Record<ErrorCode, string>> = {
  fr: {
    unauthorized: 'Tu dois être connecté pour générer une image.',
    bad_request: 'Recette manquante.',
    not_found: 'Recette introuvable.',
    not_configured: 'La génération d\'images n\'est pas configurée.',
    quota_exceeded: 'Tu as atteint la limite de {limit} images de recettes par jour. Réessaie demain.',
    ai_error: 'Le service d\'images est momentanément indisponible. Réessaie plus tard.',
    storage_error: 'L\'image n\'a pas pu être enregistrée. Réessaie plus tard.',
  },
  en: {
    unauthorized: 'You must be signed in to generate an image.',
    bad_request: 'Missing recipe.',
    not_found: 'Recipe not found.',
    not_configured: 'Image generation is not configured.',
    quota_exceeded: 'You have reached the limit of {limit} recipe images per day. Try again tomorrow.',
    ai_error: 'The image service is temporarily unavailable. Please try again later.',
    storage_error: 'The image could not be saved. Please try again later.',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para generar una imagen.',
    bad_request: 'Falta la receta.',
    not_found: 'Receta no encontrada.',
    not_configured: 'La generación de imágenes no está configurada.',
    quota_exceeded: 'Has alcanzado el límite de {limit} imágenes de recetas por día. Vuelve a intentarlo mañana.',
    ai_error: 'El servicio de imágenes no está disponible en este momento. Inténtalo más tarde.',
    storage_error: 'No se pudo guardar la imagen. Inténtalo más tarde.',
  },
};

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  bad_request: 400,
  not_found: 404,
  not_configured: 503,
  quota_exceeded: 429,
  ai_error: 502,
  storage_error: 502,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function errorResponse(code: ErrorCode, language: string, details?: string): Response {
  const message = (MESSAGES[language] || MESSAGES['en'])[code].replace('{limit}', String(DAILY_LIMITS.images));
  return jsonResponse({ error: code, message, ...(details && { details }) }, STATUS[code]);
}

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  image_prompt: string | null;
  image_url: string | null;
}

// Lecture et mise à jour de la recette avec le jeton de l'utilisateur : la RLS de recipes garantit
// qu'il ne touche qu'à ses propres recettes
function asUser(authorization: string) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, 'Content-Type': 'application/json' };
}

async function loadRecipe(recipeId: string, authorization: string): Promise<RecipeRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}&select=id,title,description,image_prompt,image_url`,
    { headers: asUser(authorization) },
  );
  if (!response.ok) throw new Error(`lecture de la recette : HTTP ${response.status}`);
  const rows = await response.json();
  return rows[0] ?? null;
}

// FLUX comprend mieux l'anglais : image_prompt est écrit en anglais par generate-recipes
function buildImagePrompt(recipe: Pick<RecipeRow, 'title' | 'description' | 'image_prompt'>): string {
  if (recipe.image_prompt && recipe.image_prompt.trim() !== '') return recipe.image_prompt.trim().slice(0, 1000);
  return `Professional food photography of ${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}. Appetizing, natural light, served on a plate.`.slice(0, 1000);
}

async function generateImage(prompt: string): Promise<Uint8Array> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: FLUX_STEPS }),
      signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      console.error('[generate-recipe-image] JETON CLOUDFLARE REFUSÉ : vérifier CLOUDFLARE_API_TOKEN et ses droits Workers AI');
    }
    throw new Error(`Cloudflare ${response.status}: ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const base64 = data?.result?.image;
  if (typeof base64 !== 'string' || base64 === '') throw new Error('Cloudflare : réponse sans image');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`image trop lourde (${bytes.length} octets)`);
  return bytes;
}

// Dépôt avec la clé secrète : le bucket n'a aucune politique d'écriture pour les utilisateurs
async function uploadImage(path: string, bytes: Uint8Array): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
    // Uint8Array.from crée son propre tampon : il contient exactement l'image
    body: bytes.buffer as ArrayBuffer,
  });
  if (!response.ok) throw new Error(`Storage ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  let language = 'fr';
  let quotaUserId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    language = String(body?.language || 'fr').substring(0, 2).toLowerCase();
    const recipeId = typeof body?.recipe_id === 'string' ? body.recipe_id : '';

    const user = await getAuthenticatedUser(req);
    if (!user) return errorResponse('unauthorized', language);
    if (!/^[0-9a-f-]{36}$/i.test(recipeId)) return errorResponse('bad_request', language);

    const authorization = req.headers.get('Authorization') || '';
    const recipe = await loadRecipe(recipeId, authorization);
    if (!recipe) return errorResponse('not_found', language);

    // Déjà générée : aucune génération, aucun quota
    if (recipe.image_url) return jsonResponse({ image_url: recipe.image_url, generated: false }, 200);

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return errorResponse('not_configured', language, 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing');
    }

    if (!await consumeQuota(user.id, 'images')) {
      console.warn(`[generate-recipe-image] quota atteint (${DAILY_LIMITS.images} images/jour) pour ${user.id}`);
      return errorResponse('quota_exceeded', language);
    }
    quotaUserId = user.id;

    let bytes: Uint8Array;
    try {
      bytes = await generateImage(buildImagePrompt(recipe));
    } catch (error) {
      console.error('[generate-recipe-image] génération :', error);
      await refundQuota(user.id, 'images');
      return errorResponse('ai_error', language, error instanceof Error ? error.message : String(error));
    }

    // Nom imprévisible : le bucket est public en lecture mais ne peut pas être listé
    const path = `${user.id}/${recipe.id}-${crypto.randomUUID()}.jpg`;
    let imageUrl: string;
    try {
      imageUrl = await uploadImage(path, bytes);
      const update = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${recipe.id}`, {
        method: 'PATCH',
        headers: { ...asUser(authorization), Prefer: 'return=minimal' },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      if (!update.ok) throw new Error(`mise à jour de la recette : HTTP ${update.status}`);
    } catch (error) {
      console.error('[generate-recipe-image] enregistrement :', error);
      await refundQuota(user.id, 'images');
      return errorResponse('storage_error', language, error instanceof Error ? error.message : String(error));
    }

    console.log(`[generate-recipe-image] image de ${recipe.id} en ${Date.now() - t0} ms (${Math.round(bytes.length / 1024)} Ko)`);
    return jsonResponse({ image_url: imageUrl, generated: true }, 200);
  } catch (error) {
    console.error('[generate-recipe-image] erreur :', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'images');
    return errorResponse('ai_error', language, error instanceof Error ? error.message : String(error));
  }
}));
