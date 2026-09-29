import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, dailyLimit, refundQuota } from '../_shared/quota.ts';
import { logUserQuota, reportInBackground, reportProviderQuota } from '../_shared/quotaAlerts.ts';
import { readSimulation } from '../_shared/simulate.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { type AiProvider, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import { isLanguage, parseTranslation, sourceOf, TRANSLATION_SCHEMA, TRANSLATION_SYSTEM, translationPrompt } from './translation.ts';

// « Traduire en … » dans la fiche recette. La traduction est générée une seule fois par recette et par
// langue, puis relue dans recipes.translations (gratuit). Recette lue avec le jeton de l'utilisateur
// (règles de sécurité : seulement ses recettes) ; traduction enregistrée avec la clé secrète.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = Deno.env.get('GEMINI_RECIPE_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const TRANSLATION_PROVIDERS = Deno.env.get('TRANSLATION_PROVIDERS') || Deno.env.get('RECIPE_PROVIDERS') || 'groq,gemini';

const PROVIDERS: AiProvider[] = orderProviders([
  groqProvider({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, timeoutMs: 40_000, reasoningEffort: 'low' }),
  geminiProvider({ apiKey: GEMINI_API_KEY, model: GEMINI_MODEL, timeoutMs: 45_000, thinkingLevel: 'low' }),
], TRANSLATION_PROVIDERS);

const FUNCTION_NAME = 'translate-recipe';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const failure = (reason: 'user_quota' | 'provider_quota' | 'provider_error', status: number, extra: Record<string, unknown> = {}) =>
  json({ error: reason, reason, ...extra }, status);

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const simulation = readSimulation(req, body);
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const recipeId = typeof body?.recipe_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.recipe_id) ? body.recipe_id : null;
  const language = body?.language;
  if (!recipeId || !isLanguage(language)) return json({ error: 'bad_request' }, 400);

  // Recette de l'utilisateur (sinon rien : 404)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?id=eq.${recipeId}&select=title,description,suggestion,ingredients_used,ingredients_from_list,missing_ingredients,instructions,tips,language,translations`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: req.headers.get('Authorization') || '' } },
  );
  const row = response.ok ? (await response.json())?.[0] : null;
  if (!row) return json({ error: 'not_found' }, 404);

  // Déjà traduite : relue, sans rien compter
  const existing = row.translations?.[language];
  if (existing) return json({ language, translation: existing });
  if (row.language === language) return json({ error: 'same_language' }, 400);

  if (simulation?.user_quota || !await consumeQuota(user, 'translations')) {
    logUserQuota(FUNCTION_NAME, 'translations', dailyLimit(user, 'translations'), user.id);
    return failure('user_quota', 429, { limit: dailyLimit(user, 'translations') });
  }

  try {
    const source = sourceOf(row);
    const translated = await runWithFallback(PROVIDERS, {
      system: TRANSLATION_SYSTEM,
      prompt: translationPrompt(source, language),
      schema: TRANSLATION_SCHEMA,
      schemaName: 'recipe_translation',
      temperature: 0.2,
      maxOutputTokens: 8000,
    }, (text) => parseTranslation(text, source), { label: FUNCTION_NAME, log: [], t0, simulate: simulation?.providers });
    for (const hit of translated.quotaHits) reportInBackground(reportProviderQuota(hit.provider, FUNCTION_NAME, hit.details, simulation !== null));

    if (!translated.ok) {
      await refundQuota(user.id, 'translations');
      console.error(`[translate-recipe] ÉCHEC (${translated.reason}) : ${translated.failure}`);
      return translated.reason === 'provider_quota' ? failure('provider_quota', 503) : failure('provider_error', 502);
    }

    const saved = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_recipe_translation`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_recipe_id: recipeId, p_language: language, p_content: translated.value }),
    });
    if (!saved.ok) console.error('[translate-recipe] traduction non enregistrée :', saved.status, (await saved.text()).slice(0, 200));
    console.log(`[translate-recipe] recette traduite en ${language} par ${translated.provider.name} en ${Date.now() - t0} ms`);
    return json({ language, translation: translated.value });
  } catch (error) {
    console.error('[translate-recipe] erreur :', error);
    await refundQuota(user.id, 'translations');
    return failure('provider_error', 500);
  }
}));
