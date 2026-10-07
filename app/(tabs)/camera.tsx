import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { Plus, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { useScan } from '@/hooks/useScan';
import { useBarcodeScan } from '@/hooks/useBarcodeScan';
import { ManualAddModal, type ManualPrefill } from '@/components/scan/ManualAddModal';
import { ScanModeToggle, type ScanMode } from '@/components/scan/ScanModeToggle';
import { ConfirmIngredientsModal } from '@/components/scan/ConfirmIngredientsModal';
import { PermissionRequest } from '@/components/scan/PermissionRequest';
import { ScannerCamera, useScannerPermission } from '@/components/scan/ScannerCamera';
import type { ScannerCameraHandle, ScannerFacing } from '@/components/scan/scannerCameraTypes';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Touchable } from '@/components/ui/Touchable';
import { reportCameraIssue } from '@/lib/sentry';
import { colors, opacity, radius, sizes, spacing, typography } from '@/constants/theme';

// Retour sur l'onglet : court délai avant de rouvrir la caméra (certains téléphones, Samsung notamment, ne
// l'ont pas encore libérée) ; puis l'aperçu doit recevoir sa première image en quelques secondes
const CAMERA_REOPEN_DELAY_MS = 500;
const CAMERA_READY_TIMEOUT_MS = 5000;

export default function CameraScreen() {
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const permission = useScannerPermission();
  const [facing, setFacing] = useState<ScannerFacing>('back');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [mode, setMode] = useState<ScanMode>('photo');
  // Ajout manuel prérempli après un scan de code-barres
  const [prefill, setPrefill] = useState<ManualPrefill | null>(null);
  // « Ajouter à la main » demandé par un autre écran (premier lancement guidé) ; « at » : chaque demande est nouvelle
  const { manual, at } = useLocalSearchParams<{ manual?: string; at?: string }>();
  useEffect(() => {
    if (manual === '1') setShowManualAdd(true);
  }, [manual, at]);
  const cameraRef = useRef<ScannerCameraHandle>(null);
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
    setDetectedQuantity,
    setDetectedLocation,
    setDetectedChoice,
    confirmDetected,
    groups,
    saving,
    closeConfirmation,
    notice,
    showNotice,
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
  // Caméra ouverte après le délai de réouverture
  const [cameraMounted, setCameraMounted] = useState(false);
  // Démarrage impossible (caméra occupée, erreur du système, aucune image reçue) : message et « Réessayer »
  const [cameraError, setCameraError] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const cameraReady = useRef(false);
  const autoRestarted = useRef(false);
  const retryCamera = () => {
    autoRestarted.current = false;
    setCameraError(false);
    setCameraKey((key) => key + 1);
  };
  useEffect(() => {
    if (!cameraOn) {
      setCameraMounted(false);
      return;
    }
    autoRestarted.current = false;
    const timer = setTimeout(() => setCameraMounted(true), CAMERA_REOPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cameraOn]);
  // Surveillance : aucune image reçue à temps (aperçu vide, sans erreur) → caméra relancée une fois
  // automatiquement, puis erreur. Signal fiable : la première image de l'aperçu (onPreviewStarted)
  useEffect(() => {
    if (!cameraMounted || cameraError) return;
    cameraReady.current = false;
    const timer = setTimeout(() => {
      if (cameraReady.current) return;
      if (!autoRestarted.current) {
        autoRestarted.current = true;
        reportCameraIssue('restart', 'ready_timeout');
        setCameraKey((key) => key + 1);
      } else {
        reportCameraIssue('error', 'ready_timeout');
        setCameraError(true);
      }
    }, CAMERA_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cameraMounted, cameraKey, cameraError]);
  // Caméra de retour : le scan de code-barres reprend (verrou laissé par un code lu juste avant de partir)
  useEffect(() => {
    if (cameraOn) resume();
  }, [cameraOn]);

  const manualAddModal = (
    <ManualAddModal
      visible={showManualAdd}
      prefill={prefill}
      onNothingAdded={() => showNotice(t('scan.nothingAdded'))}
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
        {/* Autorisation refusée pour de bon : la demande ne s'affiche plus, on ouvre les réglages du téléphone */}
        <PermissionRequest
          onRequest={() => (permission.canAsk ? permission.request() : Linking.openSettings())}
          onManualAdd={() => setShowManualAdd(true)}
        />
        {manualAddModal}
      </>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (!cameraRef.current || !cameraMounted) return;

    // Même compression qu'avant l'envoi à analyze-image (useScan)
    const uri = await cameraRef.current.takePhoto();
    if (uri) analyzeImage(uri, mode === 'receipt' ? 'receipt' : 'photo');
  };

  const barcode = mode === 'barcode';

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        {cameraOn && cameraMounted && !cameraError ? (
          <ScannerCamera
            key={cameraKey}
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            barcodeEnabled={barcode && !showManualAdd && !lookingUp}
            onBarcode={onBarcodeScanned}
            onPreviewStarted={() => {
              cameraReady.current = true;
            }}
            onError={(reason, message) => {
              console.warn('[caméra] démarrage impossible :', reason, message);
              reportCameraIssue('error', reason, message);
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
          // La caméra n'accepte pas d'enfants : le cadre de visée est superposé en position absolue
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, barcode && styles.barcodeFrame, mode === 'receipt' && styles.receiptFrame]}>
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
            <Text style={styles.analyzingText}>{lookingUp ? t('barcode.lookingUp') : mode === 'receipt' ? t('scan.analyzingReceipt') : t('scan.analyzingPhoto')}</Text>
            {analyzing ? <Text style={styles.analyzingHint}>{t('scan.analyzingHint')}</Text> : null}
          </View>
        )}

        {/* Information brève (« Aucun aliment ajouté ») en bas de l'aperçu */}
        <View style={styles.notice} pointerEvents="none">
          <Toast message={notice} />
        </View>

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
        <Text style={styles.instruction}>{barcode ? t('barcode.pointCamera') : mode === 'receipt' ? t('scan.pointReceipt') : t('scan.pointCamera')}</Text>

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
        onQuantityChange={setDetectedQuantity}
        onLocationChange={setDetectedLocation}
        onChoiceChange={setDetectedChoice}
        groups={groups}
        saving={saving}
        onConfirm={confirmDetected}
        onClose={closeConfirmation}
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
  // Fond sombre même sans aperçu (caméra en cours d'ouverture ou vide) : le titre blanc reste lisible
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.camera,
  },
  camera: {
    flex: 1,
    backgroundColor: colors.camera,
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
  // Ticket : plus haut que large
  receiptFrame: {
    width: sizes.scanFrame * 0.75,
    height: sizes.scanFrame * 1.3,
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
  notice: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
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
