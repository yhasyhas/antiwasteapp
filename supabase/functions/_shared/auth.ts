// Vérifie l'utilisateur connecté à partir du jeton envoyé par l'app (en-tête Authorization).
// Renvoie son identifiant, ou null si le jeton est absent, expiré, ou s'il ne s'agit pas
// d'un utilisateur (par exemple une clé d'API seule).
//
// Les jetons sont signés avec une clé asymétrique (ES256) : leur signature est vérifiée sur place avec
// la clé publique du projet, sans appel réseau (environ 0,3 à 0,5 s gagnées par scan). Conséquence :
// un jeton reste accepté jusqu'à son expiration (1 h au plus), même après une déconnexion.
// Si aucune clé publique ne correspond (rotation de clé, ancien jeton HS256), on demande au serveur
// d'authentification, comme avant.

import { createLocalJWKSet, createRemoteJWKSet, errors, jwtVerify } from 'npm:jose@5.9.6';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './keys.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

const ISSUER = `${SUPABASE_URL}/auth/v1`;

// Clés publiques fournies par la plateforme (SUPABASE_JWKS), sinon téléchargées une fois puis gardées en cache
function publicKeys() {
  try {
    const jwks = JSON.parse(Deno.env.get('SUPABASE_JWKS') || '');
    if (Array.isArray(jwks?.keys) && jwks.keys.length > 0) return createLocalJWKSet(jwks);
  } catch {
    // variable absente ou illisible : clés téléchargées
  }
  return createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
}

const PUBLIC_KEYS = publicKeys();

// Vérification par le serveur d'authentification : il ne répond 200 que pour un jeton d'utilisateur valide
async function fetchUser(authorization: string): Promise<AuthenticatedUser | null> {
  const response = await fetch(`${ISSUER}/user`, {
    headers: { Authorization: authorization, apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) return null;

  const user = await response.json();
  return typeof user?.id === 'string' ? { id: user.id, email: user.email } : null;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, PUBLIC_KEYS, { issuer: ISSUER, audience: 'authenticated' });
    if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') return null;
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch (error) {
    // Aucune clé publique ne correspond, ou algorithme non pris en charge : le serveur tranche
    if (error instanceof errors.JWKSNoMatchingKey || error instanceof errors.JOSENotSupported) {
      return await fetchUser(authorization);
    }
    // Jeton expiré, signature invalide, clé d'API (pas un jeton) : refusé
    return null;
  }
}
