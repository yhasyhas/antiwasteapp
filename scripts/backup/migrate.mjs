// Application des migrations : seulement avec une sauvegarde vérifiée du jour (scripts/backup/check.mjs), puis
// npx supabase db push. Lancement depuis la racine : node scripts/backup/migrate.mjs
import { spawnSync } from 'node:child_process';
import { checkToday } from './check.mjs';

const problems = checkToday();
if (problems.length > 0) {
  console.error(`MIGRATION BLOQUÉE : ${problems.join(' ; ')}`);
  process.exit(1);
}
const result = spawnSync('npx', ['supabase', 'db', 'push', '--yes'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
