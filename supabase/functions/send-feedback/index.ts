import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { withCors } from '../_shared/cors.ts';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { sendSentryEvent } from '../_shared/sentry.ts';
import { appEnvironment, cleanFeedback, cleanReport, type Feedback, type Report } from './validate.ts';

// « Donner mon avis » (Réglages) et « Signaler un problème » (recette) : enregistrement en base avec le jeton de
// l'utilisateur (règles d'accès, 20 envois par jour au plus), puis événement Sentry : chaque avis, et chaque recette
// signalée « dangereuse », crée un nouveau problème Sentry, donc un email. Aucune donnée personnelle envoyée à Sentry
// (ni e-mail ni identifiant d'utilisateur), seulement le texte saisi et les informations techniques.
// Essai avec la clé secrète (en-tête x-simulate-key) : événement Sentry dans l'environnement « test ».

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function asUser(authorization: string) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, 'Content-Type': 'application/json' };
}

// Insertion avec le jeton de l'utilisateur ; null et la raison si refusée
async function insert(table: string, row: Record<string, unknown>, authorization: string): Promise<{ id: string } | { error: 'daily_limit' | 'rejected' }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id`, {
    method: 'POST',
    headers: { ...asUser(authorization), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (response.ok) return { id: (await response.json())[0].id };
  const text = await response.text();
  console.warn(`[send-feedback] ${table} refusé : HTTP ${response.status} ${text.slice(0, 200)}`);
  return { error: text.includes('daily_limit') ? 'daily_limit' : 'rejected' };
}

// Recette de l'utilisateur (règles d'accès) : copie gardée avec le signalement
async function loadRecipe(recipeId: string, authorization: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}&select=title,description,ingredients_used,instructions,tips,cuisine,meal_type,dietary_tags,created_at`,
    { headers: asUser(authorization) },
  );
  if (!response.ok) return null;
  return (await response.json())[0] ?? null;
}

const KIND_LABELS: Record<Feedback['kind'], string> = { problem: 'Problème', idea: 'Idée', other: 'Autre' };

async function sendFeedback(feedback: Feedback, userId: string, authorization: string, test: boolean, environment: string): Promise<Response> {
  const saved = await insert('feedback', { user_id: userId, ...feedback }, authorization);
  if ('error' in saved) return jsonResponse({ error: saved.error }, saved.error === 'daily_limit' ? 429 : 400);
  await sendSentryEvent({
    level: feedback.kind === 'problem' ? 'warning' : 'info',
    logger: 'feedback',
    message: `Avis (${KIND_LABELS[feedback.kind]}) : ${feedback.message.replace(/\s+/g, ' ').slice(0, 90)}`,
    tags: { feedback: feedback.kind, app_version: feedback.app_version ?? '?', app_environment: environment, os: feedback.os ?? '?', language: feedback.language ?? '?' },
    extra: { message: feedback.message, device: feedback.device, feedback_id: saved.id },
    // Un problème Sentry (donc un email) par avis
    fingerprint: ['feedback', saved.id],
    test,
    environment,
  });
  return jsonResponse({ ok: true }, 200);
}

async function sendReport(report: Report, userId: string, authorization: string, test: boolean, environment: string): Promise<Response> {
  const recipe = await loadRecipe(report.recipe_id, authorization);
  if (!recipe) return jsonResponse({ error: 'not_found' }, 404);
  const saved = await insert('recipe_reports', { user_id: userId, ...report, recipe_snapshot: recipe }, authorization);
  if ('error' in saved) return jsonResponse({ error: saved.error }, saved.error === 'daily_limit' ? 429 : 400);
  // Seules les recettes signalées dangereuses déclenchent une alerte ; les autres raisons restent en base
  if (report.reason === 'dangerous') {
    await sendSentryEvent({
      level: 'error',
      logger: 'recipe-report',
      message: `Recette signalée dangereuse : ${String(recipe.title ?? '').slice(0, 90)}`,
      tags: { alert: 'recipe_dangerous', language: report.language ?? '?' },
      extra: { comment: report.comment, report_id: saved.id, recipe_id: report.recipe_id, instructions: recipe.instructions },
      fingerprint: ['recipe-dangerous', saved.id],
      test,
      environment,
    });
  }
  return jsonResponse({ ok: true }, 200);
}

Deno.serve(withCors(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const user = await getAuthenticatedUser(req);
    if (!user) return jsonResponse({ error: 'unauthorized' }, 401);
    const authorization = req.headers.get('Authorization') || '';
    const test = !!SUPABASE_SECRET_KEY && req.headers.get('x-simulate-key') === SUPABASE_SECRET_KEY;

    if (body?.type === 'feedback') {
      const feedback = cleanFeedback(body);
      return feedback ? await sendFeedback(feedback, user.id, authorization, test, appEnvironment(body)) : jsonResponse({ error: 'bad_request' }, 400);
    }
    if (body?.type === 'recipe_report') {
      const report = cleanReport(body);
      return report ? await sendReport(report, user.id, authorization, test, appEnvironment(body)) : jsonResponse({ error: 'bad_request' }, 400);
    }
    return jsonResponse({ error: 'bad_request' }, 400);
  } catch (error) {
    console.error('[send-feedback] erreur :', error);
    return jsonResponse({ error: 'server_error' }, 500);
  }
}));
