import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Camera, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import type { ScannerCameraHandle, ScannerCameraProps, ScannerPermission } from './scannerCameraTypes';

// Caméra du Scanner sur le téléphone : react-native-vision-camera (sans « frame processors »). Photo
// enregistrée dans un fichier temporaire ; codes-barres lus par le lecteur intégré (ML Kit, modèle inclus
// dans l'app). La version web est dans ScannerCamera.web.tsx.

// Codes des produits alimentaires, comme avant (expo-camera : ean13, ean8, upc_a, upc_e)
const FOOD_BARCODE_FORMATS = ['ean-13', 'ean-8', 'upc-a', 'upc-e'] as const;

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  { facing, barcodeEnabled, onBarcode, onPreviewStarted, onError, style },
  ref,
) {
  const photoOutput = usePhotoOutput({});
  const formats = useMemo(() => [...FOOD_BARCODE_FORMATS], []);
  const barcodeOutput = useBarcodeScannerOutput({
    barcodeFormats: formats,
    onBarcodeScanned: (barcodes) => {
      const code = barcodes.find((barcode) => barcode.rawValue)?.rawValue;
      if (code) onBarcode(code);
    },
    onError: (error) => console.warn('[code-barres] lecture impossible :', error.message),
  });
  // Mode code-barres : seulement le lecteur ; mode photo : seulement la photo
  const outputs = useMemo(() => (barcodeEnabled ? [barcodeOutput] : [photoOutput]), [barcodeEnabled, barcodeOutput, photoOutput]);

  useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      try {
        const file = await photoOutput.capturePhotoToFile({}, {});
        return file.filePath.startsWith('file://') ? file.filePath : `file://${file.filePath}`;
      } catch (error) {
        console.warn('[caméra] photo impossible :', error);
        return null;
      }
    },
  }), [photoOutput]);

  return (
    <Camera
      style={style}
      isActive
      device={facing}
      outputs={outputs}
      resizeMode="cover"
      onPreviewStarted={onPreviewStarted}
      onError={(error) => onError('session_error', error.message)}
    />
  );
});

export function useScannerPermission(): ScannerPermission | null {
  const permission = useCameraPermission();
  return {
    granted: permission.hasPermission,
    canAsk: permission.canRequestPermission,
    request: permission.requestPermission,
  };
}
