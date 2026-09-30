import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { TextField } from '@/components/ui/Input';
import { StepButton } from '@/components/ui/StepButton';
import { formatQuantity, parseQuantity } from '@/lib/quantity';
import { spacing, typography } from '@/constants/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  // Nom de l'aliment (« 4 œufs » compte des pièces)
  itemName: string;
  label?: string;
  placeholder?: string;
}

// Quantité d'un aliment à ajouter : saisie libre, avec « − » et « + » pour ce qui se compte (« 3 », « 3 œufs »,
// champ vide). « 500 g », « 1 paquet » : saisie libre seulement.
export function QuantityField({ value, onChange, itemName, label, placeholder }: Props) {
  const { t, language } = useLanguage();
  const parsed = parseQuantity(value, itemName);
  const countable = value.trim() === '' || parsed?.dimension === 'count';
  // Unité au pluriel vue en dernier (« tomates »), reprise en repassant au-dessus de 1
  const plural = useRef<string | null>(null);
  if (parsed && parsed.value > 1 && parsed.unit) plural.current = parsed.unit;

  const step = (direction: 1 | -1) => {
    const next = Math.max(1, Math.round((parsed?.value ?? 0) + direction));
    const unit = parsed?.unit ?? '';
    const shown = next > 1 && unit ? plural.current ?? (/^\p{L}{3,}$/u.test(unit) && !/[sx]$/.test(unit) ? `${unit}s` : unit) : unit;
    onChange(formatQuantity(next, shown, language));
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {countable ? <StepButton icon={Minus} label={t('cooked.less')} disabled={!parsed || parsed.value <= 1} onPress={() => step(-1)} /> : null}
        <TextField
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          containerStyle={styles.field}
          accessibilityLabel={label ?? t('manual.quantityLabel')}
        />
        {countable ? <StepButton icon={Plus} label={t('cooked.more')} onPress={() => step(1)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
  },
});
