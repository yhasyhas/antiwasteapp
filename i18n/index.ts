// Traductions de l'app (i18next). Langue du téléphone au premier lancement ; ensuite, la langue choisie
// est gardée sur le téléphone et synchronisée avec Supabase (voir contexts/LanguageContext.tsx).

// Règles de pluriel (_one / _other) : Hermes ne fournit pas toujours Intl.PluralRules
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import fr from './locales/fr';
import en from './locales/en';
import es from './locales/es';

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// Première langue du téléphone prise en charge, sinon le français
export function deviceLanguage(): Language {
  const code = getLocales().map((locale) => locale.languageCode).find(isSupportedLanguage);
  return code ?? 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    es: { translation: es },
  },
  lng: deviceLanguage(),
  fallbackLng: 'fr',
  // React échappe déjà les textes
  interpolation: { escapeValue: false },
});

export default i18n;
