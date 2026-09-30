import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser, type AuthenticatedUser } from '../_shared/auth.ts';
import { consumeQuota, dailyLimit, refundQuota } from '../_shared/quota.ts';
import { logUserQuota, reportInBackground, reportProviderQuota } from '../_shared/quotaAlerts.ts';
import { readSimulation } from '../_shared/simulate.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { type AiProvider, type AttemptLog, geminiProvider, groqProvider, orderProviders, runWithFallback } from '../_shared/ai.ts';
import { normalizeAlias, normalizeFoodKey } from '../_shared/foodKey.ts';
import { FACT_SCHEMA, FACT_SYSTEM, type FactContent, factPrompt, NUTRITION_SCHEMA, nutritionPrompt, ORIGIN_SCHEMA, originPrompt, parseFact, parseNutrition, parseOrigins, parseResolution, RESOLVE_SCHEMA, resolvePrompt } from './facts.ts';

// Fiche d'un aliment (touché dans le garde-manger). Une fiche est générée une seule fois pour tous les
// utilisateurs, avec les trois langues dans le même appel, puis relue dans la table food_facts.
// 1. Identifiant : food_key envoyé (scan), sinon un nom déjà connu (alias), sinon un appel IA léger ;
//    l'identifiant trouvé est enregistré sur l'ingrédient.
// 2. Fiche prête : renvoyée sans rien générer ni compter. En cours ailleurs : 202, l'app redemande.
// 3. Sinon : réservation, quota « facts » (fiches générées par jour), génération, validation, enregistrement.
// Pré-remplissage : clé secrète en x-simulate-key, sans utilisateur ni quota.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = Deno.env.get('GEMINI_RECIPE_MODEL') || Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';
const FACT_PROVIDERS = Deno.env.get('FACT_PROVIDERS') || 'groq,gemini';

const PROVIDERS: AiProvider[] = orderProviders([
  groqProvider({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, timeoutMs: 40_000, reasoningEffort: 'low' }),
  geminiProvider({ apiKey: GEMINI_API_KEY, model: GEMINI_MODEL, timeoutMs: 45_000, thinkingLevel: 'low' }),
], FACT_PROVIDERS);

const FUNCTION_NAME = 'food-fact';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const failure = (reason: 'user_quota' | 'provider_quota' | 'provider_error', status: number, extra: Record<string, unknown> = {}) =>
  json({ error: reason, reason, ...extra }, status);

async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`base : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const rpc = (name: string, args: Record<string, unknown>) => db(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });

async function readFact(foodKey: string): Promise<{ status: string; content: unknown; reviewed: boolean } | null> {
  const rows = await db(`food_facts?select=status,content,reviewed&food_key=eq.${encodeURIComponent(foodKey)}`);
  return rows?.[0] ?? null;
}

async function keyFromAlias(alias: string): Promise<string | null> {
  if (!alias) return null;
  // Alias normalisés : lettres, chiffres et espaces seulement (normalizeAlias)
  const rows = await db(`food_facts?select=food_key&status=eq.ready&aliases=cs.${encodeURIComponent(`{"${alias}"}`)}&limit=1`);
  return rows?.[0]?.food_key ?? null;
}

// Identifiant enregistré sur l'ingrédient, avec le jeton de l'utilisateur (règles du garde-manger)
async function saveIngredientKey(ingredientId: string, foodKey: string, authorization: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/ingredients?id=eq.${encodeURIComponent(ingredientId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ food_key: foodKey }),
  }).catch((error) => console.warn('[food-fact] identifiant non enregistré sur l\'ingrédient :', error));
}

// Pré-remplissage (clé secrète) : origine d'une fiche prête réécrite en quelques mots dans les trois langues ;
// le reste de la fiche ne change pas
async function fixOrigin(foodKey: string, t0: number): Promise<Response> {
  const rows = await db(`food_facts?select=content,aliases,model&status=eq.ready&food_key=eq.${encodeURIComponent(foodKey)}`);
  const fact = rows?.[0] as { content: FactContent; aliases: string[]; model: string } | undefined;
  if (!fact) return json({ error: 'not_found' }, 404);
  const rewritten = await runWithFallback(PROVIDERS, {
    prompt: originPrompt(fact.content),
    schema: ORIGIN_SCHEMA,
    schemaName: 'origins',
    temperature: 0,
    maxOutputTokens: 1500,
  }, parseOrigins, { label: FUNCTION_NAME, log: [], t0 });
  if (!rewritten.ok) return failure(rewritten.reason === 'provider_quota' ? 'provider_quota' : 'provider_error', rewritten.reason === 'provider_quota' ? 503 : 502);
  const content = Object.fromEntries(Object.entries(fact.content).map(([language, section]) =>
    [language, { ...section, origin: rewritten.value[language as keyof typeof rewritten.value] ?? section.origin }]));
  await rpc('save_food_fact', { p_food_key: foodKey, p_content: content, p_aliases: fact.aliases, p_model: fact.model });
  return json({ food_key: foodKey, origins: rewritten.value });
}

// Pré-remplissage (clé secrète) : atouts d'une fiche prête réécrits en pastilles courtes (trois mots au plus) ;
// le reste de la fiche ne change pas
async function fixNutrition(foodKey: string, t0: number): Promise<Response> {
  const rows = await db(`food_facts?select=content,aliases,model&status=eq.ready&food_key=eq.${encodeURIComponent(foodKey)}`);
  const fact = rows?.[0] as { content: FactContent; aliases: string[]; model: string } | undefined;
  if (!fact) return json({ error: 'not_found' }, 404);
  const rewritten = await runWithFallback(PROVIDERS, {
    prompt: nutritionPrompt(fact.content),
    schema: NUTRITION_SCHEMA,
    schemaName: 'nutrition',
    temperature: 0,
    maxOutputTokens: 1500,
  }, parseNutrition, { label: FUNCTION_NAME, log: [], t0 });
  if (!rewritten.ok) return failure(rewritten.reason === 'provider_quota' ? 'provider_quota' : 'provider_error', rewritten.reason === 'provider_quota' ? 503 : 502);
  const content = Object.fromEntries(Object.entries(fact.content).map(([language, section]) =>
    [language, { ...section, nutrition: rewritten.value[language as keyof typeof rewritten.value] ?? section.nutrition }]));
  await rpc('save_food_fact', { p_food_key: foodKey, p_content: content, p_aliases: fact.aliases, p_model: fact.model });
  return json({ food_key: foodKey, nutrition: rewritten.value });
}

const ready = (foodKey: string, fact: { content: unknown; reviewed: boolean }) =>
  json({ food_key: foodKey, fact: fact.content, reviewed: fact.reviewed });

Deno.serve(withCors(async (req: Request) => {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const simulation = readSimulation(req, body);
  const user: AuthenticatedUser | null = await getAuthenticatedUser(req);
  // Pré-remplissage : clé secrète sans utilisateur (avec un utilisateur, la même clé ne sert qu'aux essais)
  const admin = !user && req.headers.get('x-simulate-key') === SUPABASE_SECRET_KEY;
  if (!user && !admin) return json({ error: 'unauthorized' }, 401);

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const ingredientId = typeof body?.ingredient_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.ingredient_id) ? body.ingredient_id : null;
  let foodKey = normalizeFoodKey(body?.food_key);
  if (!foodKey && !name) return json({ error: 'bad_request' }, 400);
  // Relier seulement l'aliment à sa fiche (à l'ajout, en arrière-plan) : identifiant enregistré, rien généré
  const linkOnly = body?.link_only === true;
  if (linkOnly && (!user || !ingredientId || !name)) return json({ error: 'bad_request' }, 400);
  // Pré-remplissage : origine d'une fiche existante réécrite en quelques mots
  if (admin && body?.fix_origin === true && foodKey) return await fixOrigin(foodKey, t0);
  // Pré-remplissage : atouts d'une fiche existante réécrits en pastilles courtes
  if (admin && body?.fix_nutrition === true && foodKey) return await fixNutrition(foodKey, t0);

  // Quota compté une fois par requête, rendu si rien n'a été généré
  let quotaCounted = false;
  const countQuota = async (): Promise<boolean> => {
    if (admin || !user || quotaCounted) return true;
    if (simulation?.user_quota || !await consumeQuota(user, 'facts')) {
      logUserQuota(FUNCTION_NAME, 'facts', dailyLimit(user, 'facts'), user.id);
      return false;
    }
    quotaCounted = true;
    return true;
  };
  const refund = async () => {
    if (quotaCounted && user) await refundQuota(user.id, 'facts');
    quotaCounted = false;
  };
  const reportQuotaHits = (hits: { provider: string; details: string }[]) => {
    for (const hit of hits) reportInBackground(reportProviderQuota(hit.provider, FUNCTION_NAME, hit.details, simulation !== null));
  };

  try {
    // 1. Identifiant
    const alias = normalizeAlias(name);
    if (!foodKey) foodKey = await keyFromAlias(alias);
    if (!foodKey) {
      if (linkOnly && user) {
        if (simulation?.user_quota || !await consumeQuota(user, 'links')) {
          logUserQuota(FUNCTION_NAME, 'links', dailyLimit(user, 'links'), user.id);
          return failure('user_quota', 429, { limit: dailyLimit(user, 'links') });
        }
      } else if (!await countQuota()) return failure('user_quota', 429, { limit: user ? dailyLimit(user, 'facts') : 0 });
      const log: AttemptLog[] = [];
      const resolved = await runWithFallback(PROVIDERS, {
        prompt: resolvePrompt(name),
        schema: RESOLVE_SCHEMA,
        schemaName: 'food_key',
        temperature: 0,
        maxOutputTokens: 1500,
      }, parseResolution, { label: FUNCTION_NAME, log, t0, simulate: simulation?.providers });
      reportQuotaHits(resolved.quotaHits);
      if (!resolved.ok) {
        await refund();
        if (linkOnly && user) await refundQuota(user.id, 'links');
        return resolved.reason === 'provider_quota' ? failure('provider_quota', 503) : failure('provider_error', 502);
      }
      if (!resolved.value.is_food || !resolved.value.food_key) {
        await refund();
        if (linkOnly && user) await refundQuota(user.id, 'links');
        return json({ error: 'not_food' }, 404);
      }
      foodKey = resolved.value.food_key;
    }
    if (ingredientId && user) await saveIngredientKey(ingredientId, foodKey, req.headers.get('Authorization') || '');
    if (linkOnly) return json({ food_key: foodKey });

    // 2. Fiche existante (ou en cours de génération ailleurs)
    const existing = await readFact(foodKey);
    if (existing?.status === 'ready') {
      await refund();
      if (alias) await rpc('add_food_fact_alias', { p_food_key: foodKey, p_alias: alias }).catch(() => {});
      return ready(foodKey, existing as { content: unknown; reviewed: boolean });
    }
    if (!await rpc('claim_food_fact', { p_food_key: foodKey })) {
      await refund();
      return json({ status: 'in_progress', food_key: foodKey }, 202);
    }

    // 3. Génération (une seule, pour tous)
    if (!await countQuota()) {
      await rpc('release_food_fact', { p_food_key: foodKey });
      return failure('user_quota', 429, { limit: user ? dailyLimit(user, 'facts') : 0 });
    }
    const log: AttemptLog[] = [];
    const key = foodKey;
    const generated = await runWithFallback(PROVIDERS, {
      system: FACT_SYSTEM,
      prompt: factPrompt(name || key.replace(/_/g, ' '), key),
      schema: FACT_SCHEMA,
      schemaName: 'food_fact',
      temperature: 0.3,
      maxOutputTokens: 6000,
    }, (text) => parseFact(text, name || key.replace(/_/g, ' '), key), { label: FUNCTION_NAME, log, t0, simulate: simulation?.providers });
    reportQuotaHits(generated.quotaHits);

    if (!generated.ok || 'not_food' in generated.value) {
      await rpc('release_food_fact', { p_food_key: key });
      await refund();
      if (generated.ok) return json({ error: 'not_food' }, 404);
      console.error(`[food-fact] ÉCHEC (${generated.reason}) pour ${key} : ${generated.failure}`);
      return generated.reason === 'provider_quota' ? failure('provider_quota', 503) : failure('provider_error', 502);
    }

    const { content, aliases } = generated.value;
    await rpc('save_food_fact', { p_food_key: key, p_content: content, p_aliases: aliases, p_model: `${generated.provider.name}:${generated.provider.model}` });
    console.log(`[food-fact] fiche ${key} générée par ${generated.provider.name} en ${Date.now() - t0} ms`);
    return ready(key, { content, reviewed: false });
  } catch (error) {
    console.error('[food-fact] erreur :', error);
    if (foodKey) await rpc('release_food_fact', { p_food_key: foodKey }).catch(() => {});
    await refund();
    return failure('provider_error', 500);
  }
}));
