// Tests du texte du résumé quotidien (mêmes phrases que les rappels locaux de l'app).
// Lancement : deno test --no-config --allow-env supabase/functions/

import { assertEquals } from 'jsr:@std/assert@1';
import { digestContent } from './digestText.ts';

const item = (id: string, name: string) => ({ id, name });

Deno.test('résumé en français : aujourd\'hui, demain, nombre de recettes, aliments présélectionnés', () => {
  const content = digestContent([item('1', 'crème fraîche')], [item('2', 'tomates'), item('3', 'reste de riz')], 4, 'fr');
  assertEquals(content.title, 'À cuisiner vite');
  assertEquals(content.body, "Aujourd'hui : crème fraîche. Demain : tomates et reste de riz. 2 recettes t’attendent.");
  assertEquals(content.data.priority, '1,2,3');
});

Deno.test('plus de 3 aliments : « et N autres » ; une seule recette pour un petit garde-manger', () => {
  const many = ['a', 'b', 'c', 'd', 'e'].map((name) => item(name, name));
  assertEquals(digestContent(many, [], 9, 'fr').body, "Aujourd'hui : a, b, c et 2 autres. 3 recettes t’attendent.");
  assertEquals(digestContent([], [item('x', 'lait')], 1, 'en').body, 'Tomorrow: lait. 1 recipe is waiting for you.');
  assertEquals(digestContent(many.slice(0, 4), [], 2, 'es').body, 'Hoy: a, b, c y 1 más. 1 receta te espera.');
});

Deno.test('langue inconnue : français', () => {
  assertEquals(digestContent([item('1', 'pain')], [], 1, 'de').title, 'À cuisiner vite');
});
