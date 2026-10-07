// Identification du build (buildLabel.ts). Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { buildSuffix, sentryEnvironment, shortVersion, technicalVersion, toVariant } from './buildLabel.ts';

Deno.test('build : variante lue dans la configuration, développement par défaut', () => {
  assertEquals(toVariant('preview'), 'preview');
  assertEquals(toVariant('production'), 'production');
  assertEquals(toVariant(undefined), 'development');
  assertEquals(toVariant('autre'), 'development');
});

Deno.test('build : version courte', () => {
  assertEquals(shortVersion('1.0.0'), '1.0');
  assertEquals(shortVersion('2.3.14'), '2.3');
  assertEquals(shortVersion('1'), '1.0');
  assertEquals(shortVersion(null), '?');
});

Deno.test('build de test : « test N » dans les Réglages, dans l’avis et dans Sentry', () => {
  const preview = { variant: 'preview' as const, version: '1.0.0', buildNumber: '3' };
  assertEquals(buildSuffix(preview), { key: 'test', number: '3' });
  assertEquals(technicalVersion(preview), '1.0, test 3');
  assertEquals(sentryEnvironment(preview, false), 'preview');
});

Deno.test('build : développement et production', () => {
  const dev = { variant: 'development' as const, version: '1.0.0', buildNumber: '1' };
  assertEquals(buildSuffix(dev).key, 'dev');
  assertEquals(technicalVersion(dev), '1.0, dev');
  assertEquals(sentryEnvironment(dev, true), 'development');
  const production = { variant: 'production' as const, version: '1.0.0', buildNumber: '12' };
  assertEquals(buildSuffix(production).key, null);
  assertEquals(technicalVersion(production), '1.0 (12)');
  // Le serveur de développement reste en « development », quelle que soit la variante
  assertEquals(sentryEnvironment(production, true), 'development');
});
