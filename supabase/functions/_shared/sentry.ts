// Envoi d'un événement à Sentry depuis une fonction (alertes des quotas, avis des utilisateurs, recettes signalées).
// Sentry envoie un email pour chaque nouveau problème : l'empreinte (fingerprint) décide de ce qui en crée un.
// Rien ici ne doit faire échouer la requête de l'utilisateur.

// DSN du projet Sentry (le même que l'app, public) ; sans lui, pas d'événement, seulement les journaux
const SENTRY_DSN = Deno.env.get('SENTRY_DSN') || '';

export interface SentryEvent {
  level: 'info' | 'warning' | 'error';
  logger: string;
  message: string;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint: string[];
  // Essai (clé secrète) : environnement « test », séparé des vraies alertes
  test?: boolean;
}

export async function sendSentryEvent(event: SentryEvent): Promise<boolean> {
  if (!SENTRY_DSN) {
    console.warn('[sentry] SENTRY_DSN absent : pas d\'événement Sentry');
    return false;
  }
  const dsn = new URL(SENTRY_DSN);
  const projectId = dsn.pathname.replace(/\//g, '');
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const payload = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: event.level,
    logger: event.logger,
    environment: event.test ? 'test' : 'production',
    message: { formatted: `${event.message}${event.test ? ' [essai]' : ''}` },
    tags: { ...event.tags, simulated: String(!!event.test) },
    extra: event.extra ?? {},
    fingerprint: [...event.fingerprint, event.test ? 'test' : 'production'],
  };
  const body = [JSON.stringify({ event_id: eventId, dsn: SENTRY_DSN }), JSON.stringify({ type: 'event' }), JSON.stringify(payload)].join('\n');
  try {
    const response = await fetch(`https://${dsn.host}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.username}, sentry_client=antigaspi-functions/1.0`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`[sentry] événement refusé : HTTP ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('[sentry] envoi impossible :', error);
    return false;
  }
}
