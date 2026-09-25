import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction, SessionExpiredError } from '@/lib/callEdgeFunction';

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

export interface DetectedIngredient {
  name: string;
  quantity: string;
  confirmed: boolean;
}

// Analyse d'une photo (analyze-image) et enregistrement des ingrédients confirmés
export function useScan({ onManualAdd }: { onManualAdd: () => void }) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedIngredients, setDetectedIngredients] = useState<DetectedIngredient[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const analyzeImage = async (imageUri: string) => {
    setCapturedImage(imageUri);
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
          { text: 'Add Manually', onPress: onManualAdd },
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
            { text: 'Add Manually', onPress: onManualAdd },
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

  const toggleDetected = (index: number) => {
    const updated = [...detectedIngredients];
    updated[index].confirmed = !updated[index].confirmed;
    setDetectedIngredients(updated);
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

  const confirmDetected = async () => {
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
  };

  return {
    capturedImage,
    analyzing,
    detectedIngredients,
    showConfirmation,
    setShowConfirmation,
    analyzeImage,
    toggleDetected,
    confirmDetected,
  };
}
