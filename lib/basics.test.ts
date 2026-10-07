// « Mes basiques » dans l'app : même logique que le serveur, liste de l'utilisateur.
// Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import * as app from './basics.ts';
import * as server from '../supabase/functions/generate-recipes/basics.ts';

Deno.test('basiques : mêmes mots et même reconnaissance que le serveur', () => {
  assertEquals(app.BASIC_WORDS, server.BASIC_WORDS);
  assertEquals(app.DEFAULT_BASICS, server.DEFAULT_BASICS);
  const names = ['sel fin', 'poivron rouge', 'red bell pepper', 'beurre de cacahuète', 'beurre', 'cumin', 'ail', 'sauce soja', 'Aceite de oliva', 'feuilles de laurier'];
  for (const basics of [server.DEFAULT_BASICS, ['salt', 'garlic', 'spices', 'butter', 'sauce soja'], []]) {
    for (const name of names) assertEquals(app.isBasicFor(name, basics), server.isBasicFor(name, basics), `${name} / ${basics.join(',')}`);
  }
  for (const raw of [undefined, [], ['salt', 'Salt', 'sauce soja']]) assertEquals(app.cleanBasics(raw), server.cleanBasics(raw));
});

Deno.test('basiques de l’utilisateur : liste par défaut, puis la sienne', () => {
  app.setUserBasics(null);
  assert(app.isBasic('huile d’olive') && !app.isBasic('ail'));
  app.setUserBasics(['oil', 'garlic', 'spices']);
  assert(app.isBasic('gousse d’ail') && app.isBasic('paprika fumé') && !app.isBasic('sel'));
  assertEquals(app.getUserBasics(), ['oil', 'garlic', 'spices']);
  // Toutes les suggestions sont des basiques connus
  assert(app.SUGGESTED_BASICS.every(app.isKnownBasic));
  app.setUserBasics(null);
});
