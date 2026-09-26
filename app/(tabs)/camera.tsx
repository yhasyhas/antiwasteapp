import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { FlipHorizontal, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useScan } from '@/hooks/useScan';
import { FOOD_BARCODE_TYPES, useBarcodeScan } from '@/hooks/useBarcodeScan';
import { ManualAddModal, type ManualPrefill } from '@/components/scan/ManualAddModal';
import { ScanModeToggle, type ScanMode } from '@/components/scan/ScanModeToggle';
import { ConfirmIngredientsModal } from '@/components/scan/ConfirmIngredientsModal';
import { PermissionRequest } from '@/components/scan/PermissionRequest';

export default function CameraScreen() {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [mode, setMode] = useState<ScanMode>('photo');
  // Ajout manuel prérempli après un scan de code-barres
  const [prefill, setPrefill] = useState<ManualPrefill | null>(null);
  const cameraRef = useRef<any>(null);
  const { lookingUp, onBarcodeScanned, resume } = useBarcodeScan((result) => {
    setPrefill(result);
    setShowManualAdd(true);
  });
  const {
    capturedImage,
    analyzing,
    detectedIngredients,
    showConfirmation,
    setShowConfirmation,
    analyzeImage,
    toggleDetected,
    setDetectedExpiry,
    confirmDetected,
  } = useScan({ onManualAdd: () => setShowManualAdd(true) });

  const manualAddModal = (
    <ManualAddModal
      visible={showManualAdd}
      prefill={prefill}
      onClose={() => {
        setShowManualAdd(false);
        // Scan du code-barres suivant
        resume();
      }}
    />
  );

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <>
        <PermissionRequest onRequest={requestPermission} onManualAdd={() => setShowManualAdd(true)} />
        {manualAddModal}
      </>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync();
      analyzeImage(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, safe.top(20)]}>
        <Text style={styles.headerTitle}>{t('scan.title')}</Text>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setShowManualAdd(true)}
        >
          <Plus size={20} color="#10b981" />
          <Text style={styles.manualButtonText}>{t('scan.addManually')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          ref={cameraRef}
          barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODE_TYPES] }}
          onBarcodeScanned={mode === 'barcode' && !showManualAdd && !lookingUp ? onBarcodeScanned : undefined}
        />
        {/* CameraView n'accepte pas d'enfants : le cadre est superposé en position absolue */}
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={[styles.scanFrame, mode === 'barcode' && styles.barcodeFrame]} />
        </View>
        {lookingUp && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>{t('barcode.lookingUp')}</Text>
          </View>
        )}

        {analyzing && capturedImage && (
          // La photo prise reste affichée pendant l'analyse, sous le message d'attente
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} resizeMode="cover" />
        )}
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>{t('scan.analyzingPhoto')}</Text>
            <Text style={styles.analyzingHint}>{t('scan.analyzingHint')}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <ScanModeToggle mode={mode} onChange={setMode} />
        <Text style={styles.instructionText}>
          {mode === 'barcode' ? t('barcode.pointCamera') : t('scan.pointCamera')}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <FlipHorizontal size={24} color="#6b7280" />
          </TouchableOpacity>

          {mode === 'photo' ? (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              disabled={analyzing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          ) : (
            // Le code est lu dès qu'il est dans le cadre
            <View style={styles.captureButtonPlaceholder} />
          )}

          <View style={styles.placeholder} />
        </View>
      </View>

      {manualAddModal}

      <ConfirmIngredientsModal
        visible={showConfirmation}
        ingredients={detectedIngredients}
        onToggle={toggleDetected}
        onExpiryChange={setDetectedExpiry}
        onConfirm={confirmDetected}
        onClose={() => setShowConfirmation(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
  },
  manualButtonText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    borderWidth: 3,
    borderColor: '#10b981',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  barcodeFrame: {
    width: 300,
    height: 160,
    borderRadius: 16,
  },
  capturedImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Assez transparent pour voir la photo, assez sombre pour lire le message
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 6,
  },
  analyzingHint: {
    color: '#e5e7eb',
    fontSize: 14,
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 6,
  },
  controls: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  instructionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  placeholder: {
    width: 56,
  },
  captureButtonPlaceholder: {
    width: 72,
    height: 72,
  },
});
