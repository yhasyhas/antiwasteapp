import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { BarcodeScanningResult } from 'expo-camera';
import { useLanguage } from '@/contexts/LanguageContext';
import { lookupBarcode, type OffProduct } from '@/lib/openFoodFacts';
import type { ManualPrefill } from '@/components/scan/ManualAddModal';

// Codes des produits alimentaires (EAN-13, EAN-8, UPC)
export const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

// Scan de code-barres : un seul code à la fois (la caméra en signale plusieurs par seconde), recherche
// dans Open Food Facts, puis ajout manuel prérempli : produit trouvé, ou code seul s'il est inconnu.
// resume() relance le scan (à la fermeture de l'ajout manuel).
export function useBarcodeScan(onResult: (prefill: ManualPrefill) => void) {
  const { language, t } = useLanguage();
  const [lookingUp, setLookingUp] = useState(false);
  const locked = useRef(false);

  const onBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    const code = data.replace(/\D/g, '');
    if (code.length < 6 || code.length > 14) return;
    locked.current = true;
    setLookingUp(true);

    let product: OffProduct | null = null;
    let failed = false;
    try {
      product = await lookupBarcode(code, language);
    } catch (error) {
      console.warn('[code-barres] recherche impossible :', error);
      failed = true;
    }
    setLookingUp(false);

    const prefill: ManualPrefill = {
      key: Date.now(),
      barcode: code,
      found: product !== null,
      name: product?.name ?? '',
      quantity: product?.quantity ?? '',
      category: product?.category ?? null,
    };
    if (failed) {
      // Hors connexion : l'ajout manuel reste possible, avec le code
      Alert.alert(t('barcode.lookupFailedTitle'), t('barcode.lookupFailedText'), [
        { text: t('common.ok'), onPress: () => onResult(prefill) },
      ], { cancelable: false });
    } else {
      onResult(prefill);
    }
  };

  const resume = () => {
    locked.current = false;
  };

  return { lookingUp, onBarcodeScanned, resume };
}
