// Nouvelles clés Supabase, injectées par la plateforme dans chaque Edge Function sous forme
// d'objets JSON { "<nom de la clé>": "<valeur>" }. On utilise la clé nommée « default ».
// Les anciennes clés (SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) ne sont plus utilisées.

function readKey(envName: string): string {
  const raw = Deno.env.get(envName);
  if (!raw) throw new Error(`${envName} absent de l'environnement de la fonction`);
  const keys = JSON.parse(raw) as Record<string, string>;
  const key = keys.default ?? Object.values(keys)[0];
  if (!key) throw new Error(`${envName} ne contient aucune clé`);
  return key;
}

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

// Clé publishable (sb_publishable_…) : sans droit particulier, sert d'en-tête apikey
export const SUPABASE_PUBLISHABLE_KEY = readKey('SUPABASE_PUBLISHABLE_KEYS');

// Clé secrète (sb_secret_…) : contourne la RLS, uniquement côté serveur (compteurs de quotas)
export const SUPABASE_SECRET_KEY = readKey('SUPABASE_SECRET_KEYS');
