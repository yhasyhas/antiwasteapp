import { assertEquals } from 'jsr:@std/assert@1';
import { buildPantry } from './recipes.ts';
import { translatePantryNames } from './pantryNames.ts';

const FACTS = [
  { aliases: ['viande hachee', 'ground beef', 'carne picada'], fr: 'Viande hachée', en: 'Ground beef', es: 'Carne picada' },
  { aliases: ['oignon', 'onion', 'cebolla', 'oignons', 'onions', 'cebollas'], fr: 'Oignon', en: 'Onion', es: 'Cebolla' },
  { aliases: ['lait', 'milk', 'leche'], fr: 'Lait', en: 'Milk', es: 'Leche' },
];

Deno.test('noms du garde-manger traduits dans la langue de la recette par les alias des fiches', () => {
  const pantry = buildPantry([
    { id: 'a', name: 'ground beef', quantity: '500 g' },
    { id: 'b', name: 'Onions', quantity: '2' },
    { id: 'c', name: 'lait', quantity: '1 l' },
    // Inconnu des fiches, ou reste de plat : nom inchangé
    { id: 'd', name: 'Pomme framboise sans sucres ajoutés', quantity: '0.4 kg' },
    { id: 'e', name: 'onion', quantity: '1 bol', kind: 'dish' },
  ]);
  assertEquals(translatePantryNames(pantry, FACTS, 'fr'), 2);
  assertEquals(pantry.items.map((item) => item.name), ['Viande hachée', 'Oignon', 'lait', 'Pomme framboise sans sucres ajoutés', 'onion']);
  // Le même objet est derrière les alias p1, p2… du prompt
  assertEquals([...pantry.aliasOf.values()].map((item) => item.name), pantry.items.map((item) => item.name));
});

Deno.test('noms du garde-manger : déjà dans la bonne langue, ou fiches illisibles : rien ne change', () => {
  const pantry = buildPantry([{ id: 'a', name: 'Milk', quantity: '1 l' }]);
  assertEquals(translatePantryNames(pantry, FACTS, 'en'), 0);
  assertEquals(translatePantryNames(pantry, [], 'fr'), 0);
  assertEquals(pantry.items[0].name, 'Milk');
});
