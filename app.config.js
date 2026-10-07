// Configuration dynamique, par-dessus app.json.
// - Variante de l'app (APP_VARIANT, fixée par le profil EAS dans eas.json) : chaque variante a son propre paquet
//   Android et son propre nom, si bien que le build de développement et le build de test (preview, phase 10b,
//   pour les amis testeurs) s'installent côte à côte sur un même téléphone. La variante est aussi lue par l'app
//   (extra.appVariant : numéro du build de test dans les Réglages, environnement Sentry). Le nom et le paquet
//   définitifs seront choisis avec le nom de l'app (phases 11 et 15) : d'ici là, aucun paquet pour la
//   production (un build production échoue volontairement).
//   Les deux variantes gardent le schéma myapp : les pages web (invitation, « Nouveau mot de passe ») ouvrent
//   l'app par un lien « intent » qui vise un paquet précis (web/invite, CONFIG.androidPackage).
// - Fichier Firebase (google-services.json, notifications push Android), hors de git : en local, lu à la
//   racine du projet ; pour un build EAS, fourni par la variable d'environnement de type fichier
//   GOOGLE_SERVICES_JSON (eas env:create).
const fs = require('fs');

const VARIANTS = {
  development: { name: 'Antigaspi (dev)', androidPackage: 'com.yhasyhas.antiwasteapp.dev' },
  preview: { name: 'Antigaspi (test)', androidPackage: 'com.yhasyhas.antiwasteapp.preview' },
};

module.exports = ({ config }) => {
  const variantName = process.env.APP_VARIANT ?? 'development';
  const variant = VARIANTS[variantName];
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    ...(variant && { name: variant.name }),
    extra: { ...config.extra, appVariant: variantName },
    android: {
      ...config.android,
      ...(variant && { package: variant.androidPackage }),
      ...(googleServicesFile && { googleServicesFile }),
    },
  };
};
