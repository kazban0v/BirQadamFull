import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { appColors } from '../theme';


interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle = styles.button;

    if (disabled) {
      return { ...baseStyle, ...styles.buttonDisabled };
    }

    switch (variant) {
      case 'secondary':
        return { ...baseStyle, ...styles.buttonSecondary };
      case 'outline':
        return { ...baseStyle, ...styles.buttonOutline };
      default:
        return { ...baseStyle, ...styles.buttonPrimary };
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = styles.buttonText;

    if (disabled) {
      return { ...baseStyle, ...styles.buttonTextDisabled };
    }

    switch (variant) {
      case 'secondary':
        return { ...baseStyle, ...styles.buttonTextSecondary };
      case 'outline':
        return { ...baseStyle, ...styles.buttonTextOutline };
      default:
        return { ...baseStyle, ...styles.buttonTextPrimary };
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? appColors.primary : appColors.white} />
      ) : (
        <Text 
          style={[getTextStyle(), textStyle]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: appColors.primary,
  },
  buttonSecondary: {
    backgroundColor: appColors.surfaceMuted,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: appColors.primary,
  },
  buttonDisabled: {
    backgroundColor: appColors.surfaceSoft,
    borderColor: appColors.borderSoft,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextPrimary: {
    color: appColors.white,
  },
  buttonTextSecondary: {
    color: appColors.text,
  },
  buttonTextOutline: {
    color: appColors.primary,
  },
  buttonTextDisabled: {
    color: appColors.textSoft,
  },
});
