// Sauvegarde des données de la base (comptes, données de l'app, stockage) avec pg_dump, sans Docker, puis vérification
// bloquante : en cas d'échec, message clair, code de sortie 1, fichier renommé en .echec et rien dans le journal.
// Une sauvegarde vérifiée est ajoutée à backups/journal.json ; scripts/backup/check.mjs exige celle du jour avant
// toute migration. Mot de passe dans SUPABASE_DB_PASSWORD, adresse du pooler dans supabase/.temp/pooler-url
// (docs/ENVIRONMENT.md) ; aucun secret affiché.
// Lancement depuis la racine : node scripts/backup/backup.mjs <nom> (ex. avant-food-impact)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { backupProblems, localDate } from './verify.mjs';
import { BACKUPS, fileInfo, JOURNAL, readJournal, ROOT } from './files.mjs';

const fail = (message) => {
  console.error(`SAUVEGARDE EN ÉCHEC : ${message}\nAucune migration ni modification de données ne doit être lancée.`);
  process.exit(1);
};

const label = (process.argv[2] ?? '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '');
if (!label) fail('nom de la sauvegarde manquant (ex. node scripts/backup/backup.mjs avant-food-impact)');
if (!process.env.SUPABASE_DB_PASSWORD) fail('SUPABASE_DB_PASSWORD absent de l\'environnement');
const poolerFile = path.join(ROOT, 'supabase', '.temp', 'pooler-url');
if (!fs.existsSync(poolerFile)) fail('supabase/.temp/pooler-url absent (lier le projet : npx supabase link)');

fs.mkdirSync(BACKUPS, { recursive: true });
const stamp = new Date();
const file = path.join(BACKUPS, `data-${localDate(stamp)}-${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}-${label}.sql`);
const result = spawnSync('pg_dump', [
  fs.readFileSync(poolerFile, 'utf8').trim(),
  '--data-only', '--schema=public', '--schema=auth', '--schema=storage',
  '--no-owner', '--no-privileges', '-f', file,
  // Messages de pg_dump en anglais : en français, la console Windows les affiche mal encodés
], { env: { ...process.env, PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, LC_MESSAGES: 'C', LANG: 'C' }, encoding: 'utf8' });

const markFailed = () => {
  if (fs.existsSync(file)) fs.renameSync(file, `${file}.echec`);
};
if (result.error) {
  markFailed();
  fail(`pg_dump introuvable ou impossible à lancer (${result.error.code ?? result.error.message})`);
}
if (result.status !== 0) {
  markFailed();
  // Message de pg_dump sans l'adresse de connexion
  fail(`pg_dump a échoué (code ${result.status}) : ${(result.stderr ?? '').replace(/postgres(ql)?:\/\/\S+/g, '<adresse>').trim().slice(0, 300)}`);
}

const journal = readJournal();
const previous = journal.at(-1);
const dump = fileInfo(file, true);
const problems = backupProblems(dump, previous?.size ?? null);
if (problems.length > 0) {
  markFailed();
  fail(problems.join(' ; '));
}

const entry = { file: path.relative(ROOT, file).split(path.sep).join('/'), date: localDate(stamp), verified_at: stamp.toISOString(), size: dump.size, sha256: dump.sha256 };
fs.writeFileSync(JOURNAL, JSON.stringify([...journal, entry], null, 2));
console.log(`Sauvegarde vérifiée : ${entry.file} (${Math.round(dump.size / 1024)} Ko${previous ? `, précédente ${Math.round(previous.size / 1024)} Ko` : ''})`);
