import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Apple, Bean, Beef, Carrot, CookingPot, Cookie, Croissant, CupSoda, Droplets, Egg, Fish, Flame, Leaf, Milk, Snowflake, Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { IconChip } from '@/components/ui/IconChip';
import { colors, type FoodFamily } from '@/constants/theme';

// Catégories d'aliment (colonne ingredients.category) : icône et grande famille (teinte de la pastille)
const CATEGORY_ICONS: Record<string, { icon: LucideIcon; family: FoodFamily }> = {
  fruit: { icon: Apple, family: 'plant' },
  vegetable: { icon: Carrot, family: 'plant' },
  legume: { icon: Bean, family: 'plant' },
  meat: { icon: Beef, family: 'protein' },
  fish: { icon: Fish, family: 'protein' },
  egg: { icon: Egg, family: 'protein' },
  dairy: { icon: Milk, family: 'cold' },
  frozen: { icon: Snowflake, family: 'cold' },
  beverage: { icon: CupSoda, family: 'cold' },
  grain: { icon: Wheat, family: 'grocery' },
  bakery: { icon: Croissant, family: 'grocery' },
  snack: { icon: Cookie, family: 'grocery' },
  condiment: { icon: Droplets, family: 'seasoning' },
  spice: { icon: Flame, family: 'seasoning' },
};

interface Props {
  category?: string | null;
  // Reste de plat : une marmite, quelle que soit la catégorie
  kind?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Pastille d'un aliment : icône de sa catégorie, teinte douce de sa famille ; feuille pour une catégorie
// inconnue ou absente
export function FoodIcon({ category, kind, size, style }: Props) {
  const entry = kind === 'dish' ? { icon: CookingPot, family: 'dish' as FoodFamily } : (category && CATEGORY_ICONS[category]) || { icon: Leaf, family: 'other' as FoodFamily };
  return <IconChip icon={entry.icon} palette={colors.foodFamilies[entry.family]} size={size} style={style} />;
}
