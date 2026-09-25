// Clés typées : t('...') n'accepte que les clés de locales/fr.ts
import 'i18next';
import type fr from './locales/fr';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof fr;
    };
  }
}
