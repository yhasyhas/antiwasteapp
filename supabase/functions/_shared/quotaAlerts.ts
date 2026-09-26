// Quotas épuisés : journal clair, enregistrement en base (provider_quota_events) et alerte Sentry une fois
// par jour et par fournisseur. Rien ici ne doit faire échouer la requête de l'utilisateur.

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './keys.ts';

// DSN du projet Sentry (le même que l'app, public) ; sans lui, pas d'alerte, seulement les journaux
const SENTRY_DSN = Deno.env.get('SENTRY_DSN') || '';

export type QuotaProvider = 'gemini' | 'groq' | 'cloudflare';

export function logUserQuota(fn: string, kind: string, limit: number, userId: string) {
  console.warn(`[quota] QUOTA PERSONNEL ATTEINT (user_quota) : ${kind}, ${limit} par jour, fonction ${fn}, utilisateur ${userId}`);
}

async function sendSentryWarning(provider: string, fn: string, details: string, simulated: boolean) {
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
    logger: 'provider-quota',
    environment: simulated ? 'test' : 'production',
    message: { formatted: `Quota ${provider} épuisé (${fn}) le ${day}${simulated ? ' [simulé]' : ''}` },
    tags: { alert: 'provider_quota', provider, function: fn, day, simulated: String(simulated) },
    extra: { details: details.slice(0, 500) },
    // Un problème Sentry par fournisseur et par jour : chaque jour d'épuisement crée un nouveau problème
    fingerprint: ['provider-quota', provider, day, simulated ? 'test' : 'production'],
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
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_provider_quota`, {
      method: 'POST',
      // Clé secrète en apikey seulement (rôle service_role)
      headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_provider: provider, p_function: fn, p_error: details.slice(0, 500), p_simulated: simulated }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error(`[quota] enregistrement impossible : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      return;
    }
    const firstToday = await response.json();
    if (firstToday === true) await sendSentryWarning(provider, fn, details, simulated);
  } catch (error) {
    console.error('[quota] alerte impossible :', error);
  }
}

// Sans retarder la réponse à l'app : la fonction continue après l'envoi de la réponse
export function reportInBackground(task: Promise<unknown>) {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
}
