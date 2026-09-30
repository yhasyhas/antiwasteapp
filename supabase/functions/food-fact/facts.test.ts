// Tests des fiches aliments sans appel réseau : validation, trois langues, alias, promesses de santé.
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { FACT_SCHEMA, ORIGIN_MAX, parseFact, parseNutrition, parseOrigins, parsePhase8, parseResolution, parseSeasons, SEASON_MAX } from './facts.ts';

const section = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  description: 'Fruit doux et pratique, qui mûrit après la récolte.',
  origin: "Originaire d'Asie du Sud-Est.",
  season: "Toute l'année.",
  nutrition: ['Potassium', 'Vitamine C'],
  tips: ['Trop mûre, elle se congèle pour les smoothies', 'Séparez-la des autres fruits pour ralentir leur mûrissement'],
  signs: ['Vérifie que la peau est jaune, avec quelques taches', 'La chair doit rester ferme'],
  discard: ['Moisissure ou odeur de fermenté'],
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
  assertEquals(FACT_SCHEMA.required, ['is_food', 'food_key', 'seasonal', 'variants', 'fr', 'en', 'es']);
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

Deno.test('origine en quelques mots : point final retiré, origine trop longue refusée', () => {
  const ok = parseOrigins(JSON.stringify({ fr: 'Asie du Sud-Est.', en: 'Southeast Asia', es: 'Sudeste asiático' }));
  assert(ok.ok);
  assertEquals(ok.value.fr, 'Asie du Sud-Est');
  const long = parseOrigins(JSON.stringify({ fr: 'x'.repeat(ORIGIN_MAX + 1), en: 'Asia', es: 'Asia' }));
  assert(!long.ok);
  const fiche = parseFact(fact({ fr: section('Banane', { origin: "Originaire d'Asie du Sud-Est, cultivée depuis des millénaires en Inde et en Afrique." }) }), 'banane', null);
  assert(!fiche.ok);
});

Deno.test('atouts courts : plus de trois mots écartés, fiche refusée sans deux atouts courts', () => {
  const result = parseFact(fact({ fr: section('Banane', { nutrition: ['Source de potassium', 'Apporte des fibres alimentaires', 'Vitamine C.'] }) }), 'banane', null);
  assert(result.ok && !('not_food' in result.value));
  assertEquals(result.value.content.fr.nutrition, ['Source de potassium', 'Vitamine C']);
  const tooLong = parseFact(fact({ fr: section('Banane', { nutrition: ['Apporte des fibres alimentaires', 'Contient de la vitamine C'] }) }), 'banane', null);
  assertEquals(tooLong.ok, false);
});

Deno.test('atouts réécrits : trois langues, majuscule, trois mots au plus', () => {
  const ok = parseNutrition(JSON.stringify({ fr: ['source de potassium', 'Riche en fibres'], en: ['Source of potassium', 'High in fiber.'], es: ['Fuente de potasio', 'Rico en fibra', 'Aporta mucha fibra dietética'] }));
  assert(ok.ok);
  assertEquals(ok.value.fr, ['Source de potassium', 'Riche en fibres']);
  assertEquals(ok.value.en, ['Source of potassium', 'High in fiber']);
  assertEquals(ok.value.es, ['Fuente de potasio', 'Rico en fibra']);
  assertEquals(parseNutrition(JSON.stringify({ fr: ['Source de potassium'], en: ['A', 'B'], es: ['A', 'B'] })).ok, false);
});

Deno.test('atouts télégraphiques refusés : liaison manquante, vitamines collées', () => {
  const result = parseNutrition(JSON.stringify({
    fr: ['Source protéines', 'Riche antioxydants', 'Vitamines C K', 'Source de fibres', 'Riche en fer'],
    en: ['Source of protein', 'High fiber', 'Rich in iron'],
    es: ['Fuente proteínas', 'Fuente de fibra', 'Rica en hierro'],
  }));
  assert(result.ok);
  assertEquals(result.value.fr, ['Source de fibres', 'Riche en fer']);
  assertEquals(result.value.en, ['Source of protein', 'Rich in iron']);
  assertEquals(result.value.es, ['Fuente de fibra', 'Rica en hierro']);
});

Deno.test('saison en quelques mots : point final retiré, majuscule, saison trop longue refusée', () => {
  const ok = parseSeasons(JSON.stringify({ fr: 'juillet à octobre.', en: 'July to October', es: 'Julio a octubre' }));
  assert(ok.ok);
  assertEquals(ok.value.fr, 'Juillet à octobre');
  const long = parseSeasons(JSON.stringify({ fr: 'x'.repeat(SEASON_MAX + 1), en: 'All year', es: 'Todo el año' }));
  assertEquals(long.ok, false);
  const fiche = parseFact(fact({ fr: section('Banane', { season: "Toute l'année dans les pays producteurs, sinon de juin à septembre en Europe." }) }), 'banane', null);
  assertEquals(fiche.ok, false);
});

Deno.test('« Est-ce encore bon ? » et saison : signes et cas à jeter exigés, produit frais recopié dans chaque langue', () => {
  const frais = parseFact(fact({ seasonal: true }), 'banane', null);
  assert(frais.ok && !('not_food' in frais.value));
  assertEquals(frais.value.content.fr.seasonal, true);
  assertEquals(frais.value.content.es.discard, ['Moisissure ou odeur de fermenté']);
  const sansSaison = parseFact(fact(), 'banane', null);
  assert(sansSaison.ok && !('not_food' in sansSaison.value));
  assertEquals(sansSaison.value.content.en.seasonal, false);
  assertEquals(parseFact(fact({ fr: section('Banane', { signs: ['Une seule'] }) }), 'banane', null).ok, false);
  assertEquals(parseFact(fact({ fr: section('Banane', { discard: [] }) }), 'banane', null).ok, false);
  const claim = parseFact(fact({ fr: section('Banane', { discard: ['Jette-la : elle donne des maladies'] }) }), 'banane', null);
  assert(!claim.ok && claim.failure.includes('promesse de santé'));
});

Deno.test('réécriture des fiches existantes : produit frais, signes et cas à jeter dans les trois langues', () => {
  const lang = { signs: ['vérifie la couleur', 'Sens-la'], discard: ['Moisissure visible'] };
  const ok = parsePhase8(JSON.stringify({ seasonal: false, fr: lang, en: lang, es: lang }));
  assert(ok.ok);
  assertEquals(ok.value.seasonal, false);
  assertEquals(ok.value.fr.signs, ['Vérifie la couleur', 'Sens-la']);
  assertEquals(parsePhase8(JSON.stringify({ fr: lang, en: lang, es: lang })).ok, false);
  assertEquals(parsePhase8(JSON.stringify({ seasonal: true, fr: lang, en: lang })).ok, false);
});
