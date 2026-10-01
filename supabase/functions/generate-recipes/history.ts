// Titres des recettes récentes de l'utilisateur (historique) et de ses favoris (« Mes recettes »), transmis au
// prompt v4 pour ne pas reproposer le même plat. Lecture côté serveur avec la clé secrète, pour l'utilisateur
// authentifié seulement ; une erreur de lecture ne bloque jamais la génération (liste vide).

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';

export const RECENT_TITLES = 30;

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
  const [recent, favorites] = await Promise.all([
    rows(`recipes?select=title&user_id=eq.${id}&order=created_at.desc&limit=${RECENT_TITLES}`),
    rows(`favorites?select=recipes(title)&user_id=eq.${id}&order=created_at.desc&limit=${RECENT_TITLES}`),
  ]);
  const titles = [...favorites.map((row) => row?.recipes?.title), ...recent.map((row) => row?.title)]
    .filter((title): title is string => typeof title === 'string' && title.trim() !== '');
  // Sans doublon, favoris d'abord (plats que l'utilisateur garde), au plus RECENT_TITLES
  return [...new Set(titles.map((title) => title.trim()))].slice(0, RECENT_TITLES);
}
