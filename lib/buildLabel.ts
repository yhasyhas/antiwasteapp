// Identification du build, sans dépendance à React Native (testée par buildLabel.test.ts).
//   - Variante (APP_VARIANT, fixée par le profil EAS, app.config.js → extra.appVariant) : development, preview
//     (build de test des amis) ou production.
//   - Numéro de build : versionCode Android, incrémenté par EAS à chaque build preview (eas.json, autoIncrement).
// Libellé des Réglages : « version 1.0, test 3 » ; version technique jointe à « Donner mon avis » et à Sentry.

export type AppVariant = 'development' | 'preview' | 'production';

export const toVariant = (value: unknown): AppVariant =>
  value === 'preview' || value === 'production' ? value : 'development';

// « 1.0.0 » → « 1.0 » (le dernier chiffre ne sert qu'aux correctifs)
export const shortVersion = (version: string | null | undefined) => {
  const parts = String(version ?? '').split('.').filter(Boolean);
  return parts.length ? parts.slice(0, 2).join('.') + (parts.length === 1 ? '.0' : '') : '?';
};

export interface BuildInfo {
  variant: AppVariant;
  version: string;
  buildNumber: string | null;
}

// Suffixe du libellé affiché : « test 3 » (preview), « dev » (développement), rien en production
export function buildSuffix(info: BuildInfo): { key: 'test' | 'dev' | null; number: string | null } {
  if (info.variant === 'preview') return { key: 'test', number: info.buildNumber ?? '?' };
  if (info.variant === 'development') return { key: 'dev', number: null };
  return { key: null, number: null };
}

// Version technique, la même dans toutes les langues (au plus 40 caractères, colonne feedback.app_version)
export function technicalVersion(info: BuildInfo): string {
  const version = shortVersion(info.version);
  if (info.variant === 'preview') return `${version}, test ${info.buildNumber ?? '?'}`;
  if (info.variant === 'development') return `${version}, dev`;
  return info.buildNumber ? `${version} (${info.buildNumber})` : version;
}

// Environnement Sentry : celui de la variante, « development » dans le serveur de développement
export const sentryEnvironment = (info: BuildInfo, isDev: boolean): string => (isDev ? 'development' : info.variant);
