import { useRef, useState } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { lookupBarcode, type OffProduct } from '@/lib/openFoodFacts';
import { displayQuantity } from '@/lib/quantity';
import type { ManualPrefill } from '@/components/scan/ManualAddModal';
import { showDialog } from '@/lib/dialog';

// Scan de code-barres (codes lus par ScannerCamera) : un seul code à la fois (la caméra en signale plusieurs
// par seconde), recherche dans Open Food Facts, puis ajout manuel prérempli : produit trouvé, ou code seul
// s'il est inconnu.
// resume() relance le scan (à la fermeture de l'ajout manuel).
export function useBarcodeScan(onResult: (prefill: ManualPrefill) => void) {
  const { language, t } = useLanguage();
  const [lookingUp, setLookingUp] = useState(false);
  const locked = useRef(false);

  const onBarcodeScanned = async (data: string) => {
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
      // Format de la langue, unité naturelle (« 0.25 kg » → « 250 g »)
      quantity: product ? displayQuantity(product.quantity, language) : '',
      category: product?.category ?? null,
      product: product ? {
        product_name: product.name,
        generic_name: product.genericName,
        brand: product.brand,
        nova_group: product.novaGroup,
        nutriscore_grade: product.nutriscore,
        off_categories: product.categories,
      } : null,
    };
    if (failed) {
      // Hors connexion : l'ajout manuel reste possible, avec le code
      showDialog(t('barcode.lookupFailedTitle'), t('barcode.lookupFailedText'), [
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
