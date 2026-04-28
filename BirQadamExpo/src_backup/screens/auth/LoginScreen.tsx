import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../store/authStore';
import { OnboardingStorage } from '../../utils/storage';
import { appColors } from '../../theme';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface LoginScreenProps {
  navigation: any;
  onShowOnboarding?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onShowOnboarding }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  
  const { login, isLoading, error, clearError } = useAuthStore();

  const validate = () => {
    const newErrors: { identifier?: string; password?: string } = {};
    
    if (!identifier.trim()) {
      newErrors.identifier = 'Введите email, телефон или имя пользователя';
    }
    
    if (!password) {
      newErrors.password = 'Введите пароль';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    
    clearError();
    
    try {
      await login({ identifier, password });
    } catch (err) {
      // Ошибка уже установлена в store
    }
  };

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Сбросить онбординг?',
      'Вы снова увидите экраны приветствия при следующем запуске',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: async () => {
            await OnboardingStorage.reset();
            Alert.alert('Готово', 'Онбординг будет показан при следующем запуске приложения');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="leaf" size={80} color={appColors.primary} />
          <Text style={styles.logoText}>BirQadam</Text>
          <Text style={styles.logoSubtitle}>Вместе делаем город чище!</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={appColors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email, телефон или имя пользователя"
            placeholder="Введите логин"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (errors.identifier) {
                const newErrors = { ...errors };
                delete newErrors.identifier;
                setErrors(newErrors);
              }
            }}
            error={errors.identifier}
            icon="person"
          />

          <Input
            label="Пароль"
            placeholder="Введите пароль"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                const newErrors = { ...errors };
                delete newErrors.password;
                setErrors(newErrors);
              }
            }}
            secureTextEntry
            error={errors.password}
            icon="lock-closed"
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('PasswordReset')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Забыли пароль?</Text>
          </TouchableOpacity>

          <Button
            title="Войти"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.loginButton}
          />
        </View>

        {/* Register Links */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Нет аккаунта?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('RegisterVolunteer')}
            style={styles.registerLink}
          >
            <Text style={styles.registerLinkText}>Зарегистрироваться как волонтёр</Text>
          </TouchableOpacity>
        </View>
        
        {/* Debug: Reset Onboarding Button */}
        {__DEV__ && (
          <View style={styles.debugContainer}>
            <TouchableOpacity onPress={handleResetOnboarding} style={styles.debugButton}>
              <Ionicons name="refresh" size={16} color={appColors.textMuted} />
              <Text style={styles.debugText}>Сбросить онбординг (Debug)</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? 16 : 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: isSmallDevice ? 24 : 32,
  },
  logoText: {
    fontSize: isSmallDevice ? 28 : 32,
    fontWeight: '700',
    color: appColors.primary,
    marginTop: isSmallDevice ? 12 : 16,
  },
  logoSubtitle: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.textMuted,
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.dangerSurface,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.danger,
  },
  form: {
    paddingHorizontal: 16,
    marginBottom: isSmallDevice ? 16 : 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: isSmallDevice ? 16 : 24,
  },
  forgotPasswordText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.primary,
    fontWeight: '500',
  },
  loginButton: {
    marginBottom: isSmallDevice ? 12 : 16,
  },
  registerContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  registerText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.textMuted,
    marginBottom: isSmallDevice ? 12 : 16,
  },
  registerLink: {
    marginBottom: isSmallDevice ? 8 : 12,
  },
  registerLinkText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.primary,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: isSmallDevice ? 16 : 24,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: appColors.border,
    paddingTop: 16,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  debugText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.textMuted,
    marginLeft: 8,
  },
});
