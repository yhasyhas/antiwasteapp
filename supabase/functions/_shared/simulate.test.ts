// Tests de la simulation d'erreurs de quota : prise en compte seulement avec la clé secrète.
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assertEquals } from 'jsr:@std/assert@1';

// Clés factices, posées avant le chargement de keys.ts (lu à l'import)
Deno.env.set('SUPABASE_PUBLISHABLE_KEYS', JSON.stringify({ default: 'sb_publishable_test' }));
Deno.env.set('SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'sb_secret_test' }));
const { readSimulation } = await import('./simulate.ts');

const request = (key?: string) => new Request('http://localhost', { method: 'POST', headers: key ? { 'x-simulate-key': key } : {} });
const body = { simulate: { user_quota: true, providers: { gemini: 'quota', groq: 'error', cloudflare: 'autre' } } };

Deno.test('simulation ignorée sans la clé secrète, ou avec une autre clé', () => {
  assertEquals(readSimulation(request(), body), null);
  assertEquals(readSimulation(request('sb_publishable_test'), body), null);
  assertEquals(readSimulation(request('mauvaise-clé'), body), null);
});

Deno.test('simulation lue avec la clé secrète ; valeurs inconnues écartées', () => {
  assertEquals(readSimulation(request('sb_secret_test'), body), { user_quota: true, providers: { gemini: 'quota', groq: 'error' } });
  assertEquals(readSimulation(request('sb_secret_test'), {}), null);
});
