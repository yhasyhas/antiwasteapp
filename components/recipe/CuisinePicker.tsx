import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/constants/theme';
import { cleanOtherCuisine, cuisineId, FAMILIES, familyOf, OTHER_CUISINE, OTHER_MAX_LENGTH } from '@/lib/cuisines';

interface Props {
  value: string;
  // Texte de « Autre cuisine… »
  other: string | null;
  onChange: (value: string, other: string | null) => void;
}

// Choix de la cuisine en deux niveaux (Préférences, filtres de la génération) : Peu importe, une famille
// (Afrique, Asie, Amériques, Méditerranée), France ou « Autre cuisine… » ; une famille ouvre ses régions, avec
// « Toute l'Afrique » choisie par défaut ; « Autre cuisine… » ouvre un champ libre de 40 caractères.
export function CuisinePicker({ value, other, onChange }: Props) {
  const { t } = useLanguage();
  const id = cuisineId(value);
  const family = familyOf(id);
  const regions = FAMILIES.find((item) => item.id === family)?.regions ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <Chip label={t('cuisine.choice.any')} showCheck selected={id === 'any'} onPress={() => onChange('any', null)} />
        {FAMILIES.map((item) => (
          <Chip key={item.id} label={t(`cuisine.family.${item.id}`)} showCheck selected={family === item.id} onPress={() => onChange(item.id, null)} />
        ))}
        <Chip label={t('cuisine.choice.france')} showCheck selected={id === 'france'} onPress={() => onChange('france', null)} />
        <Chip label={t('cuisine.other')} showCheck selected={id === OTHER_CUISINE} onPress={() => onChange(OTHER_CUISINE, other ?? '')} />
      </View>

      {family ? (
        <View style={styles.regions}>
          <View style={styles.grid}>
            <Chip label={t(`cuisine.choice.${family}`)} showCheck selected={id === family} onPress={() => onChange(family, null)} />
            {regions.map((region) => (
              <Chip key={region} label={t(`cuisine.choice.${region}` as never)} showCheck selected={id === region} onPress={() => onChange(region, null)} />
            ))}
          </View>
        </View>
      ) : null}

      {id === OTHER_CUISINE ? (
        <View style={styles.other}>
          <TextField
            value={other ?? ''}
            onChangeText={(text) => onChange(OTHER_CUISINE, cleanOtherCuisine(text))}
            placeholder={t('cuisine.otherPlaceholder')}
            maxLength={OTHER_MAX_LENGTH}
            autoCapitalize="none"
            returnKeyType="done"
            accessibilityLabel={t('cuisine.other')}
          />
          <Text style={styles.hint}>{t('cuisine.otherHint')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  regions: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.primarySoft,
  },
  other: {
    gap: spacing.xs,
  },
  hint: {
    ...typography.secondary,
    color: colors.textSecondary,
  },
});
