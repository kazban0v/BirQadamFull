import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextInputMask } from 'react-native-masked-text';
import { appColors } from '../theme';


interface InputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  prefix?: string;
  isPhone?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  error,
  icon,
  prefix,
  isPhone = false,
  style,
  inputStyle,
  multiline = false,
  numberOfLines = 1,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  const handlePhoneChange = (text: string) => {
    const raw = text.replace(/\D/g, '');
    onChangeText(raw);
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : undefined,
          !editable && styles.inputDisabled,
        ]}
      >
        {icon && <Ionicons name={icon} size={20} color={appColors.textSoft} style={styles.icon} />}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        {isPhone ? (
          <TextInputMask
            type="custom"
            options={{
              mask: '(999) 999-99-99',
            }}
            style={[styles.input, inputStyle, multiline && styles.inputMultiline]}
            placeholder={placeholder}
            placeholderTextColor={appColors.textSoft}
            value={value}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            editable={editable}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        ) : (
          <TextInput
            style={[styles.input, inputStyle, multiline && styles.inputMultiline]}
            placeholder={placeholder}
            placeholderTextColor={appColors.textSoft}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry && !showPassword}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline={multiline}
            numberOfLines={numberOfLines}
            textAlignVertical={multiline ? 'top' : 'center'}
            selectionColor={appColors.primary}
          />
        )}
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={appColors.textSoft}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: appColors.textMuted,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    borderRadius: 12,
    backgroundColor: appColors.surface,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputFocused: {
    borderColor: appColors.primary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: appColors.danger,
  },
  inputDisabled: {
    backgroundColor: appColors.surfaceMuted,
  },
  icon: {
    marginRight: 8,
  },
  prefix: {
    fontSize: 16,
    color: appColors.text,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: appColors.text,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 100,
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: appColors.danger,
    marginTop: 4,
  },
});
