// Contrôle avant une migration : la dernière sauvegarde vérifiée (backups/journal.json) date d'aujourd'hui et son
// fichier est présent et inchangé. Code de sortie 1 et message clair sinon.
// Lancement depuis la racine : node scripts/backup/check.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { todayProblems } from './verify.mjs';
import { fileInfo, readJournal, ROOT } from './files.mjs';

export function checkToday() {
  const entry = readJournal().at(-1);
  return todayProblems(entry, entry ? fileInfo(path.join(ROOT, entry.file)) : { exists: false });
}

// Lancé directement (pas importé par migrate.mjs ou guard.mjs)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkToday();
  if (problems.length > 0) {
    console.error(`MIGRATION BLOQUÉE : ${problems.join(' ; ')}`);
    process.exit(1);
  }
  console.log('Sauvegarde vérifiée du jour présente.');
}
