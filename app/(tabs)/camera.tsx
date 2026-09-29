import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Plus, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useScan } from '@/hooks/useScan';
import { FOOD_BARCODE_TYPES, useBarcodeScan } from '@/hooks/useBarcodeScan';
import { ManualAddModal, type ManualPrefill } from '@/components/scan/ManualAddModal';
import { ScanModeToggle, type ScanMode } from '@/components/scan/ScanModeToggle';
import { ConfirmIngredientsModal } from '@/components/scan/ConfirmIngredientsModal';
import { PermissionRequest } from '@/components/scan/PermissionRequest';
import { Button } from '@/components/ui/Button';
import { Touchable } from '@/components/ui/Touchable';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';

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

  // Caméra montée seulement quand elle est visible : onglet Scanner affiché (les onglets restent montés en
  // arrière-plan), app au premier plan, aucune feuille par-dessus. Sinon elle est libérée : sur Android, un
  // aperçu resté ouvert pendant qu'on est ailleurs peut rester figé au retour.
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const cameraOn = isFocused && appActive && !showManualAdd && !showConfirmation;
  // Démarrage impossible (caméra occupée, erreur du système) : message et « Réessayer » (nouvelle caméra)
  const [cameraError, setCameraError] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const retryCamera = () => {
    setCameraError(false);
    setCameraKey((key) => key + 1);
  };
  // Caméra de retour : le scan de code-barres reprend (verrou laissé par un code lu juste avant de partir)
  useEffect(() => {
    if (cameraOn) resume();
  }, [cameraOn]);

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
    return <View style={styles.container} />;
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
    if (!cameraRef.current || !cameraOn) return;

    try {
      const photo = await cameraRef.current.takePictureAsync();
      analyzeImage(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const barcode = mode === 'barcode';

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        {cameraOn && !cameraError ? (
          <CameraView
            key={cameraKey}
            style={styles.camera}
            facing={facing}
            ref={cameraRef}
            barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODE_TYPES] }}
            onBarcodeScanned={barcode && !showManualAdd && !lookingUp ? onBarcodeScanned : undefined}
            onMountError={(event) => {
              console.warn('[caméra] démarrage impossible :', event.message);
              setCameraError(true);
            }}
          />
        ) : (
          <View style={styles.camera} />
        )}
        {cameraError ? (
          <View style={styles.cameraError}>
            <Text style={styles.cameraErrorTitle}>{t('scan.cameraErrorTitle')}</Text>
            <Text style={styles.cameraErrorText}>{t('scan.cameraErrorText')}</Text>
            <Button label={t('common.retry')} icon={RefreshCw} variant="accent" size="medium" onPress={retryCamera} />
          </View>
        ) : (
          // CameraView n'accepte pas d'enfants : le cadre de visée est superposé en position absolue
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, barcode && styles.barcodeFrame]}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
        )}

        {analyzing && capturedImage && (
          // La photo prise reste affichée pendant l'analyse, sous le message d'attente
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} resizeMode="cover" />
        )}
        {(analyzing || lookingUp) && (
          <View style={styles.analyzing}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.analyzingText}>{lookingUp ? t('barcode.lookingUp') : t('scan.analyzingPhoto')}</Text>
            {analyzing ? <Text style={styles.analyzingHint}>{t('scan.analyzingHint')}</Text> : null}
          </View>
        )}

        {/* En-tête posé sur l'aperçu */}
        <View style={[styles.header, safe.top(spacing.xl)]}>
          <Text style={styles.title}>{t('scan.shortTitle')}</Text>
          <Touchable onPress={() => setShowManualAdd(true)} style={styles.manual} accessibilityRole="button">
            <Plus size={sizes.icon} color={colors.onCamera} />
            <Text style={styles.manualText}>{t('scan.byHand')}</Text>
          </Touchable>
        </View>
      </View>

      <View style={styles.controls}>
        <ScanModeToggle mode={mode} onChange={setMode} />
        <Text style={styles.instruction}>{barcode ? t('barcode.pointCamera') : t('scan.pointCamera')}</Text>

        <View style={styles.buttonRow}>
          <Touchable onPress={toggleCameraFacing} style={styles.flip} accessibilityRole="button" accessibilityLabel={t('scan.flipCamera')}>
            <RefreshCw size={sizes.iconLarge} color={colors.primary} />
          </Touchable>

          {barcode ? (
            // Le code est lu dès qu'il est dans le cadre
            <View style={styles.capturePlaceholder} />
          ) : (
            <Touchable onPress={takePicture} disabled={analyzing || cameraError} style={[styles.capture, cameraError && styles.captureDisabled]} accessibilityRole="button" accessibilityLabel={t('scan.takePhoto')}>
              <View style={styles.captureInner} />
            </Touchable>
          )}

          <View style={styles.flipPlaceholder} />
        </View>
      </View>

      {manualAddModal}

      <ConfirmIngredientsModal
        visible={showConfirmation}
        ingredients={detectedIngredients}
        photo={capturedImage}
        onToggle={toggleDetected}
        onExpiryChange={setDetectedExpiry}
        onConfirm={confirmDetected}
        onClose={() => setShowConfirmation(false)}
      />
    </View>
  );
}

const CORNER = sizes.scanCorner;
const CORNER_WIDTH = sizes.scanCornerWidth;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.camera,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  title: {
    ...typography.title1,
    color: colors.onCamera,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.touch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.cameraControl,
  },
  manualText: {
    ...typography.button,
    color: colors.onCamera,
  },
  captureDisabled: {
    opacity: opacity.disabled,
  },
  cameraError: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
  },
  cameraErrorTitle: {
    ...typography.title3,
    color: colors.onCamera,
    textAlign: 'center',
  },
  cameraErrorText: {
    ...typography.body,
    color: colors.onCameraMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: sizes.scanFrame,
    height: sizes.scanFrame,
  },
  barcodeFrame: {
    height: sizes.scanFrame / 2,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: radius.card,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: radius.card,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: radius.card,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: radius.card,
  },
  capturedImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  analyzing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Assez transparent pour voir la photo, assez sombre pour lire le message
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  analyzingText: {
    ...typography.bodyStrong,
    color: colors.onCamera,
    textAlign: 'center',
  },
  analyzingHint: {
    ...typography.secondary,
    color: colors.onCameraMuted,
    textAlign: 'center',
  },
  controls: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -radius.sheet,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.screen,
    gap: spacing.lg,
  },
  instruction: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flip: {
    width: sizes.iconChipLarge,
    height: sizes.iconChipLarge,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipPlaceholder: {
    width: sizes.iconChipLarge,
  },
  capture: {
    width: sizes.captureButton,
    height: sizes.captureButton,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: sizes.captureButton - spacing.md,
    height: sizes.captureButton - spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  capturePlaceholder: {
    width: sizes.captureButton,
    height: sizes.captureButton,
  },
});
