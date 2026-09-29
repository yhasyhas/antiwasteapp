import type { StyleProp, ViewStyle } from 'react-native';

// Caméra du Scanner, commune au téléphone (ScannerCamera.tsx, react-native-vision-camera) et au web
// (ScannerCamera.web.tsx, expo-camera) : même interface pour l'écran Scanner.

export type ScannerFacing = 'back' | 'front';

export interface ScannerCameraHandle {
  // Photo prise, en URI de fichier (compressée ensuite par useScan avant l'analyse), ou null en cas d'échec
  takePhoto: () => Promise<string | null>;
}

export interface ScannerCameraProps {
  facing: ScannerFacing;
  // Mode code-barres : codes alimentaires lus (EAN-13, EAN-8, UPC-A, UPC-E)
  barcodeEnabled: boolean;
  onBarcode: (code: string) => void;
  // Premier signal fiable que l'aperçu tourne (première image reçue) : arrête la surveillance
  onPreviewStarted: () => void;
  // Démarrage impossible ; reason : cause courte pour Sentry
  onError: (reason: string, message?: string) => void;
  style?: StyleProp<ViewStyle>;
}

// Autorisation de la caméra : null pendant la lecture ; canAsk : la demande peut encore s'afficher
// (sinon, ouvrir les réglages du téléphone)
export interface ScannerPermission {
  granted: boolean;
  canAsk: boolean;
  request: () => Promise<boolean>;
}
