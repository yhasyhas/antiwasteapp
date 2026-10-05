import React from 'react';
import { router } from 'expo-router';
import { ChefHat } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { showDialog } from '@/lib/dialog';
import { recipeKey, startCooking, useCookingSession, type CookingRecipe } from '@/lib/cookingSession';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  // Recette affichée (dans sa traduction si elle est affichée traduite)
  recipe: CookingRecipe;
  // La fiche recette se ferme avant d'ouvrir le mode cuisine (elle couvrirait l'écran)
  onBeforeOpen: () => void;
  style?: StyleProp<ViewStyle>;
}

// « Commencer à cuisiner » sur la fiche recette ; séance en cours pour cette recette : « Reprendre à l'étape 3 » ;
// séance en cours pour une autre recette : choix entre la reprendre et commencer celle-ci (ses minuteurs s'arrêtent).
export function CookStartButton({ recipe, onBeforeOpen, style }: Props) {
  const { t } = useLanguage();
  const session = useCookingSession();
  const same = session?.key === recipeKey(recipe);

  const open = () => {
    onBeforeOpen();
    router.push('/cook');
  };
  const start = async () => {
    await startCooking(recipe);
    open();
  };

  const onPress = () => {
    if (same) return open();
    if (!session) return start();
    showDialog(t('cook.replaceTitle'), t('cook.replaceText', { title: session.recipe.title }), [
      { text: t('cook.keepCurrent'), style: 'cancel', onPress: open },
      { text: t('cook.replace'), onPress: start },
    ]);
  };

  const label = !same || !session ? t('cook.start')
    : session.phase === 'prep' ? t('cook.resumePrep')
    : session.phase === 'steps' ? t('cook.resume', { step: session.step + 1 })
    : t('cook.doneTitle');

  return <Button label={label} icon={ChefHat} size="large" disabled={recipe.instructions.length === 0} onPress={onPress} style={style} />;
}
