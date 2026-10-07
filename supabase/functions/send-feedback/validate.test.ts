// Contrôle des avis et des signalements. Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { cleanFeedback, cleanReport } from './validate.ts';

Deno.test('avis : type connu et texte non vide ; informations techniques coupées', () => {
  assertEquals(cleanFeedback({ kind: 'spam', message: 'x' }), null);
  assertEquals(cleanFeedback({ kind: 'idea', message: '   ' }), null);
  const feedback = cleanFeedback({ kind: 'idea', message: ' Une idée ', app_version: '1.0.0', device: `samsung ${'x'.repeat(100)}`, os: 'android 11', language: 'fr-FR', email: 'a@b.c' });
  assertEquals(feedback?.message, 'Une idée');
  assertEquals(feedback?.device?.length, 80);
  assertEquals(feedback?.language, 'fr-FR');
  // Rien d'autre n'est gardé (pas d'e-mail)
  assertEquals(Object.keys(feedback!).sort(), ['app_version', 'device', 'kind', 'language', 'message', 'os']);
});

Deno.test('signalement : recette et raison connues, commentaire facultatif', () => {
  const id = '00000000-0000-4000-a000-0000000010a1';
  assertEquals(cleanReport({ recipe_id: 'abc', reason: 'bad' }), null);
  assertEquals(cleanReport({ recipe_id: id, reason: 'boring' }), null);
  assertEquals(cleanReport({ recipe_id: id, reason: 'dangerous', comment: '  ', language: 'fr' }), { recipe_id: id, reason: 'dangerous', comment: null, language: 'fr' });
  assertEquals(cleanReport({ recipe_id: id, reason: 'translation', comment: 'x'.repeat(600) })?.comment?.length, 500);
});
