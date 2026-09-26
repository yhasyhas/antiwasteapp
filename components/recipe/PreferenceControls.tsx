import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, Minus, Plus, X } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/Input';
import { COOK_TIME_OPTIONS, MAX_EXCLUDED, MAX_SERVINGS } from '@/lib/preferences';

// Commandes communes à l'écran « Préférences » et aux filtres de génération

// Temps maximum : 15 min à 2 h
export function CookTimeChoice({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useLanguage();
  return (
    <View style={styles.grid}>
      {COOK_TIME_OPTIONS.map((minutes) => {
        const selected = value === minutes;
        return (
          <TouchableOpacity key={minutes} style={[styles.chip, selected && styles.chipSelected]} onPress={() => onChange(minutes)}>
            {selected && <Check size={16} color="#fff" />}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t('common.minutes', { count: minutes })}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Nombre de personnes : « non précisé » ou 1 à 12
export function ServingsStepper({ value, onChange }: { value: number | null; onChange: (servings: number | null) => void }) {
  const { t } = useLanguage();
  const current = value ?? 0;
  return (
    <View style={styles.stepper}>
      <TouchableOpacity
        style={[styles.stepButton, current === 0 && styles.stepButtonDisabled]}
        onPress={() => onChange(current <= 1 ? null : current - 1)}
        disabled={current === 0}
        accessibilityLabel="-"
      >
        <Minus size={18} color={current === 0 ? '#d1d5db' : '#10b981'} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value ? t('preferences.servingsValue', { count: value }) : t('preferences.servingsAny')}</Text>
      <TouchableOpacity
        style={[styles.stepButton, current >= MAX_SERVINGS && styles.stepButtonDisabled]}
        onPress={() => onChange(Math.min(MAX_SERVINGS, current + 1))}
        disabled={current >= MAX_SERVINGS}
        accessibilityLabel="+"
      >
        <Plus size={18} color={current >= MAX_SERVINGS ? '#d1d5db' : '#10b981'} />
      </TouchableOpacity>
    </View>
  );
}

// Aliments exclus (allergies, goûts) : étiquettes supprimables et champ d'ajout
export function ExcludedEditor({ value, onChange }: { value: string[]; onChange: (excluded: string[]) => void }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim().slice(0, 40);
    if (!name || value.length >= MAX_EXCLUDED) return;
    if (!value.some((item) => item.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft('');
  };
  return (
    <View style={styles.excluded}>
      {value.length > 0 && (
        <View style={styles.grid}>
          {value.map((item) => (
            <TouchableOpacity key={item} style={styles.excludedChip} onPress={() => onChange(value.filter((other) => other !== item))} accessibilityLabel={t('preferences.removeExcluded', { name: item })}>
              <Text style={styles.excludedText}>{item}</Text>
              <X size={14} color="#b91c1c" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {value.length < MAX_EXCLUDED && (
        <View style={styles.addRow}>
          <Input
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('preferences.excludedPlaceholder')}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={add}
            blurOnSubmit={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={add} disabled={!draft.trim()} accessibilityLabel={t('shopping.add')}>
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipSelected: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  chipTextSelected: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stepButtonDisabled: { borderColor: '#e5e7eb' },
  stepValue: { fontSize: 16, fontWeight: '600', color: '#111827', minWidth: 110, textAlign: 'center' },
  excluded: { gap: 10 },
  excludedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  excludedText: { fontSize: 14, color: '#b91c1c', fontWeight: '500' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' },
  addButton: { backgroundColor: '#10b981', borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
