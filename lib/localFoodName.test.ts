// Nom d'un aliment dans une langue (localFoodName.ts) et sa copie du résumé quotidien du serveur, qui doivent
// rester identiques. Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { localFoodName } from './localFoodName.ts';
import { digestContent, localFoodName as serverLocalFoodName } from '../supabase/functions/_shared/digestText.ts';

const salmon = { fr: 'saumon', en: 'salmon', es: 'salmón' };
const CASES: [Parameters<typeof localFoodName>[0], Parameters<typeof localFoodName>[1], string, string][] = [
  // Aliment brut relié à sa fiche : nom de la fiche dans la langue de l'utilisateur
  [{ name: 'saumon', food_key: 'salmon', kind: 'ingredient' }, salmon, 'en', 'salmon'],
  [{ name: 'saumon', food_key: 'salmon', kind: 'ingredient' }, salmon, 'es', 'salmón'],
  [{ name: 'salmon', food_key: 'salmon' }, salmon, 'fr', 'saumon'],
  // Produit de marque (code-barres) : son nom, même avec une fiche
  [{ name: 'Saumon fumé Labeyrie', food_key: 'salmon', barcode: '3033610048510' }, salmon, 'en', 'Saumon fumé Labeyrie'],
  // Reste (plat cuisiné) : son nom
  [{ name: 'reste de curry', food_key: 'salmon', kind: 'dish' }, salmon, 'en', 'reste de curry'],
  // Sans fiche, fiche absente ou sans cette langue : nom saisi
  [{ name: 'fonio', food_key: null }, null, 'en', 'fonio'],
  [{ name: 'fonio', food_key: 'fonio' }, null, 'en', 'fonio'],
  [{ name: 'saumon', food_key: 'salmon' }, { fr: 'saumon', en: '' }, 'en', 'saumon'],
  [{ name: 'saumon', food_key: 'salmon' }, salmon, 'de', 'saumon'],
];

Deno.test('nom d’un aliment : fiche dans la langue de l’utilisateur, marque et restes inchangés, nom saisi à défaut', () => {
  for (const [item, names, language, expected] of CASES) assertEquals(localFoodName(item, names, language), expected);
});

Deno.test('résumé quotidien du serveur : même règle que l’app', () => {
  for (const [item, names, language] of CASES) assertEquals(serverLocalFoodName(item, names, language), localFoodName(item, names, language));
});

Deno.test('résumé en anglais avec des noms traduits (essai du 08/10/2026 : « saumon » dans un résumé anglais)', () => {
  const today = [{ id: '1', name: localFoodName({ name: 'saumon', food_key: 'salmon' }, salmon, 'en') }];
  assertEquals(digestContent(today, [], 9, 'en').body, 'Today: salmon. 3 recipes are waiting for you.');
});
