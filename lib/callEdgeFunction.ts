import { supabase, supabasePublishableKey, supabaseUrl } from './supabase';

export class SessionExpiredError extends Error {}

// Appelle une Edge Function avec le jeton de l'utilisateur connecté : les fonctions refusent
// les appels anonymes (401). Renvoie la réponse HTTP et son corps JSON (null s'il est illisible).
export async function callEdgeFunction(name: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new SessionExpiredError();

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}
