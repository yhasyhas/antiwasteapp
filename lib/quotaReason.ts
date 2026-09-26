import type { TFunction } from 'i18next';

// Raison d'un échec renvoyée par les fonctions (scan, génération, images) :
// user_quota : limite personnelle du jour atteinte ; provider_quota : quota du fournisseur d'IA épuisé
// (tous les fournisseurs, le secours compris) ; provider_error : panne
export type FailureReason = 'user_quota' | 'provider_quota' | 'provider_error';

export function failureReasonOf(data: any): FailureReason | null {
  const reason = data?.reason;
  return reason === 'user_quota' || reason === 'provider_quota' || reason === 'provider_error' ? reason : null;
}

// Titre de l'alerte selon la raison ; le message détaillé (traduit) vient du serveur
export function failureTitle(t: TFunction, reason: FailureReason | null, fallback: string): string {
  if (reason === 'user_quota') return t('errors.dailyLimitTitle');
  if (reason === 'provider_quota') return t('errors.serviceLimitTitle');
  return fallback;
}
