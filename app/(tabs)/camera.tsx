import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
//import * as FileSystem from 'expo-file-system';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction, SessionExpiredError } from '@/lib/callEdgeFunction';
import { Camera, FlipHorizontal, X, Check, Plus } from 'lucide-react-native';
import { router } from 'expo-router';

// TEMPORAIRE (phases 0.5-0.6) : logs pour diagnostiquer le scan. À retirer une fois le scan validé.
const log = (...args: unknown[]) => console.log('[scan]', ...args);

// Ingrédient renvoyé par l'Edge Function analyze-image
interface ScannedIngredient {
  name: string;
  quantity: string;
  category: string;
  confidence: number;
  // Reçus depuis la phase 3, affichés en phase 5
  kind?: 'ingredient' | 'dish';
  storage_tip?: string;
}

export default function CameraScreen() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualIngredients, setManualIngredients] = useState<
    Array<{ name: string; quantity: string }>
  >([]);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const cameraRef = useRef<any>(null);
  
  // Nouveaux states pour la confirmation
  const [detectedIngredients, setDetectedIngredients] = useState<Array<{ name: string; quantity: string; confirmed: boolean }>>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Camera size={64} color="#10b981" strokeWidth={2} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to scan ingredients from photos.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setShowManualAdd(true)}
          >
            <Text style={styles.skipButtonText}>Add Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedImage(photo.uri);
      analyzeImage(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const analyzeImage = async (imageUri: string) => {
    setAnalyzing(true);

    try {
      // 1. Compresser et convertir en base64 avec expo-image-manipulator
      const context = ImageManipulator.ImageManipulator.manipulate(imageUri);
      context.resize({ width: 800 }); // Redimensionne pour réduire la taille
      const rendered = await context.renderAsync();
      const manipulatedImage = await rendered.saveAsync({
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true // ← Important : retourne le base64
      });

      if (!manipulatedImage.base64) {
        throw new Error('Failed to convert image to base64');
      }

      const base64 = manipulatedImage.base64;
      log(
        `base64 : ${Math.round(base64.length / 1024)} Ko (${base64.length} caractères),`,
        base64.startsWith('data:') ? `PRÉFIXE PRÉSENT : ${base64.slice(0, 30)}` : `sans préfixe, commence par ${base64.slice(0, 12)}`
      );

      // 2. Appeler l'Edge Function avec le jeton de l'utilisateur (la fonction refuse les appels anonymes)
      let result;
      try {
        result = await callEdgeFunction('analyze-image', {
          image_base64: base64,
          mime_type: 'image/jpeg',
          language,
          mode: 'photo',
        });
      } catch (error) {
        if (!(error instanceof SessionExpiredError)) throw error;
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }
      const { response, data } = result;
      log(`réponse HTTP ${response.status} (langue ${language}, fournisseur ${data?.provider ?? '-'})`, {
        error: data?.error,
        message: data?.message,
        details: data?.details,
        fallback_reason: data?.fallback_reason,
        ingredients: data?.ingredients,
      });

      // Une erreur du serveur n'est pas un « aucun ingrédient détecté » : on affiche le vrai message
      if (!response.ok || !data || data.error) {
        const message = [data?.message || data?.error, data?.details].filter(Boolean).join('\n') || `HTTP ${response.status}`;
        // 429 : limite du jour atteinte, le message du serveur l'explique et l'ajout manuel reste possible
        Alert.alert(response.status === 429 ? t('dailyLimitTitle') : 'Analysis failed', message, [
          { text: 'Add Manually', onPress: () => setShowManualAdd(true) },
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }

      if (data.ingredients && data.ingredients.length > 0) {
        setDetectedIngredients(data.ingredients.map((ingredient: ScannedIngredient) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          confirmed: true,
        })));
        setShowConfirmation(true);
      } else {
        Alert.alert(
          'No ingredients detected',
          'Try taking a clearer photo or add ingredients manually.',
          [
            { text: 'Add Manually', onPress: () => setShowManualAdd(true) },
            { text: 'Retry', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      log('exception', error);
      Alert.alert('Error', `Failed to analyze image: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setAnalyzing(false);
      setCapturedImage(null);
    }
  };

  // Renvoie true si les ingrédients ont bien été enregistrés
  const saveIngredients = async (ingredients: Array<{ name: string; quantity: string }>) => {
    if (!user) return false;

    const ingredientsToInsert = ingredients.map(({ name, quantity }) => ({
      user_id: user.id,
      name,
      quantity,
      added_via: 'camera',
    }));

    const { error } = await supabase
      .from('ingredients')
      .insert(ingredientsToInsert);

    if (error) {
      alertWriteError(t, 'saving scanned ingredients', error);
      return false;
    }
    return true;
  };

  const addManualIngredient = () => {
    if (!newIngredientName.trim()) return;

    setManualIngredients([
      ...manualIngredients,
      {
        name: newIngredientName.trim(),
        quantity: newIngredientQuantity.trim(),
      },
    ]);
    setNewIngredientName('');
    setNewIngredientQuantity('');
  };

  const removeManualIngredient = (index: number) => {
    setManualIngredients(manualIngredients.filter((_, i) => i !== index));
  };

  const saveManualIngredients = async () => {
    if (!user || manualIngredients.length === 0) return;

    const ingredientsToInsert = manualIngredients.map((ingredient) => ({
      user_id: user.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      added_via: 'manual',
    }));

    const { error } = await supabase
      .from('ingredients')
      .insert(ingredientsToInsert);

    if (error) {
      alertWriteError(t, 'saving manual ingredients', error);
    } else {
      setManualIngredients([]);
      setShowManualAdd(false);
      Alert.alert(
        'Success!',
        `Added ${ingredientsToInsert.length} ingredients to your pantry.`,
        [
          {
            text: 'View Pantry',
            onPress: () => router.push('/(tabs)/ingredients'),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan Ingredients</Text>
        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => setShowManualAdd(true)}
        >
          <Plus size={20} color="#10b981" />
          <Text style={styles.manualButtonText}>Add Manually</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
        {/* CameraView n'accepte pas d'enfants : le cadre est superposé en position absolue */}
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.scanFrame} />
        </View>

        {analyzing && capturedImage && (
          // La photo prise reste affichée pendant l'analyse, sous le message d'attente
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} resizeMode="cover" />
        )}
        {analyzing && (
          <View style={styles.analyzingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.analyzingText}>{t('analyzingPhoto')}</Text>
            <Text style={styles.analyzingHint}>{t('analyzingHint')}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Text style={styles.instructionText}>
          Point your camera at ingredients
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={toggleCameraFacing}
          >
            <FlipHorizontal size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={analyzing}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <View style={styles.placeholder} />
        </View>
      </View>

      {/* Modal Ajout Manuel */}
      <Modal
        visible={showManualAdd}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualAdd(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ingredients</Text>
              <TouchableOpacity onPress={() => setShowManualAdd(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ingredient Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Tomatoes"
                  value={newIngredientName}
                  onChangeText={setNewIngredientName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 3 pieces"
                  value={newIngredientQuantity}
                  onChangeText={setNewIngredientQuantity}
                />
              </View>

              <TouchableOpacity
                style={styles.addButton}
                onPress={addManualIngredient}
              >
                <Plus size={20} color="#10b981" />
                <Text style={styles.addButtonText}>Add to List</Text>
              </TouchableOpacity>

              {manualIngredients.length > 0 && (
                <View style={styles.ingredientList}>
                  <Text style={styles.listTitle}>Added Ingredients:</Text>
                  {manualIngredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.ingredientInfo}>
                        <Text style={styles.ingredientName}>
                          {ingredient.name}
                        </Text>
                        {ingredient.quantity ? (
                          <Text style={styles.ingredientQuantity}>
                            {ingredient.quantity}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => removeManualIngredient(index)}
                      >
                        <X size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.saveButton,
                manualIngredients.length === 0 && styles.saveButtonDisabled,
              ]}
              onPress={saveManualIngredients}
              disabled={manualIngredients.length === 0}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.saveButtonText}>
                Save {manualIngredients.length} Ingredient
                {manualIngredients.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 👉 NOUVEAU MODAL DE CONFIRMATION */}
      <Modal
        visible={showConfirmation}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Ingredients</Text>
              <TouchableOpacity onPress={() => setShowConfirmation(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.confirmationSubtitle}>
              We detected these ingredients. Uncheck any you don't want to add:
            </Text>

            <ScrollView style={styles.confirmationList}>
              {detectedIngredients.map((ing, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.confirmationItem}
                  onPress={() => {
                    const updated = [...detectedIngredients];
                    updated[index].confirmed = !updated[index].confirmed;
                    setDetectedIngredients(updated);
                  }}
                >
                  <View style={[styles.checkbox, ing.confirmed && styles.checkboxChecked]}>
                    {ing.confirmed && <Check size={16} color="#fff" />}
                  </View>
                  <Text style={[styles.confirmationText, !ing.confirmed && styles.confirmationTextUnchecked]}>
                    {ing.name}
                  </Text>
                  {ing.quantity !== '' && (
                    <Text style={styles.confirmationQuantity}>{ing.quantity}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={async () => {
                const confirmed = detectedIngredients.filter(i => i.confirmed);
                if (confirmed.length > 0) {
                  // En cas d'échec, le modal reste ouvert pour pouvoir réessayer
                  if (!(await saveIngredients(confirmed))) return;
                  setShowConfirmation(false);
                  setDetectedIngredients([]);
                  Alert.alert(
                    'Ingredients Added!',
                    `Added ${confirmed.length} ingredients to your pantry.`,
                    [
                      { text: 'View Pantry', onPress: () => router.push('/(tabs)/ingredients') },
                      { text: 'Scan More', style: 'cancel' }
                    ]
                  );
                } else {
                  Alert.alert('No ingredients selected', 'Please select at least one ingredient to add.');
                }
              }}
            >
              <Text style={styles.confirmButtonText}>
                Add {detectedIngredients.filter(i => i.confirmed).length} Ingredients
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: 60,
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
  permissionContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: '#6b7280',
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
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  instructionText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    marginBottom: 24,
  },
  addButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  ingredientList: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // 👉 NOUVEAUX STYLES POUR LE MODAL DE CONFIRMATION
  confirmationSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmationList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  confirmationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  confirmationText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  confirmationTextUnchecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  confirmationQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});