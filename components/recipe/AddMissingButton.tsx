import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { addMissingToShoppingList } from '@/lib/shopping';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';

interface Props {
  names: string[];
  recipeId?: string;
  recipeTitle: string;
  // Avant d'ouvrir la liste : fermer la fiche
  onOpenList: () => void;
}

// Ingrédients manquants d'une recette ajoutés à la liste de courses du foyer, en un geste (sans doublon)
export function AddMissingButton({ names, recipeId, recipeTitle, onOpenList }: Props) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      const count = await addMissingToShoppingList(names, recipeId, recipeTitle);
      Alert.alert(t('shopping.addedTitle'), count > 0 ? t('shopping.addedText', { count }) : t('shopping.alreadyOnList'), [
        { text: t('common.ok'), style: 'cancel' },
        {
          text: t('shopping.viewList'),
          onPress: () => {
            onOpenList();
            router.push('/shopping');
          },
        },
      ]);
    } catch (error) {
      console.warn('[courses] ajout impossible :', error);
      Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Button
      label={t('recipe.addToShopping')}
      icon={ShoppingCart}
      variant="outline"
      size="medium"
      onPress={add}
      loading={adding}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
