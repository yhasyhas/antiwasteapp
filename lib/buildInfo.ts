import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { type BuildInfo, toVariant } from './buildLabel';

// Build installé : variante (app.config.js), version et numéro de build lus dans le paquet Android.
// expo-application est déjà dans le build (dépendance d'expo-notifications) : aucun nouveau code natif.
export const buildInfo: BuildInfo = {
  variant: toVariant(Constants.expoConfig?.extra?.appVariant),
  version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?',
  buildNumber: Application.nativeBuildVersion ?? null,
};
