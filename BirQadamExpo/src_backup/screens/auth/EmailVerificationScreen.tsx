import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../store/authStore';
import { appColors } from '../../theme';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;

interface EmailVerificationScreenProps {
  navigation: any;
  route: any;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const email = route.params?.email || '';
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ code?: string }>({});
  
  const { verifyEmail, resendVerificationCode, cancelRegistration, isLoading, error, clearError } = useAuthStore();

  const validate = () => {
    const newErrors: { code?: string } = {};
    
    if (!code.trim()) {
      newErrors.code = 'Введите код';
    } else if (code.length !== 6) {
      newErrors.code = 'Код должен содержать 6 цифр';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerify = async () => {
    if (!validate()) return;
    
    clearError();
    
    try {
      await verifyEmail(email, code);
      // После успешного подтверждения пользователь автоматически входит
    } catch (err) {
      console.error('[EmailVerification] Verify error:', err);
      // Ошибка уже установлена в store
    }
  };

  const handleResendCode = async () => {
    try {
      await resendVerificationCode(email);
      Alert.alert('Успешно', 'Код подтверждения отправлен повторно');
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось отправить код');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Отмена регистрации',
      'Вы уверены, что хотите отменить регистрацию? Все данные будут удалены.',
      [
        { text: 'Нет', style: 'cancel' },
        {
          text: 'Да, отменить',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[EmailVerification] Canceling registration for:', email);
              await cancelRegistration(email);
              console.log('[EmailVerification] Registration cancelled, navigating back');
              navigation.navigate('Login');
            } catch (err: any) {
              console.error('[EmailVerification] Cancel error:', err);
              Alert.alert('Ошибка', err.message || 'Не удалось отменить регистрацию');
            }
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
          <View style={styles.iconContainer}>
            <Ionicons name="mail" size={isSmallDevice ? 60 : 80} color={appColors.primary} />
          </View>
          
          <Text style={styles.title}>Подтвердите email</Text>
          <Text style={styles.subtitle}>
            Мы отправили 6-значный код на{'\n'}{email}
          </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={appColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <Input
          label="Код подтверждения"
          placeholder="000000"
          value={code}
          onChangeText={(text) => {
            setCode(text.replace(/[^0-9]/g, ''));
            if (errors.code) {
              const newErrors = { ...errors };
              delete newErrors.code;
              setErrors(newErrors);
            }
          }}
          error={errors.code}
          keyboardType="numeric"
          icon="keypad"
        />

        <Button
          title="Подтвердить"
          onPress={handleVerify}
          loading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity onPress={handleResendCode} style={styles.resendButton}>
          <Text style={styles.resendButtonText}>Отправить код повторно</Text>
        </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Отменить регистрацию</Text>
          </TouchableOpacity>
        </View>
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
    minHeight: height - 100,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: isSmallDevice ? 16 : 24,
  },
  title: {
    fontSize: isSmallDevice ? 20 : 24,
    fontWeight: '700',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isSmallDevice ? 14 : 16,
    color: appColors.textMuted,
    textAlign: 'center',
    paddingHorizontal: isSmallDevice ? 24 : 32,
    marginBottom: isSmallDevice ? 24 : 32,
    lineHeight: isSmallDevice ? 20 : 24,
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
  },
  button: {
    marginTop: isSmallDevice ? 4 : 8,
  },
  resendButton: {
    marginTop: isSmallDevice ? 12 : 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendButtonText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.primary,
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: isSmallDevice ? 4 : 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.danger,
    fontWeight: '500',
  },
});

