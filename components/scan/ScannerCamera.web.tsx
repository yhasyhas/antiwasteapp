import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ScannerCameraHandle, ScannerCameraProps, ScannerPermission } from './scannerCameraTypes';

// Caméra du Scanner sur le web (essais, captures) : expo-camera, qui n'est plus inclus dans l'app mobile
// (react-native-vision-camera n'existe pas sur le web). Même interface que ScannerCamera.tsx.

const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  { facing, barcodeEnabled, onBarcode, onPreviewStarted, onError, style },
  ref,
) {
  const camera = useRef<CameraView>(null);

  useImperativeHandle(ref, () => ({
    takePhoto: async () => {
      try {
        const photo = await camera.current?.takePictureAsync();
        return photo?.uri ?? null;
      } catch (error) {
        console.warn('[caméra] photo impossible :', error);
        return null;
      }
    },
  }), []);

  return (
    <CameraView
      ref={camera}
      style={style}
      facing={facing}
      barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODE_TYPES] }}
      onBarcodeScanned={barcodeEnabled ? ({ data }) => onBarcode(data) : undefined}
      onCameraReady={onPreviewStarted}
      onMountError={(event) => onError('mount_error', event.message)}
    />
  );
});

export function useScannerPermission(): ScannerPermission | null {
  const [permission, requestPermission] = useCameraPermissions();
  if (!permission) return null;
  return {
    granted: permission.granted,
    canAsk: permission.canAskAgain,
    request: async () => (await requestPermission()).granted,
  };
}
