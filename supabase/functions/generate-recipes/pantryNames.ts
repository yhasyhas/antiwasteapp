// Noms du garde-manger dans la langue de la recette, côté serveur : un aliment écrit dans une autre langue
// (« ground beef » pour une recette en français) est retrouvé par les alias des fiches (food_facts.aliases, trois
// langues) et envoyé au modèle sous le nom de la fiche dans la langue de la recette (« Viande hachée »). L'app envoie
// déjà le nom de la fiche pour un aliment relié ; ceci couvre les aliments pas encore reliés. Les restes de plats
// gardent leur nom. Une erreur de lecture ne bloque jamais la génération (noms inchangés).

import { SUPABASE_SECRET_KEY, SUPABASE_URL } from '../_shared/keys.ts';
import { normalizeAlias } from '../_shared/foodKey.ts';
import type { Pantry } from './recipes.ts';

export interface FactNames {
  aliases: string[];
  fr?: string | null;
  en?: string | null;
  es?: string | null;
}

// Alias d'un nom, puis ses formes au singulier (« patatas » → « patata », « pork chops » → « pork chop ») : les fiches
// n'ont souvent que le singulier dans l'une des langues
export function aliasForms(name: string): string[] {
  const alias = normalizeAlias(name);
  const words = alias.split(' ');
  const strip = (suffix: string) => words.map((word) => (word.length > 3 + suffix.length - 1 && word.endsWith(suffix) ? word.slice(0, -suffix.length) : word)).join(' ');
  return [...new Set([alias, strip('s'), strip('es')])];
}

// Renomme les aliments reconnus ; renvoie le nombre de noms changés
export function translatePantryNames(pantry: Pantry, facts: FactNames[], language: string): number {
  let changed = 0;
  for (const item of pantry.items) {
    if (item.kind === 'dish') continue;
    const forms = aliasForms(item.name);
    const fact = forms.map((form) => facts.find((row) => Array.isArray(row.aliases) && row.aliases.includes(form))).find(Boolean);
    const name = fact?.[language as 'fr' | 'en' | 'es'];
    if (typeof name === 'string' && name.trim() !== '' && !forms.includes(normalizeAlias(name))) {
      item.name = name.trim();
      changed++;
    }
  }
  return changed;
}

// Fiches dont un alias correspond à un aliment du garde-manger (une seule requête, 3 s au plus)
export async function factNamesFor(pantry: Pantry): Promise<FactNames[]> {
  const aliases = [...new Set(pantry.items.filter((item) => item.kind !== 'dish').flatMap((item) => aliasForms(item.name)).filter((alias) => alias.length >= 2))];
  if (aliases.length === 0 || !SUPABASE_URL || !SUPABASE_SECRET_KEY) return [];
  const list = `{${aliases.map((alias) => `"${alias}"`).join(',')}}`;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/food_facts?select=aliases,fr:content->fr->>name,en:content->en->>name,es:content->es->>name&status=eq.ready&aliases=ov.${encodeURIComponent(list)}`,
      { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` }, signal: AbortSignal.timeout(3000) },
    );
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}
