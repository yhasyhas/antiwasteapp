// Tests des fiches aliments sans appel réseau : validation, trois langues, alias, promesses de santé.
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { FACT_SCHEMA, parseFact, parseResolution } from './facts.ts';

const section = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  description: 'Fruit doux et pratique, qui mûrit après la récolte.',
  origin: "Originaire d'Asie du Sud-Est.",
  season: "Toute l'année (importée).",
  nutrition: ['Source de potassium', 'Apporte des fibres'],
  tips: ['Trop mûre, elle se congèle pour les smoothies', 'Séparez-la des autres fruits pour ralentir leur mûrissement'],
  ...overrides,
});
const fact = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  is_food: true,
  food_key: 'Banana',
  variants: ['bananes', 'Plátanos'],
  fr: section('Banane'),
  en: section('Banana'),
  es: section('Plátano'),
  ...overrides,
});

Deno.test('schéma strict : tous les champs requis, trois langues', () => {
  assertEquals(FACT_SCHEMA.required, ['is_food', 'food_key', 'variants', 'fr', 'en', 'es']);
  assertEquals(FACT_SCHEMA.additionalProperties, false);
});

Deno.test('fiche valide : identifiant normalisé, trois langues, alias sans doublon ni accent', () => {
  const result = parseFact(fact(), 'Bananes mûres', null);
  assert(result.ok && !('not_food' in result.value));
  assertEquals(result.value.food_key, 'banana');
  assertEquals(result.value.content.es.name, 'Plátano');
  assertEquals(result.value.aliases, ['bananes mures', 'banane', 'banana', 'platano', 'bananes', 'platanos']);
});

Deno.test('identifiant imposé (pré-remplissage, fiche déjà résolue) prioritaire', () => {
  const result = parseFact(fact({ food_key: 'musa' }), 'banane', 'banana');
  assert(result.ok && !('not_food' in result.value));
  assertEquals(result.value.food_key, 'banana');
});

Deno.test('fiche refusée : langue manquante, listes trop courtes, promesse de santé', () => {
  assert(!parseFact(fact({ es: undefined }), 'banane', null).ok);
  assert(!parseFact(fact({ en: section('Banana', { tips: ['Une seule'] }) }), 'banane', null).ok);
  const claim = parseFact(fact({ fr: section('Banane', { nutrition: ['Aide à guérir les maladies', 'Riche en fibres'] }) }), 'banane', null);
  assert(!claim.ok);
  assert(!claim.ok && claim.failure.includes('promesse de santé'));
  assert(!parseFact(fact({ en: section('Banana', { description: 'A natural remedy.' }) }), 'banane', null).ok);
});

Deno.test('mots proches permis : « cured ham », « a sweet treat », « évite qu\'elle se dessèche »', () => {
  const result = parseFact(fact({ en: section('Banana', { tips: ['Great with cured ham', 'A sweet treat when frozen'] }), fr: section('Banane', { tips: ["Évite qu'elle se dessèche", 'Se congèle'] }) }), 'banane', null);
  assert(result.ok);
});

Deno.test('pas un aliment, ou résolution du nom', () => {
  const notFood = parseFact(JSON.stringify({ is_food: false }), 'chaise', null);
  assert(notFood.ok && 'not_food' in notFood.value);
  assertEquals(parseResolution('{"is_food": true, "food_key": "Cherry Tomato"}'), { ok: true, value: { food_key: 'cherry_tomato', is_food: true } });
  assertEquals(parseResolution('{"is_food": false, "food_key": ""}'), { ok: true, value: { food_key: null, is_food: false } });
  assert(!parseResolution('pas du json').ok);
});
