import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { colors, fontFamilies, radius, sizes, spacing, typography } from '@/constants/theme';

// Couleurs explicites : sans elles, Android en mode sombre écrit en blanc (texte invisible sur les
// champs blancs de l'app, qui n'a pas encore de thème sombre)
export const INPUT_TEXT_COLOR = colors.text;
export const INPUT_PLACEHOLDER_COLOR = colors.textSecondary;

// Texte saisi brut (sans cadre) : couleurs et police de l'app
export const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
      selectionColor={colors.primary}
      {...props}
      style={[styles.text, style]}
    />
  );
});

type FieldProps = TextInputProps & {
  // Étiquette au-dessus du champ
  label?: string;
  // Mot de passe : œil pour afficher ou masquer les caractères
  password?: boolean;
  // Icône devant le texte (recherche)
  icon?: LucideIcon;
  // Élément à droite dans le cadre (bouton « + » des courses)
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

// Champ de l'app : étiquette au-dessus, cadre blanc de 52 px, bordure verte quand il est actif
export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, password = false, icon: Icon, trailing, containerStyle, style, onFocus, onBlur, ...props },
  ref,
) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.frame, focused && styles.frameFocused, props.multiline && styles.frameMultiline]}>
        {Icon ? <Icon size={sizes.icon} color={colors.textSecondary} /> : null}
        <Input
          ref={ref}
          {...props}
          style={[styles.input, style]}
          secureTextEntry={password ? !visible : props.secureTextEntry}
          autoCapitalize={password ? 'none' : props.autoCapitalize}
          autoCorrect={password ? false : props.autoCorrect}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {password ? (
          <TouchableOpacity
            style={styles.eye}
            onPress={() => setVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            {visible ? <EyeOff size={sizes.icon} color={colors.textSecondary} /> : <Eye size={sizes.icon} color={colors.textSecondary} />}
          </TouchableOpacity>
        ) : null}
        {trailing}
      </View>
    </View>
  );
});

// Ancien nom (écrans de connexion) : champ mot de passe
export function PasswordInput(props: FieldProps) {
  return <TextField {...props} password />;
}

const styles = StyleSheet.create({
  text: {
    color: INPUT_TEXT_COLOR,
    fontFamily: fontFamilies.regular,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  frame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.input,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  frameFocused: {
    borderColor: colors.primary,
  },
  frameMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    // Web : sans largeur minimale nulle, le champ ne rétrécit pas et pousse les éléments à droite
    minWidth: 0,
    minHeight: sizes.touch,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  eye: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
