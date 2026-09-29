import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Check, ShoppingCart } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { addMissingToShoppingList, loadShoppingList } from '@/lib/shopping';
import { Button } from '@/components/ui/Button';
import { spacing } from '@/constants/theme';

interface Props {
  names: string[];
  // Quantité de chaque ingrédient (même ordre que names), qui arrive dans la liste de courses
  quantities: string[];
  recipeId?: string;
  recipeTitle: string;
  // Message de confirmation (avec « Voir ») affiché par la fiche recette
  onAdded: (message: string) => void;
  // « Voir » : ouvre la liste de courses
  onOpenList: () => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

// « Ajouter les 2 ingrédients aux courses » : ingrédients manquants d'une recette ajoutés à la liste de
// courses du foyer, avec leurs quantités, en un geste (sans doublon). Ensuite, le bouton indique que c'est
// fait (et ouvre la liste). Déjà tous sur la liste (pas encore achetés) : fait dès l'ouverture.
export function AddMissingButton({ names, quantities, recipeId, recipeTitle, onAdded, onOpenList }: Props) {
  const { t } = useLanguage();
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    loadShoppingList().then((items) => {
      if (!active || !items) return;
      const onList = new Set(items.filter((item) => !item.checked).map((item) => normalize(item.name)));
      setDone(names.length > 0 && names.every((name) => onList.has(normalize(name))));
    });
    return () => {
      active = false;
    };
  }, [names.join('|')]);

  const add = async () => {
    setAdding(true);
    try {
      const count = await addMissingToShoppingList(names, quantities, recipeId, recipeTitle);
      setDone(true);
      onAdded(count > 0 ? t('shopping.addedToast', { count }) : t('shopping.alreadyOnList'));
    } catch (error) {
      console.warn('[courses] ajout impossible :', error);
      Alert.alert(t('errors.writeTitle'), t('errors.writeText'));
    } finally {
      setAdding(false);
    }
  };

  return done ? (
    <Button
      label={t('recipe.addedToShopping', { count: names.length })}
      icon={Check}
      variant="soft"
      size="medium"
      onPress={onOpenList}
      accessibilityLabel={`${t('recipe.addedToShopping', { count: names.length })}, ${t('shopping.viewList')}`}
      style={styles.button}
    />
  ) : (
    <Button
      label={t('recipe.addToShoppingCount', { count: names.length })}
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
