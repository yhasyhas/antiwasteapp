// Configuration dynamique, par-dessus app.json : le fichier Firebase (google-services.json, notifications
// push Android) n'est pas dans git. En local, il est lu à la racine du projet ; pour un build EAS, il est
// fourni par la variable d'environnement de type fichier GOOGLE_SERVICES_JSON (eas env:create).
const fs = require('fs');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON
    ?? (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile && { googleServicesFile }) },
  };
};
