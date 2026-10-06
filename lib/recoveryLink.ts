// Lien de réinitialisation du mot de passe (« Mot de passe oublié ») : l'e-mail mène au serveur d'authentification,
// qui ouvre l'app sur myapp://auth/reset#access_token=…&refresh_token=…&type=recovery (ou, si le lien a expiré,
// #error=…&error_code=otp_expired). Aucune dépendance : testé avec Deno (lib/recoveryLink.test.ts).

export type RecoveryLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string }
  | { kind: 'none' };

// Paramètres du fragment (#…) et de la requête (?…), le fragment l'emportant
function params(url: string): Map<string, string> {
  const result = new Map<string, string>();
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  for (const part of [query, hash]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const at = pair.indexOf('=');
      const key = decodeURIComponent(at >= 0 ? pair.slice(0, at) : pair);
      const value = at >= 0 ? decodeURIComponent(pair.slice(at + 1).replace(/\+/g, ' ')) : '';
      result.set(key, value);
    }
  }
  return result;
}

export function parseRecoveryLink(url: string | null | undefined): RecoveryLink {
  if (!url) return { kind: 'none' };
  const values = params(url);
  const error = values.get('error_code') || values.get('error');
  if (error) return { kind: 'error', code: error };
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');
  if (accessToken && refreshToken && (values.get('type') ?? 'recovery') === 'recovery') return { kind: 'session', accessToken, refreshToken };
  return { kind: 'none' };
}
