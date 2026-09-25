// Tests de la validation des réponses du scan (schéma, nettoyage, valeurs par défaut).
// Lancement : deno test --no-config supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { cleanIngredients, cleanShelfLife, DEFAULT_SHELF_LIFE_DAYS, MAX_INGREDIENTS, MAX_SHELF_LIFE_DAYS, parseIngredients, RESPONSE_SCHEMA, validateResponse } from './ingredients.ts';

const item = (overrides: Record<string, unknown> = {}) => ({
  name: 'tomate',
  quantity: '3',
  category: 'vegetable',
  confidence: 0.9,
  kind: 'ingredient',
  storage_tip: 'Au frigo, 5 jours.',
  shelf_life_days: 5,
  ...overrides,
});

Deno.test('schéma : tous les champs requis, aucun champ en plus (mode strict de Groq)', () => {
  const items = (RESPONSE_SCHEMA.properties.ingredients as any).items;
  assertEquals(items.required, ['name', 'quantity', 'category', 'confidence', 'kind', 'storage_tip', 'shelf_life_days']);
  assertEquals(items.additionalProperties, false);
  assertEquals(items.properties.kind.enum, ['ingredient', 'dish']);
});

Deno.test('réponse valide : aliments conservés avec kind et storage_tip', () => {
  const result = parseIngredients(JSON.stringify({ ingredients: [item(), item({ name: 'gratin de pâtes', kind: 'dish', category: 'other' })] }));
  assert(result.ok);
  assertEquals(result.value.ingredients.map((i) => [i.name, i.kind]), [['tomate', 'ingredient'], ['gratin de pâtes', 'dish']]);
  assertEquals(result.value.ingredients[0].storage_tip, 'Au frigo, 5 jours.');
});

Deno.test('un aliment mal formé est écarté, les autres sont gardés', () => {
  const result = parseIngredients(JSON.stringify({ ingredients: [item(), item({ category: 'inconnue' }), item({ name: '' })] }));
  assert(result.ok);
  assertEquals(result.value.ingredients.length, 1);
  assertEquals(result.value.invalid.length, 2);
});

Deno.test('aucun aliment valide sur une liste non vide : échec (bascule sur le secours)', () => {
  const result = parseIngredients(JSON.stringify({ ingredients: [item({ confidence: 2 }), item({ quantity: 3 })] }));
  assert(!result.ok);
  assertEquals(result.code, 'invalid_response');
});

Deno.test('liste vide dès le départ : réponse valide (aucun aliment sur la photo)', () => {
  const result = parseIngredients('{"ingredients": []}');
  assert(result.ok);
  assertEquals(result.value.ingredients, []);
});

Deno.test('JSON illisible ou sans liste : échec', () => {
  assert(!parseIngredients('{ conto').ok);
  assert(!validateResponse({ items: [] }).ok);
});

Deno.test('kind et storage_tip absents ou invalides : valeurs par défaut, aliment gardé', () => {
  const [a, b] = cleanIngredients([item({ kind: 'plat', storage_tip: 42 }), item({ name: 'lait', kind: undefined, storage_tip: 'x'.repeat(500) })]);
  assertEquals([a.kind, a.storage_tip], ['ingredient', '']);
  assertEquals(b.kind, 'ingredient');
  assertEquals(b.storage_tip.length, 160);
});

Deno.test('nettoyage : confiance trop basse écartée, doublons retirés, tri par confiance, 20 au plus', () => {
  const cleaned = cleanIngredients([
    item({ name: 'pomme', confidence: 0.6 }),
    item({ name: 'Pomme', confidence: 0.95 }),
    item({ name: 'poire', confidence: 0.3 }),
    item({ name: 'kiwi', confidence: 0.8 }),
  ]);
  assertEquals(cleaned.map((i) => [i.name, i.confidence]), [['Pomme', 0.95], ['kiwi', 0.8]]);
  const many = cleanIngredients(Array.from({ length: 30 }, (_, i) => item({ name: `aliment ${i}` })));
  assertEquals(many.length, MAX_INGREDIENTS);
});

Deno.test('durée de conservation : estimation du modèle gardée, bornée à 2 ans', () => {
  assertEquals(cleanShelfLife(12, 'dairy', 'ingredient'), 12);
  assertEquals(cleanShelfLife(4.6, 'vegetable', 'ingredient'), 5);
  assertEquals(cleanShelfLife(5000, 'grain', 'ingredient'), MAX_SHELF_LIFE_DAYS);
});

Deno.test('durée de conservation absente ou invalide : valeur par défaut de la catégorie', () => {
  assertEquals(cleanShelfLife(undefined, 'fish', 'ingredient'), DEFAULT_SHELF_LIFE_DAYS.fish);
  assertEquals(cleanShelfLife(0, 'egg', 'ingredient'), DEFAULT_SHELF_LIFE_DAYS.egg);
  assertEquals(cleanShelfLife('3', 'meat', 'ingredient'), DEFAULT_SHELF_LIFE_DAYS.meat);
  const [cleaned] = cleanIngredients([item({ shelf_life_days: null, category: 'bakery' })]);
  assertEquals(cleaned.shelf_life_days, DEFAULT_SHELF_LIFE_DAYS.bakery);
});

Deno.test('plat cuisiné : toujours 2 à 3 jours', () => {
  assertEquals(cleanShelfLife(10, 'other', 'dish'), 3);
  assertEquals(cleanShelfLife(1, 'other', 'dish'), 2);
  assertEquals(cleanShelfLife(2, 'grain', 'dish'), 2);
  assertEquals(cleanShelfLife(undefined, 'other', 'dish'), 3);
});
