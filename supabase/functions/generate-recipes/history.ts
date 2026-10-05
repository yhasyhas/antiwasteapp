// Titres à ne pas reproposer, transmis au prompt v4 : recettes notées « Pas pour nous », favoris (« Mes recettes ») et
// recettes récentes de l'utilisateur. Lecture côté serveur avec la clé secrète, pour l'utilisateur authentifié
// seulement ; une erreur de lecture ne bloque jamais la génération (liste vide).

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { mergeTitles, RECENT_TITLES } from './titles.ts';

export { RECENT_TITLES };
// Recettes « Pas pour nous » les plus récentes, toujours en tête de la liste
export const DISLIKED_TITLES = 10;

async function rows(path: string): Promise<any[]> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` } });
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

export async function recentTitles(userId: string): Promise<string[]> {
  const id = encodeURIComponent(userId);
  const [disliked, recent, favorites] = await Promise.all([
    rows(`recipes?select=title&user_id=eq.${id}&rating=eq.disliked&order=rated_at.desc&limit=${DISLIKED_TITLES}`),
    rows(`recipes?select=title&user_id=eq.${id}&order=created_at.desc&limit=${RECENT_TITLES}`),
    rows(`favorites?select=recipes(title)&user_id=eq.${id}&order=created_at.desc&limit=${RECENT_TITLES}`),
  ]);
  // Plats refusés d'abord (jamais coupés par la limite), puis favoris (plats que l'utilisateur garde), puis récents
  return mergeTitles(disliked.map((row) => row?.title), favorites.map((row) => row?.recipes?.title), recent.map((row) => row?.title));
}
