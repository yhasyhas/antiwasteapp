import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { addDays, addMonths, formatDate, fromISODate, todayISO, toISODate } from '@/lib/expiry';

interface Props {
  value: string;
  onChange: (iso: string) => void;
}

// Date de péremption : boutons rapides (à partir d'aujourd'hui) et calendrier du téléphone
export function ExpiryPicker({ value, onChange }: Props) {
  const { t, language } = useLanguage();
  const [showCalendar, setShowCalendar] = useState(false);
  const today = todayISO();

  const quickChoices = [
    { label: t('expiry.plus3Days'), iso: addDays(today, 3) },
    { label: t('expiry.plus1Week'), iso: addDays(today, 7) },
    { label: t('expiry.plus1Month'), iso: addMonths(today, 1) },
  ];

  const onCalendarChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android : la fenêtre se ferme d'elle-même ; iOS : calendrier affiché jusqu'à « OK »
    if (Platform.OS === 'android') setShowCalendar(false);
    if (event.type === 'set' && date) onChange(toISODate(date));
  };

  return (
    <View>
      <View style={styles.row}>
        {quickChoices.map((choice) => (
          <TouchableOpacity
            key={choice.label}
            style={[styles.chip, value === choice.iso && styles.chipSelected]}
            onPress={() => onChange(choice.iso)}
          >
            <Text style={[styles.chipText, value === choice.iso && styles.chipTextSelected]}>{choice.label}</Text>
          </TouchableOpacity>
        ))}
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.chip} onPress={() => setShowCalendar(true)} accessibilityLabel={t('expiry.pickDate')}>
            <CalendarDays size={16} color="#374151" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.current}>{t('expiry.expiresOn', { date: formatDate(value, language) })}</Text>

      {showCalendar && (
        <View>
          <DateTimePicker
            value={fromISODate(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={fromISODate(today)}
            onChange={onCalendarChange}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.done} onPress={() => setShowCalendar(false)}>
              <Text style={styles.doneText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#047857',
  },
  current: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
  done: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
});
