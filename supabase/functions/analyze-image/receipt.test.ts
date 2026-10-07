// Règles du ticket de caisse (receipt.ts). Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { applyReceiptRules, RECEIPT_SCHEMA, receiptDecision } from './receipt.ts';
import { cleanIngredients } from './ingredients.ts';

const item = (receipt_line: string, name: string, category = 'other', extra: Record<string, unknown> = {}) => ({
  receipt_line, name, category, quantity: '', confidence: 0.9, kind: 'ingredient', storage_tip: 'Au frigo', shelf_life_days: 5, food_key: 'x', ...extra,
});

Deno.test('ticket : jouets, peluches et produits ménagers écartés, même avec un nom d’aliment ou d’animal', () => {
  // Ticket de l'utilisateur (phase 10) : « SQUISH SEA TURTLE » devenu « Sea turtle » au frigo
  assertEquals(receiptDecision(item('SQUISH SEA TURTLE 0884920471325', 'Sea turtle', 'meat')), 'non_food');
  assertEquals(receiptDecision(item('SQUAWKING PARROT TOY 7765', 'Parrot', 'meat')), 'non_food');
  assertEquals(receiptDecision(item('PLUSH BANANA 30CM', 'Banana', 'fruit')), 'non_food');
  assertEquals(receiptDecision(item('PELUCHE CAROTTE', 'Carotte', 'vegetable')), 'non_food');
  assertEquals(receiptDecision(item('LESSIVE LIQ CITRON 2L', 'Citron', 'fruit')), 'non_food');
  assertEquals(receiptDecision(item('EPONGE X3', 'éponge', 'other')), 'non_food');
  assertEquals(receiptDecision(item('BOLSA PAPEL', 'bolsa', 'other')), 'non_food');
});

Deno.test('ticket : aliment invraisemblable en supermarché écarté', () => {
  assertEquals(receiptDecision(item('SEA TURTLE 2349872349', 'Tortue de mer', 'fish')), 'implausible');
  assertEquals(receiptDecision(item('DINO 99887766', 'Dinosaure', 'meat')), 'implausible');
  assertEquals(receiptDecision(item('DRAGON', 'Dragon', 'other')), 'implausible');
  assertEquals(receiptDecision(item('PITAYA', 'Fruit du dragon', 'fruit')), 'food');
});

Deno.test('ticket : produit déjà cuit devenu plat cuisiné, date courte et réchauffage à cœur', () => {
  assertEquals(receiptDecision(item('ROTISSERIE CHICKEN', 'Chicken', 'meat')), 'cooked');
  assertEquals(receiptDecision(item('POULET ROTI FERMIER', 'Poulet', 'meat')), 'cooked');
  assertEquals(receiptDecision(item('TABOULE TRAITEUR 300G', 'Taboulé', 'other')), 'cooked');
  assertEquals(receiptDecision(item('LASAGNES BOLO 1KG', 'Lasagnes', 'grain')), 'cooked');
  // Pas des plats : charcuterie, café torréfié, noisettes grillées, plat surgelé à cuire
  assertEquals(receiptDecision(item('JAMBON CUIT 4T', 'Jambon', 'meat')), 'food');
  assertEquals(receiptDecision(item('CAFE ROAST 250G', 'Café', 'beverage')), 'food');
  assertEquals(receiptDecision(item('NOISETTES GRILLEES', 'Noisettes', 'snack')), 'food');
  assertEquals(receiptDecision(item('LASAGNES SURG 1KG', 'Lasagnes', 'frozen')), 'food');

  const { kept, dropped } = applyReceiptRules([item('ROTISSERIE CHICKEN', 'Chicken', 'meat', { shelf_life_days: 2 }), item('SQUISH SEA TURTLE 0884920471325', 'Sea turtle', 'meat'), item('TOM GRAPPE 1KG', 'Tomate', 'vegetable')], 'fr');
  assertEquals(dropped.map((d) => d.reason), ['non_food']);
  const cleaned = cleanIngredients(kept);
  const chicken = cleaned.find((i) => i.name === 'Chicken')!;
  assertEquals(chicken.kind, 'dish');
  assert(chicken.shelf_life_days <= 3);
  assertEquals(chicken.food_key, null);
  assert(chicken.storage_tip.includes('réchauffer à cœur'));
  assertEquals(cleaned.find((i) => i.name === 'Tomate')?.kind, 'ingredient');
  // Pizza surgelée classée « plat » par le modèle : produit surgelé, jamais un plat cuisiné
  const frozen = applyReceiptRules([item('PIZZA SURG 4 FROM', 'Pizza surgelée', 'frozen', { kind: 'dish' })], 'fr').kept;
  assertEquals(frozen[0].kind, 'ingredient');
});

Deno.test('ticket : schéma avec le texte exact de chaque ligne', () => {
  const items = (RECEIPT_SCHEMA.properties.ingredients as any).items;
  assert(items.required.includes('receipt_line') && items.properties.receipt_line);
  assertEquals(items.additionalProperties, false);
});
