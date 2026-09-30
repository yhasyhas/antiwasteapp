import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { alertWriteError } from '@/lib/alertWriteError';
import { callEdgeFunction, SessionExpiredError } from '@/lib/callEdgeFunction';
import { failureReasonOf, failureTitle } from '@/lib/quotaReason';
import { expiryFromShelfLife, type FoodKind } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged } from '@/lib/pantryEvents';
import { linkPantryFoodKeys } from '@/lib/foodNames';
import { addPantryItems, defaultChoice, loadPantry, PantryConflictError, pantryGroups, type ExistingChoice } from '@/lib/pantry';
import type { LotGroup } from '@/lib/pantryLots';
import type { PantryIngredient } from '@/components/pantry/IngredientCard';
import type { AddChoice } from '@/components/pantry/ExistingFoodChoice';

// Durée de l'information « Aucun aliment ajouté »
const NOTICE_MS = 3000;

// Ingrédient renvoyé par l'Edge Function analyze-image
interface ScannedIngredient {
  name: string;
  quantity: string;
  category: string;
  confidence: number;
  kind?: FoodKind;
  storage_tip?: string;
  // Durée de conservation estimée par l'IA, en jours
  shelf_life_days?: number;
  // Identifiant standard de l'aliment (fiche aliment), null pour un plat
  food_key?: string | null;
}

export interface DetectedIngredient {
  name: string;
  quantity: string;
  category: string;
  kind: FoodKind;
  storage_tip: string;
  food_key: string | null;
  // Date proposée à partir de shelf_life_days, modifiable dans la confirmation
  expires_at: string;
  confirmed: boolean;
  // Déjà dans le garde-manger : ajouté au lot existant ou en lot séparé
  choice: ExistingChoice;
}

// Analyse d'une photo (analyze-image) et enregistrement des ingrédients confirmés
export function useScan({ onManualAdd }: { onManualAdd: () => void }) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedIngredients, setDetectedIngredients] = useState<DetectedIngredient[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  // Garde-manger au moment de la confirmation (aliments déjà présents)
  const [groups, setGroups] = useState<LotGroup<PantryIngredient>[]>([]);
  const [saving, setSaving] = useState(false);
  // Information brève sur le Scanner (« Aucun aliment ajouté »), sans alerte
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  // Confirmation fermée : la photo prise (vignette « Ta photo ») est oubliée
  const closeConfirmation = () => {
    setShowConfirmation(false);
    setDetectedIngredients([]);
    setCapturedImage(null);
  };

  const analyzeImage = async (imageUri: string) => {
    setCapturedImage(imageUri);
    setAnalyzing(true);
    // Photo gardée pour la vignette de la confirmation
    let confirming = false;

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
        Alert.alert(t('common.sessionExpiredTitle'), t('common.sessionExpiredText'));
        return;
      }
      const { response, data } = result;

      // Une erreur du serveur n'est pas un « aucun ingrédient détecté » : on affiche le vrai message
      if (!response.ok || !data || data.error) {
        const message = [data?.message || data?.error, data?.details].filter(Boolean).join('\n') || `HTTP ${response.status}`;
        // Quota personnel, quota des fournisseurs (secours compris) ou panne : le message du serveur l'explique,
        // l'ajout manuel reste possible
        Alert.alert(failureTitle(t, failureReasonOf(data), t('scan.analysisFailed')), message, [
          { text: t('scan.addManually'), onPress: onManualAdd },
          { text: t('common.ok'), style: 'cancel' },
        ]);
        return;
      }

      if (data.ingredients && data.ingredients.length > 0) {
        // Aliments déjà présents : repérés dans le garde-manger du foyer (hors connexion : aucun)
        const current = pantryGroups(await loadPantry());
        setGroups(current);
        setDetectedIngredients(data.ingredients.map((ingredient: ScannedIngredient) => {
          const kind: FoodKind = ingredient.kind === 'dish' ? 'dish' : 'ingredient';
          const detected = {
            name: ingredient.name,
            quantity: ingredient.quantity ?? '',
            category: ingredient.category,
            kind,
            storage_tip: ingredient.storage_tip ?? '',
            food_key: ingredient.food_key ?? null,
            expires_at: expiryFromShelfLife(ingredient.shelf_life_days, kind),
            confirmed: true,
          };
          return { ...detected, choice: defaultChoice(current, detected, language) };
        }));
        confirming = true;
        setShowConfirmation(true);
      } else {
        Alert.alert(
          t('scan.noIngredientsTitle'),
          t('scan.noIngredientsText'),
          [
            { text: t('scan.addManually'), onPress: onManualAdd },
            { text: t('common.retry'), style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('[scan] analyse impossible :', error);
      Alert.alert(t('common.error'), t('scan.analyzeError', { message: error instanceof Error ? error.message : String(error) }));
    } finally {
      setAnalyzing(false);
      if (!confirming) setCapturedImage(null);
    }
  };

  const toggleDetected = (index: number) => {
    setDetectedIngredients(detectedIngredients.map((item, i) => i === index ? { ...item, confirmed: !item.confirmed } : item));
  };

  const setDetectedExpiry = (index: number, expires_at: string) => {
    setDetectedIngredients(detectedIngredients.map((item, i) => i === index ? { ...item, expires_at } : item));
  };

  const setDetectedQuantity = (index: number, quantity: string) => {
    setDetectedIngredients((current) => current.map((item, i) => i === index ? { ...item, quantity } : item));
  };

  // Aliment déjà présent : ajouter aux existants, séparément, ou ne pas l'ajouter (décoché)
  const setDetectedChoice = (index: number, choice: AddChoice) => {
    setDetectedIngredients((current) => current.map((item, i) => {
      if (i !== index) return item;
      return choice === 'skip' ? { ...item, confirmed: false } : { ...item, confirmed: true, choice };
    }));
  };

  // Renvoie true si les ingrédients ont bien été enregistrés
  // Nouveaux lots et ajouts aux lots existants, en une seule opération
  const saveIngredients = async (ingredients: DetectedIngredient[]) => {
    if (!user) return false;
    try {
      await addPantryItems(ingredients.map((item) => ({ ...item, quantity: item.quantity.trim(), added_via: 'camera' as const })), groups, language);
      return true;
    } catch (error) {
      if (error instanceof PantryConflictError) {
        // Un membre du foyer vient de changer un lot : garde-manger relu, choix à vérifier
        setGroups(pantryGroups(await loadPantry()));
        Alert.alert(t('existing.conflictTitle'), t('existing.conflictText'));
      } else {
        alertWriteError(t, 'saving scanned ingredients', error);
      }
      return false;
    }
  };

  const confirmDetected = async () => {
    const confirmed = detectedIngredients.filter(i => i.confirmed);
    // Rien à ajouter (tout décoché ou « Ne pas ajouter ») : « Terminer » ferme la feuille, sans alerte
    if (confirmed.length === 0) {
      closeConfirmation();
      showNotice(t('scan.nothingAdded'));
      return;
    }
    // En cas d'échec, le modal reste ouvert pour pouvoir réessayer
    setSaving(true);
    const saved = await saveIngredients(confirmed);
    setSaving(false);
    if (!saved) return;
    closeConfirmation();
    notifyPantryChanged();
    // Aliments sans identifiant renvoyé par le scan : reliés à leur fiche en arrière-plan
    linkPantryFoodKeys();
    // Premier ajout d'une date : proposition des rappels avant le message de confirmation
    await maybeAskNotificationPermission();
    Alert.alert(
      t('scan.ingredientsAdded'),
      t('scan.addedToPantry', { count: confirmed.length }),
      [
        { text: t('scan.viewPantry'), onPress: () => router.navigate('/(tabs)/ingredients') },
        { text: t('scan.scanMore'), style: 'cancel' }
      ]
    );
  };

  return {
    capturedImage,
    analyzing,
    detectedIngredients,
    showConfirmation,
    setShowConfirmation,
    closeConfirmation,
    notice,
    showNotice,
    analyzeImage,
    toggleDetected,
    setDetectedExpiry,
    setDetectedQuantity,
    setDetectedChoice,
    confirmDetected,
    groups,
    saving,
  };
}
