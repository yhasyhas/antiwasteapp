// Tests de l'identifiant standard des aliments et de la normalisation des noms (alias des fiches).
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assertEquals } from 'jsr:@std/assert@1';
import { normalizeAlias, normalizeFoodKey } from './foodKey.ts';

Deno.test('food_key : minuscules, « _ » entre les mots, accents et symboles retirés, format vérifié', () => {
  assertEquals(normalizeFoodKey('Banana'), 'banana');
  assertEquals(normalizeFoodKey(' Cherry Tomato '), 'cherry_tomato');
  assertEquals(normalizeFoodKey('crème-fraîche'), 'creme_fraiche');
  assertEquals(normalizeFoodKey("chef's knife!"), 'chef_s_knife');
  assertEquals(normalizeFoodKey(''), null);
  assertEquals(normalizeFoodKey('7up'), null);
  assertEquals(normalizeFoodKey(42), null);
});

Deno.test('alias : minuscules, sans accents ni ponctuation', () => {
  assertEquals(normalizeAlias('Bananes  mûres !'), 'bananes mures');
  assertEquals(normalizeAlias("Beurre d'arachide"), 'beurre d arachide');
});
