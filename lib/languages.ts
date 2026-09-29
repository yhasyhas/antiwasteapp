// Langues de l'interface (noms dans leur propre langue) ; short : code affiché dans la liste des langues
// (plutôt qu'un drapeau, qui s'affiche en lettres « GB » sur les systèmes sans drapeaux)
export const APP_LANGUAGES = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'es', label: 'Español', short: 'ES' },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]['code'];
