import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { addDays, addMonths, formatDate, fromISODate, todayISO, toISODate } from '@/lib/expiry';
import { colors, spacing, typography } from '@/constants/theme';

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

  // Date choisie. Android : la fenêtre se ferme d'elle-même ; iOS : calendrier affiché jusqu'à « OK »
  const onCalendarValue = (_event: unknown, date: Date) => {
    if (Platform.OS === 'android') setShowCalendar(false);
    onChange(toISODate(date));
  };

  return (
    <View>
      <View style={styles.row}>
        {quickChoices.map((choice) => (
          <Chip key={choice.label} label={choice.label} selected={value === choice.iso} onPress={() => onChange(choice.iso)} />
        ))}
        {Platform.OS !== 'web' && (
          <Chip label={t('expiry.pickDate')} icon={CalendarDays} onPress={() => setShowCalendar(true)} />
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
            accentColor={colors.primary}
            onValueChange={onCalendarValue}
            onDismiss={() => setShowCalendar(false)}
          />
          {Platform.OS === 'ios' && (
            <Button label={t('common.ok')} variant="ghost" size="small" onPress={() => setShowCalendar(false)} style={styles.done} />
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
    gap: spacing.sm,
  },
  current: {
    ...typography.secondary,
    marginTop: spacing.sm,
  },
  done: {
    alignSelf: 'flex-end',
  },
});
