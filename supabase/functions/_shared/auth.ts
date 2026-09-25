// Vérifie l'utilisateur connecté à partir du jeton envoyé par l'app (en-tête Authorization).
// Renvoie son identifiant, ou null si le jeton est absent, expiré, ou s'il ne s'agit pas
// d'un utilisateur (par exemple une clé d'API seule).

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './keys.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authorization = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authorization)) return null;

  // Le serveur d'authentification de Supabase ne répond 200 que pour un jeton d'utilisateur valide
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) return null;

  const user = await response.json();
  return typeof user?.id === 'string' ? { id: user.id, email: user.email } : null;
}
