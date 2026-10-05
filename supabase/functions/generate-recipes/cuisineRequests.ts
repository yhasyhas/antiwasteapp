// « Autre cuisine… » : demande enregistrée sans donnée personnelle (texte nettoyé, langue, date), pour repérer les
// cuisines à ajouter (table cuisine_requests, clé secrète). Une erreur n'empêche jamais la génération.

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';

export async function recordCuisineRequest(cuisine: string, language: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !['fr', 'en', 'es'].includes(language)) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cuisine_requests`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ cuisine, language }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.error(`[cuisine] demande non enregistrée : HTTP ${response.status}`);
  } catch (error) {
    console.error('[cuisine] demande non enregistrée :', error);
  }
}
