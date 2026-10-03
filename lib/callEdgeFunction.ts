import { supabase, supabasePublishableKey, supabaseUrl } from './supabase';

export class SessionExpiredError extends Error {}

// Appelle une Edge Function avec le jeton de l'utilisateur connecté : les fonctions refusent
// les appels anonymes (401). Renvoie la réponse HTTP et son corps JSON (null s'il est illisible).
// timeoutMs : délai maximum, au-delà la requête est annulée (erreur levée, l'écran ne reste jamais bloqué)
export async function callEdgeFunction(name: string, body: unknown, timeoutMs?: number) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new SessionExpiredError();

  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  clearTimeout(timer);
  return { response, data };
}
