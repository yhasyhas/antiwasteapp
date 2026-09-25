import type { TFunction } from 'i18next';

// Codes d'erreur de Supabase Auth → messages traduits (les messages de Supabase sont en anglais)
const AUTH_ERROR_KEYS = {
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  invalid_credentials: 'auth.errors.invalidCredentials',
  user_already_exists: 'auth.errors.userAlreadyExists',
  email_exists: 'auth.errors.userAlreadyExists',
  weak_password: 'auth.errors.weakPassword',
  email_address_invalid: 'auth.errors.invalidEmail',
  validation_failed: 'auth.errors.invalidEmail',
  over_request_rate_limit: 'auth.errors.rateLimit',
  over_email_send_rate_limit: 'auth.errors.rateLimit',
} as const;

export function authErrorMessage(t: TFunction, error: { code?: string; name?: string; status?: number } | null | undefined): string {
  const key = AUTH_ERROR_KEYS[error?.code as keyof typeof AUTH_ERROR_KEYS];
  if (key) return t(key);
  // Réseau coupé : supabase-js renvoie une AuthRetryableFetchError sans code
  if (error?.name === 'AuthRetryableFetchError' || error?.status === 0) return t('auth.errors.network');
  return t('auth.errors.unknown');
}
