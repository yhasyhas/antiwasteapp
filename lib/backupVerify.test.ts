// Vérification des sauvegardes et blocage des migrations (scripts/backup/verify.mjs).
// Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { appliesMigrations, backupProblems, MIN_BYTES, REQUIRED_TABLES, todayProblems } from '../scripts/backup/verify.mjs';

const complete = [...REQUIRED_TABLES.map((table) => `COPY ${table} (id) FROM stdin;\n1\n\\.`), '-- PostgreSQL database dump complete'].join('\n');
const dump = (size: number, content = complete) => ({ exists: true, size, content });

Deno.test('sauvegarde : absente, vide, trop petite ou incomplète refusée', () => {
  assertEquals(backupProblems({ exists: false, size: 0, content: '' }, null), ['fichier de sauvegarde absent']);
  assertEquals(backupProblems(dump(0, ''), 600_000), ['fichier de sauvegarde vide (0 octet)']);
  assert(backupProblems(dump(MIN_BYTES - 1), null).some((p) => p.includes('anormalement petit')));
  // Moins de la moitié de la précédente : l'incident du 06/10/2026 (614 Ko attendus)
  assert(backupProblems(dump(250_000), 614_225).some((p) => p.includes('par rapport à la sauvegarde précédente')));
  assert(backupProblems(dump(600_000, complete.replace('-- PostgreSQL database dump complete', '')), null).some((p) => p.includes('interrompue')));
  assert(backupProblems(dump(600_000, complete.replace('COPY auth.users', 'COPY auth.autre')), null).some((p) => p.includes('auth.users')));
});

Deno.test('sauvegarde : complète et de taille normale acceptée', () => {
  assertEquals(backupProblems(dump(650_000), 614_225), []);
  assertEquals(backupProblems(dump(400_000), 614_225), []);
  assertEquals(backupProblems(dump(650_000), null), []);
});

Deno.test('migration : sauvegarde vérifiée du jour exigée', () => {
  const entry = { file: 'backups/a.sql', date: '2026-10-06', size: 650_000, sha256: 'abc' };
  assert(todayProblems(undefined, { exists: false }, '2026-10-06')[0].includes('aucune sauvegarde'));
  assert(todayProblems(entry, { exists: true, size: 650_000, sha256: 'abc' }, '2026-10-07')[0].includes("pas d'aujourd'hui"));
  assert(todayProblems(entry, { exists: false }, '2026-10-06')[0].includes('introuvable'));
  assert(todayProblems(entry, { exists: true, size: 0, sha256: 'vide' }, '2026-10-06')[0].includes('modifiée'));
  assertEquals(todayProblems(entry, { exists: true, size: 650_000, sha256: 'abc' }, '2026-10-06'), []);
});

Deno.test('migration : commandes qui appliquent des migrations reconnues', () => {
  for (const command of [
    'npx supabase db push',
    'echo y | npx supabase db push 2>&1 | tail -4',
    'npx supabase migration up --linked',
    'npx supabase db reset --linked',
    'psql "$(cat supabase/.temp/pooler-url)" -f supabase/migrations/20261007100000_food_impact.sql',
  ]) assert(appliesMigrations(command), command);
  for (const command of [
    'node scripts/backup/migrate.mjs',
    'npx supabase functions deploy generate-recipes',
    'npx supabase db dump --data-only -f backups/x.sql',
    'psql "$(cat supabase/.temp/pooler-url)" -v ON_ERROR_STOP=1 -f supabase/tests/food_impact.sql',
    'psql "$(cat supabase/.temp/pooler-url)" -f "$TEMP/mt.sql"',
    'npx supabase db push --dry-run',
  ]) assert(!appliesMigrations(command), command);
});
