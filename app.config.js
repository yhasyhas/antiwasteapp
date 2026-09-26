// Configuration dynamique, par-dessus app.json.
// - Variante de l'app (APP_VARIANT, fixée par le profil EAS dans eas.json) : le build de développement a son
//   propre paquet Android et son propre nom, installables à côté d'un futur build de production. Le nom et
//   le paquet définitifs seront choisis en phase 8 avec le nom de l'app : d'ici là, aucun paquet pour les
//   autres profils (un build preview ou production échoue volontairement).
// - Fichier Firebase (google-services.json, notifications push Android), hors de git : en local, lu à la
//   racine du projet ; pour un build EAS, fourni par la variable d'environnement de type fichier
//   GOOGLE_SERVICES_JSON (eas env:create).
const fs = require('fs');

const VARIANTS = {
  development: { name: 'Antigaspi (dev)', androidPackage: 'com.yhasyhas.antiwasteapp.dev' },
};

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT ?? 'development'];
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    ...(variant && { name: variant.name }),
    android: {
      ...config.android,
      ...(variant && { package: variant.androidPackage }),
      ...(googleServicesFile && { googleServicesFile }),
    },
  };
};
