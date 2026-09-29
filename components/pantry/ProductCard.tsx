import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { hasGenericFact } from '@/lib/foodNames';
import { spacing, typography } from '@/constants/theme';
import type { PantryIngredient } from './IngredientCard';

const CATEGORIES = ['fruit', 'vegetable', 'meat', 'fish', 'dairy', 'egg', 'grain', 'legume', 'bakery', 'condiment', 'spice', 'beverage', 'snack', 'frozen', 'other'] as const;

// Fiche d'un produit scanné par code-barres, d'après Open Food Facts : nom, marque, catégorie, Nutri-Score et
// groupe NOVA s'ils sont connus, lien vers sa page. Un produit transformé (NOVA 3 ou 4) ou de transformation
// inconnue n'a pas de fiche générique : cette fiche la remplace.
export function ProductCard({ ingredient }: { ingredient: PantryIngredient }) {
  const { t } = useLanguage();
  const category = CATEGORIES.find((value) => value === ingredient.category);
  const details = [
    ingredient.brand ? `${t('product.brand')} : ${ingredient.brand}` : null,
    category ? `${t('product.category')} : ${t(`category.${category}`)}` : null,
  ].filter(Boolean);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('product.title')}</Text>
      <Text style={styles.name}>{ingredient.product_name || ingredient.name}</Text>
      {details.map((line) => <Text key={line} style={styles.detail}>{line}</Text>)}
      {ingredient.nutriscore_grade || ingredient.nova_group ? (
        <View style={styles.badges}>
          {ingredient.nutriscore_grade ? <Badge label={t('product.nutriscore', { grade: ingredient.nutriscore_grade.toUpperCase() })} tone="soft" /> : null}
          {ingredient.nova_group ? <Badge label={t('product.nova', { group: ingredient.nova_group })} tone="neutral" /> : null}
        </View>
      ) : null}
      {hasGenericFact(ingredient) ? null : (
        <Text style={styles.detail}>{ingredient.nova_group ? t('product.processed') : t('product.unknownProcessing')}</Text>
      )}
      {ingredient.barcode ? (
        <Button
          label={t('product.viewOnOff')}
          icon={ExternalLink}
          variant="outline"
          size="medium"
          onPress={() => Linking.openURL(`https://world.openfoodfacts.org/product/${ingredient.barcode}`)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
  },
  name: {
    ...typography.bodyStrong,
  },
  detail: {
    ...typography.secondary,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
