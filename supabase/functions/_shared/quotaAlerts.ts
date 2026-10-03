// Quotas épuisés et échecs d'envoi des notifications push : journal clair, enregistrement en base
// (provider_quota_events) et alerte Sentry une fois par jour et par fournisseur. Rien ici ne doit faire
// échouer la requête de l'utilisateur.

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './keys.ts';

// DSN du projet Sentry (le même que l'app, public) ; sans lui, pas d'alerte, seulement les journaux
const SENTRY_DSN = Deno.env.get('SENTRY_DSN') || '';

export type QuotaProvider = 'gemini' | 'groq' | 'cloudflare';

export function logUserQuota(fn: string, kind: string, limit: number, userId: string) {
  console.warn(`[quota] QUOTA PERSONNEL ATTEINT (user_quota) : ${kind}, ${limit} par jour, fonction ${fn}, utilisateur ${userId}`);
}

// Type d'alerte (tag Sentry « alert ») : quota d'un fournisseur d'IA épuisé, échec d'envoi des
// notifications push (Expo Push), ou dysfonctionnement d'un fournisseur d'IA (réponse refusée, schéma
// invalide, réponse illisible : ni quota ni surcharge)
export type AlertKind = 'provider_quota' | 'push_failure' | 'provider_failure';

const LOGGERS: Record<AlertKind, string> = { provider_quota: 'provider-quota', push_failure: 'push-failure', provider_failure: 'provider-failure' };

function alertMessage(alert: AlertKind, provider: string, fn: string, day: string) {
  if (alert === 'push_failure') return `Échec d'envoi des notifications push (${fn}) le ${day}`;
  if (alert === 'provider_failure') return `Échec de ${provider} (réponse refusée ou non conforme, secours utilisé) (${fn}) le ${day}`;
  return `Quota ${provider} épuisé (${fn}) le ${day}`;
}

// Exportée pour vérifier l'envoi en local (même format que les alertes des fonctions)
export async function sendSentryWarning(provider: string, fn: string, details: string, simulated: boolean, alert: AlertKind = 'provider_quota') {
  if (!SENTRY_DSN) {
    console.warn('[quota] SENTRY_DSN absent : pas d\'alerte Sentry');
    return;
  }
  const dsn = new URL(SENTRY_DSN);
  const projectId = dsn.pathname.replace(/\//g, '');
  const day = new Date().toISOString().slice(0, 10);
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'warning',
    logger: LOGGERS[alert],
    environment: simulated ? 'test' : 'production',
    message: {
      formatted: `${alertMessage(alert, provider, fn, day)}${simulated ? ' [simulé]' : ''}`,
    },
    tags: { alert, provider, function: fn, day, simulated: String(simulated) },
    extra: { details: details.slice(0, 500) },
    // Un problème Sentry par type, fournisseur et jour : chaque jour d'échec crée un nouveau problème
    fingerprint: [LOGGERS[alert], provider, day, simulated ? 'test' : 'production'],
  };
  const body = [JSON.stringify({ event_id: eventId, dsn: SENTRY_DSN }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
  const response = await fetch(`https://${dsn.host}/api/${projectId}/envelope/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.username}, sentry_client=antigaspi-functions/1.0`,
    },
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) console.error(`[quota] alerte Sentry refusée : HTTP ${response.status}`);
  else console.log(`[quota] alerte Sentry envoyée : ${provider} (${fn})${simulated ? ' [simulé]' : ''}`);
}

// Quota d'un fournisseur épuisé : journal, base, et alerte Sentry si c'est le premier épuisement du jour
// pour ce fournisseur
export async function reportProviderQuota(provider: string, fn: string, details: string, simulated = false) {
  console.error(`[quota] QUOTA FOURNISSEUR ÉPUISÉ (provider_quota) : ${provider}, fonction ${fn}${simulated ? ' [simulé]' : ''} : ${details.slice(0, 200)}`);
  await recordAndAlert(provider, fn, details, simulated, 'provider_quota');
}

// Échec d'envoi des notifications push : journal, base (fournisseur expo_push), alerte Sentry une fois par jour
export async function reportPushFailure(fn: string, details: string, simulated = false) {
  console.error(`[push] ÉCHEC D'ENVOI (expo_push) : fonction ${fn}${simulated ? ' [simulé]' : ''} : ${details.slice(0, 200)}`);
  await recordAndAlert('expo_push', fn, details, simulated, 'push_failure');
}

// Dysfonctionnement d'un fournisseur d'IA (le secours a pu répondre) : journal, base, alerte Sentry une
// fois par jour et par fournisseur (tag alert:provider_failure)
export async function reportProviderFailure(provider: string, fn: string, details: string, simulated = false) {
  console.error(`[ai] DYSFONCTIONNEMENT (provider_failure) : ${provider}, fonction ${fn}${simulated ? ' [simulé]' : ''} : ${details.slice(0, 200)}`);
  await recordAndAlert(provider, fn, details, simulated, 'provider_failure');
}

// Génération servie : décompte par jour et par fournisseur, secours distingué (« État des services »)
export async function recordProviderUsage(fn: string, provider: string, fallback: boolean, recipes: number, simulated = false) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_provider_usage`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_function: fn, p_provider: provider, p_fallback: fallback, p_recipes: recipes, p_simulated: simulated }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`[ai] décompte impossible : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  } catch (error) {
    console.error('[ai] décompte impossible :', error);
  }
}

async function recordAndAlert(provider: string, fn: string, details: string, simulated: boolean, alert: AlertKind) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_provider_quota`, {
      method: 'POST',
      // Clé secrète en apikey seulement (rôle service_role)
      headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_provider: provider, p_function: fn, p_error: details.slice(0, 500), p_simulated: simulated, p_alert: alert }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`[quota] enregistrement impossible : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      return;
    }
    const firstToday = await response.json();
    if (firstToday === true) await sendSentryWarning(provider, fn, details, simulated, alert);
  } catch (error) {
    console.error('[quota] alerte impossible :', error);
  }
}

// Sans retarder la réponse à l'app : la fonction continue après l'envoi de la réponse
export function reportInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
}
