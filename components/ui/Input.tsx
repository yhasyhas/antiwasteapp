import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

// Couleurs explicites : sans elles, Android en mode sombre écrit en blanc (texte invisible sur les
// champs blancs de l'app, qui n'a pas de thème sombre)
export const INPUT_TEXT_COLOR = '#111827';
export const INPUT_PLACEHOLDER_COLOR = '#9ca3af';

// Champ de saisie de l'app : texte et texte indicatif toujours lisibles
export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
      selectionColor="#10b981"
      {...props}
      style={[styles.text, style]}
    />
  );
});

// Mot de passe, avec un œil pour afficher ou masquer les caractères
export function PasswordInput({ style, ...props }: TextInputProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordRow}>
      <Input
        {...props}
        style={[style, styles.passwordInput]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={styles.eye}
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {visible ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: INPUT_TEXT_COLOR },
  passwordRow: { justifyContent: 'center' },
  // Place pour l'œil à droite
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 14, padding: 2 },
});
