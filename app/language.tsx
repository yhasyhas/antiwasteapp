import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_LANGUAGES, type AppLanguage } from '@/lib/languages';
import { Card, cardStyles } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Touchable } from '@/components/ui/Touchable';
import { colors, sizes, spacing, typography } from '@/constants/theme';

// Réglages → Langue : langue de l'interface (les recettes suivent la langue choisie dans les filtres)
export default function LanguageScreen() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.language')} back />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.list}>
          {APP_LANGUAGES.map((lang, index) => {
            const selected = language === lang.code;
            return (
              <View key={lang.code}>
                {index > 0 ? <View style={cardStyles.divider} /> : null}
                <Touchable
                  scale={false}
                  style={styles.row}
                  onPress={() => setLanguage(lang.code as AppLanguage)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={lang.label}
                >
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <Text style={[styles.label, selected && styles.labelSelected]}>{lang.label}</Text>
                  {selected ? <Checkbox checked shape="circle" /> : null}
                </Touchable>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.screen,
  },
  list: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touch + spacing.lg,
  },
  flag: {
    ...typography.title3,
  },
  label: {
    ...typography.bodyMedium,
    flex: 1,
  },
  labelSelected: {
    fontFamily: typography.button.fontFamily,
    color: colors.primary,
  },
});
