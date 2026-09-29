import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { addMissingToShoppingList } from '@/lib/shopping';

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
    <TouchableOpacity style={styles.button} onPress={add} disabled={adding}>
      {adding ? <ActivityIndicator size="small" color="#be185d" /> : <ShoppingCart size={16} color="#be185d" />}
      <Text style={styles.text}>{t('shopping.addMissing')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  text: { color: '#be185d', fontWeight: '600', fontSize: 14 },
});
