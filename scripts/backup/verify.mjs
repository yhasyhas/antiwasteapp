// Vérification d'une sauvegarde de données (pg_dump) : sans accès aux fichiers ni à la base, testée par
// lib/backupVerify.test.ts. Utilisée par scripts/backup/backup.mjs (après la sauvegarde) et
// scripts/backup/check.mjs (avant une migration).

// Plus petite taille acceptée, et part minimale de la sauvegarde vérifiée précédente : une base qui perd plus de la
// moitié de son volume d'un jour à l'autre signale une sauvegarde incomplète, pas une évolution normale
export const MIN_BYTES = 50_000;
export const MIN_SHARE_OF_PREVIOUS = 0.5;

// Tables qui doivent figurer dans toute sauvegarde complète (comptes, profils, garde-manger, foyers)
export const REQUIRED_TABLES = ['auth.users', 'public.profiles', 'public.ingredients', 'public.households', 'public.household_members'];

// Raisons pour lesquelles la sauvegarde n'est pas utilisable (liste vide : sauvegarde vérifiée)
// dump : { exists, size, content } ; previous : taille de la sauvegarde vérifiée précédente (ou null)
export function backupProblems(dump, previousSize) {
  if (!dump.exists) return ['fichier de sauvegarde absent'];
  if (dump.size === 0) return ['fichier de sauvegarde vide (0 octet)'];
  const problems = [];
  if (dump.size < MIN_BYTES) problems.push(`fichier anormalement petit : ${dump.size} octets (minimum ${MIN_BYTES})`);
  if (previousSize && dump.size < previousSize * MIN_SHARE_OF_PREVIOUS) {
    problems.push(`fichier anormalement petit par rapport à la sauvegarde précédente : ${dump.size} octets contre ${previousSize} (minimum ${Math.round(MIN_SHARE_OF_PREVIOUS * 100)} %)`);
  }
  if (!/PostgreSQL database dump complete/.test(dump.content)) problems.push('sauvegarde interrompue (fin du fichier absente)');
  const missing = REQUIRED_TABLES.filter((table) => !new RegExp(`^COPY ${table.replace('.', '\\.')} `, 'm').test(dump.content));
  if (missing.length > 0) problems.push(`tables absentes : ${missing.join(', ')}`);
  return problems;
}

// Date locale « AAAA-MM-JJ » (une sauvegarde « du jour » suit le calendrier de l'utilisateur)
export const localDate = (date = new Date()) => date.toLocaleDateString('sv-SE');

// Sauvegarde du jour encore valable : dernière entrée du journal datée d'aujourd'hui, fichier présent, inchangé
// entry : dernière entrée du journal ; file : { exists, size, sha256 } du fichier qu'elle désigne
export function todayProblems(entry, file, today = localDate()) {
  if (!entry) return ['aucune sauvegarde vérifiée (lancer : node scripts/backup/backup.mjs <nom>)'];
  if (entry.date !== today) return [`dernière sauvegarde vérifiée du ${entry.date}, pas d'aujourd'hui (${today}) : lancer node scripts/backup/backup.mjs <nom>`];
  if (!file.exists) return [`sauvegarde du jour introuvable : ${entry.file}`];
  if (file.size !== entry.size || file.sha256 !== entry.sha256) return [`sauvegarde du jour modifiée depuis sa vérification : ${entry.file}`];
  return [];
}

// Commande qui applique des migrations à la base : bloquée sans sauvegarde vérifiée du jour (hook de Claude Code,
// scripts/backup/guard.mjs). Les essais en transaction annulée passent par un fichier temporaire, pas par ces commandes
export function appliesMigrations(command) {
  // « db push --dry-run » n'applique rien
  return /supabase(\.exe)?["']?\s+(db\s+push(?![^|;&]*--dry-run)|migration\s+up|db\s+reset\s+--linked)/i.test(command)
    || /psql[^|;&]*\s-f\s+["']?[^\s"']*supabase[\\/]migrations[\\/]/i.test(command);
}
