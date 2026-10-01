
import type { TFunction } from 'i18next';
import { showDialog } from '@/lib/dialog';

// Signale une écriture en base qui a échoué : trace dans la console et alerte à l'utilisateur,
// pour qu'aucun ajout, suppression ou modification ne se perde en silence.
export function alertWriteError(t: TFunction, context: string, error: unknown) {
  console.error(`Error ${context}:`, error);
  showDialog(t('errors.writeTitle'), t('errors.writeText'));
}
