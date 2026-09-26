import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, DAILY_LIMITS, refundQuota } from '../_shared/quota.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { compressRecipeImage } from '../_shared/image.ts';
import { classifyProviderFailure } from '../_shared/ai.ts';
import { logUserQuota, reportInBackground, reportProviderQuota } from '../_shared/quotaAlerts.ts';
import { readSimulation } from '../_shared/simulate.ts';

// Image d'une recette : générée par Cloudflare Workers AI (FLUX), stockée dans le bucket recipe-images,
// URL enregistrée dans recipes.image_url (historique). Appelée par l'app en arrière-plan dès l'affichage
// des recettes générées (et à l'ouverture d'une recette qui n'en a pas), une seule fois par recette : si
// l'image existe déjà, elle est renvoyée sans rien générer ni compter.
// Coût : FLUX schnell sort toujours du 1024×1024 (aucune taille réglable). Relevé dans le dashboard
// Cloudflare le 26/09/2026 : ≈ 170 à 200 neurones par image (l'étape est facturée par tuile de 512 px :
// 4 tuiles × 4 étapes × 9,6 + 4 × 4,8 ≈ 173), soit ≈ 57 images par jour dans l'offre gratuite du compte.

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '';
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN') || '';
// Modèle configurable par secret : les fournisseurs retirent régulièrement des modèles
const CLOUDFLARE_IMAGE_MODEL = Deno.env.get('CLOUDFLARE_IMAGE_MODEL') || '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_TIMEOUT_MS = 40_000;
// FLUX schnell : 4 étapes suffisent (8 au maximum) ; plus d'étapes coûtent plus de neurones Cloudflare
const FLUX_STEPS = 4;

const BUCKET = 'recipe-images';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// quota_exceeded : quota personnel (user_quota) ; provider_quota : allocation Cloudflare du compte épuisée
type ErrorCode = 'unauthorized' | 'bad_request' | 'not_found' | 'not_configured' | 'quota_exceeded' | 'provider_quota' | 'ai_error' | 'storage_error';

const MESSAGES: Record<string, Record<ErrorCode, string>> = {
  fr: {
    unauthorized: 'Tu dois être connecté pour générer une image.',
    bad_request: 'Recette manquante.',
    not_found: 'Recette introuvable.',
    not_configured: 'La génération d\'images n\'est pas configurée.',
    quota_exceeded: 'Tu as atteint la limite de {limit} images de recettes par jour. Réessaie demain.',
    ai_error: 'Le service d\'images est momentanément indisponible. Réessaie plus tard.',
    storage_error: 'L\'image n\'a pas pu être enregistrée. Réessaie plus tard.',
    provider_quota: 'Images du jour épuisées, elles reviennent demain.',
  },
  en: {
    unauthorized: 'You must be signed in to generate an image.',
    bad_request: 'Missing recipe.',
    not_found: 'Recipe not found.',
    not_configured: 'Image generation is not configured.',
    quota_exceeded: 'You have reached the limit of {limit} recipe images per day. Try again tomorrow.',
    ai_error: 'The image service is temporarily unavailable. Please try again later.',
    storage_error: 'The image could not be saved. Please try again later.',
    provider_quota: 'Today\'s images have run out; they will be back tomorrow.',
  },
  es: {
    unauthorized: 'Debes iniciar sesión para generar una imagen.',
    bad_request: 'Falta la receta.',
    not_found: 'Receta no encontrada.',
    not_configured: 'La generación de imágenes no está configurada.',
    quota_exceeded: 'Has alcanzado el límite de {limit} imágenes de recetas por día. Vuelve a intentarlo mañana.',
    ai_error: 'El servicio de imágenes no está disponible en este momento. Inténtalo más tarde.',
    storage_error: 'No se pudo guardar la imagen. Inténtalo más tarde.',
    provider_quota: 'Se acabaron las imágenes de hoy; vuelven mañana.',
  },
};

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  bad_request: 400,
  not_found: 404,
  not_configured: 503,
  quota_exceeded: 429,
  provider_quota: 503,
  ai_error: 502,
  storage_error: 502,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Raison transmise à l'app pour les échecs liés à un quota ou à une panne du fournisseur
const REASONS: Partial<Record<ErrorCode, string>> = {
  quota_exceeded: 'user_quota',
  provider_quota: 'provider_quota',
  ai_error: 'provider_error',
  storage_error: 'provider_error',
};

function errorResponse(code: ErrorCode, language: string, details?: string): Response {
  const message = (MESSAGES[language] || MESSAGES['en'])[code].replace('{limit}', String(DAILY_LIMITS.images));
  return jsonResponse({ error: code, ...(REASONS[code] && { reason: REASONS[code] }), message, ...(details && { details }) }, STATUS[code]);
}

// Échec de Cloudflare, avec son statut HTTP (pour reconnaître un quota épuisé)
class CloudflareError extends Error {
  constructor(readonly status: number | undefined, message: string) {
    super(message);
  }
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

// ---------- Une seule génération par recette ----------
// Avant de générer, la fonction réserve la recette : image_url = « pending:<date> », posé seulement si
// image_url est vide (ou si une réservation a plus de 2 minutes : appel interrompu). Un deuxième appel
// simultané (autre écran, autre téléphone du foyer) ne peut pas la poser : il ne génère rien et répond
// « en cours » (202), l'app redemande quelques secondes plus tard. L'app ne traite jamais « pending: »
// comme une image.

const CLAIM_PREFIX = 'pending:';
const CLAIM_TTL_MS = 120_000;

function existingImageResponse(recipe: Pick<RecipeRow, 'image_url'>): Response | null {
  const url = recipe.image_url;
  if (!url) return null;
  if (!url.startsWith(CLAIM_PREFIX)) return jsonResponse({ image_url: url, generated: false }, 200);
  const claimedAt = Date.parse(url.slice(CLAIM_PREFIX.length));
  // Réservation expirée : on pourra la reprendre
  if (!Number.isFinite(claimedAt) || Date.now() - claimedAt > CLAIM_TTL_MS) return null;
  return jsonResponse({ status: 'in_progress' }, 202);
}

// Change image_url si sa valeur actuelle correspond à « expected » (filtre PostgREST) ; vrai si une ligne
// a été modifiée
async function updateImageUrl(recipeId: string, expected: { eq: string } | { or: string }, value: string | null, authorization: string): Promise<boolean> {
  const params = new URLSearchParams({ id: `eq.${recipeId}` });
  if ('eq' in expected) params.set('image_url', `eq.${expected.eq}`);
  else params.set('or', expected.or);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/recipes?${params}`, {
    method: 'PATCH',
    headers: { ...asUser(authorization), Prefer: 'return=representation' },
    body: JSON.stringify({ image_url: value }),
  });
  if (!response.ok) throw new Error(`mise à jour de la recette : HTTP ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

// Renvoie la réservation posée, ou null si la recette est déjà réservée ou a déjà son image
async function claimRecipe(recipeId: string, authorization: string): Promise<string | null> {
  const claim = `${CLAIM_PREFIX}${new Date().toISOString()}`;
  const expired = `${CLAIM_PREFIX}${new Date(Date.now() - CLAIM_TTL_MS).toISOString()}`;
  const free = `(image_url.is.null,and(image_url.like."${CLAIM_PREFIX}*",image_url.lt."${expired}"))`;
  return await updateImageUrl(recipeId, { or: free }, claim, authorization) ? claim : null;
}

async function releaseClaim(recipeId: string, claim: string, authorization: string) {
  await updateImageUrl(recipeId, { eq: claim }, null, authorization);
}

// FLUX comprend mieux l'anglais : image_prompt est écrit en anglais par generate-recipes
function buildImagePrompt(recipe: Pick<RecipeRow, 'title' | 'description' | 'image_prompt'>): string {
  if (recipe.image_prompt && recipe.image_prompt.trim() !== '') return recipe.image_prompt.trim().slice(0, 1000);
  return `Professional food photography of ${recipe.title}${recipe.description ? `, ${recipe.description}` : ''}. Appetizing, natural light, served on a plate.`.slice(0, 1000);
}

async function generateImage(prompt: string, simulate?: 'quota' | 'error'): Promise<Uint8Array> {
  // Tests : échec simulé, sans appel à Cloudflare
  if (simulate === 'quota') throw new CloudflareError(429, 'Cloudflare 429 (simulé) : you have used up your daily free allocation of 10,000 neurons');
  if (simulate === 'error') throw new CloudflareError(500, 'Cloudflare 500 (simulé) : panne du fournisseur');
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
    throw new CloudflareError(response.status, `Cloudflare ${response.status}: ${text.slice(0, 300)}`);
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
    // Copie : le tableau peut n'être qu'une vue sur un tampon plus grand
    body: bytes.slice().buffer as ArrayBuffer,
  });
  if (!response.ok) throw new Error(`Storage ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  let language = 'fr';
  let quotaUserId: string | null = null;
  // Réservation posée sur la recette, libérée si la génération échoue
  let claim: string | null = null;
  let claimedRecipeId = '';
  let claimAuthorization = '';

  try {
    const body = await req.json().catch(() => ({}));
    // Tests : erreurs de quota simulées (clé secrète exigée)
    const simulation = readSimulation(req, body);
    language = String(body?.language || 'fr').substring(0, 2).toLowerCase();
    const recipeId = typeof body?.recipe_id === 'string' ? body.recipe_id : '';

    const user = await getAuthenticatedUser(req);
    if (!user) return errorResponse('unauthorized', language);
    if (!/^[0-9a-f-]{36}$/i.test(recipeId)) return errorResponse('bad_request', language);

    const authorization = req.headers.get('Authorization') || '';
    const recipe = await loadRecipe(recipeId, authorization);
    if (!recipe) return errorResponse('not_found', language);

    // Déjà générée : aucune génération, aucun quota ; en cours ailleurs : l'app redemandera
    const existing = existingImageResponse(recipe);
    if (existing) return existing;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return errorResponse('not_configured', language, 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing');
    }

    // Réservation de la recette : si un autre appel l'a prise entre-temps, on ne génère rien
    claim = await claimRecipe(recipe.id, authorization);
    claimedRecipeId = recipe.id;
    claimAuthorization = authorization;
    if (!claim) {
      const current = await loadRecipe(recipe.id, authorization);
      return (current && existingImageResponse(current)) || jsonResponse({ status: 'in_progress' }, 202);
    }

    if (simulation?.user_quota || !await consumeQuota(user.id, 'images')) {
      logUserQuota('generate-recipe-image', 'images', DAILY_LIMITS.images, user.id);
      await releaseClaim(recipe.id, claim, authorization);
      return errorResponse('quota_exceeded', language);
    }
    quotaUserId = user.id;

    let bytes: Uint8Array;
    try {
      bytes = await generateImage(buildImagePrompt(recipe), simulation?.providers.cloudflare);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      const reason = classifyProviderFailure(error instanceof CloudflareError ? error.status : undefined, details);
      console.error(`[generate-recipe-image] ÉCHEC (${reason}) : ${details.slice(0, 300)}`);
      await refundQuota(user.id, 'images');
      await releaseClaim(recipe.id, claim, authorization);
      if (reason === 'provider_quota') {
        reportInBackground(reportProviderQuota('cloudflare', 'generate-recipe-image', details, simulation !== null));
        return errorResponse('provider_quota', language, details);
      }
      return errorResponse('ai_error', language, details);
    }

    // Compression (≈ 100 à 150 Ko) ; en cas d'échec, l'image d'origine est gardée plutôt que perdue
    const originalSize = bytes.length;
    try {
      bytes = await compressRecipeImage(bytes);
    } catch (error) {
      console.error('[generate-recipe-image] compression impossible, image d’origine conservée :', error);
    }

    // Nom imprévisible : le bucket est public en lecture mais ne peut pas être listé
    const path = `${user.id}/${recipe.id}-${crypto.randomUUID()}.jpg`;
    let imageUrl: string;
    try {
      imageUrl = await uploadImage(path, bytes);
      // Remplace la réservation (et seulement elle) par l'URL de l'image
      const saved = await updateImageUrl(recipe.id, { eq: claim }, imageUrl, authorization);
      if (!saved) throw new Error('réservation perdue avant l\'enregistrement');
    } catch (error) {
      console.error('[generate-recipe-image] enregistrement :', error);
      await refundQuota(user.id, 'images');
      await releaseClaim(recipe.id, claim, authorization);
      return errorResponse('storage_error', language, error instanceof Error ? error.message : String(error));
    }

    console.log(`[generate-recipe-image] image de ${recipe.id} en ${Date.now() - t0} ms (${Math.round(originalSize / 1024)} Ko → ${Math.round(bytes.length / 1024)} Ko)`);
    return jsonResponse({ image_url: imageUrl, generated: true }, 200);
  } catch (error) {
    console.error('[generate-recipe-image] erreur :', error);
    if (quotaUserId) await refundQuota(quotaUserId, 'images');
    if (claim && claimedRecipeId) await releaseClaim(claimedRecipeId, claim, claimAuthorization).catch(() => {});
    return errorResponse('ai_error', language, error instanceof Error ? error.message : String(error));
  }
}));
