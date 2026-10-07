// Fichiers des sauvegardes : dossier backups/ (hors de git), journal des sauvegardes vérifiées backups/journal.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BACKUPS = path.join(ROOT, 'backups');
export const JOURNAL = path.join(BACKUPS, 'journal.json');

export const readJournal = () => (fs.existsSync(JOURNAL) ? JSON.parse(fs.readFileSync(JOURNAL, 'utf8')) : []);

export function fileInfo(file, withContent = false) {
  if (!fs.existsSync(file)) return { exists: false, size: 0, sha256: null, content: '' };
  const buffer = fs.readFileSync(file);
  return {
    exists: true,
    size: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    content: withContent ? buffer.toString('utf8') : '',
  };
}
