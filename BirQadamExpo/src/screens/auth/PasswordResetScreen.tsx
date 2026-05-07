import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { useTranslation } from "../../locales/i18n";

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;
const isTablet = width >= 768;

// Адаптивные размеры
const scale = (size: number) => (width / 375) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const RESPONSIVE = {
  iconSize: isTablet ? 100 : isSmallDevice ? 60 : 80,
  titleSize: isTablet ? 32 : isSmallDevice ? 22 : 28,
  subtitleSize: isTablet ? 18 : isSmallDevice ? 14 : 16,
  headerTitleSize: isTablet ? 24 : isSmallDevice ? 18 : 20,
  errorTextSize: isTablet ? 16 : isSmallDevice ? 12 : 14,
  buttonTextSize: isTablet ? 18 : isSmallDevice ? 14 : 16,
  horizontalPadding: isTablet ? 40 : 16,
  verticalPadding: isTablet ? 32 : isSmallDevice ? 12 : 24,
  iconMargin: isTablet ? 32 : isSmallDevice ? 16 : 24,
  titleMargin: isTablet ? 12 : 8,
  subtitleMargin: isTablet ? 40 : isSmallDevice ? 24 : 32,
  backButtonSize: isTablet ? 28 : 24,
  maxWidth: isTablet ? 600 : width,
};

interface PasswordResetScreenProps {
  navigation: any;
}

type Step = 'request' | 'code' | 'password';

export const PasswordResetScreen: React.FC<PasswordResetScreenProps> = ({
  navigation,
}) => {
    const { t } = useTranslation();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const { requestPasswordReset, confirmPasswordReset, isLoading, error, clearError } = useAuthStore();

  const validateRequest = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!email.trim()) {
      newErrors.email = t('passwordreset.s_0');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('passwordreset.s_1');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCode = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!code.trim()) {
      newErrors.code = t('passwordreset.s_2');
    } else if (code.length !== 6) {
      newErrors.code = t('passwordreset.s_3');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!newPassword) {
      newErrors.newPassword = t('passwordreset.s_4');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t('passwordreset.s_5');
    }
    
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('passwordreset.s_6');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestReset = async () => {
    if (!validateRequest()) return;
    
    clearError();
    
    try {
      await requestPasswordReset(email);
      setStep('code');
    } catch (err) {
      // Ошибка уже установлена в store
    }
  };

  const handleConfirmCode = async () => {
    if (!validateCode()) return;
    
    clearError();
    setStep('password');
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;
    
    clearError();
    
    try {
      await confirmPasswordReset(email, code, newPassword);
      // Успешно - возвращаемся на экран входа
      navigation.navigate('Login', { 
        message: t('passwordreset.s_7') 
      });
    } catch (err) {
      // Ошибка уже установлена в store
    }
  };

  const renderRequestStep = () => (
    <View style={styles.contentWrapper}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={RESPONSIVE.iconSize} color={appColors.primary} />
      </View>
      
      <Text style={styles.title}>{t('passwordreset.s_8')}</Text>
      <Text style={styles.subtitle}>
        {t('passwordreset.s_9')}</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={RESPONSIVE.errorTextSize + 6} color={appColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <Input
          label="Email"
          placeholder="example@mail.com"
          value={email}
          onChangeText={(text: string) => {
            setEmail(text);
            if (errors.email) {
              const newErrors = { ...errors };
              delete newErrors.email;
              setErrors(newErrors);
            }
          }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail"
        />

        <Button
          title={t('passwordreset.s_10')}
          onPress={handleRequestReset}
          loading={isLoading}
          style={styles.button}
        />
      </View>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.contentWrapper}>
      <View style={styles.iconContainer}>
        <Ionicons name="mail" size={RESPONSIVE.iconSize} color={appColors.primary} />
      </View>
      
      <Text style={styles.title}>{t('passwordreset.s_11')}</Text>
      <Text style={styles.subtitle}>
        {t('passwordreset.s_12')}{email}
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={RESPONSIVE.errorTextSize + 6} color={appColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <Input
          label={t('passwordreset.s_13')}
          placeholder="000000"
          value={code}
          onChangeText={(text: string) => {
            const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
            setCode(numericText);
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
          title={t('passwordreset.s_14')}
          onPress={handleConfirmCode}
          loading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={handleRequestReset}
          style={styles.resendButton}
        >
          <Text style={styles.resendButtonText}>{t('passwordreset.s_15')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordStep = () => (
    <View style={styles.contentWrapper}>
      <View style={styles.iconContainer}>
        <Ionicons name="key" size={RESPONSIVE.iconSize} color={appColors.primary} />
      </View>
      
      <Text style={styles.title}>{t('passwordreset.s_16')}</Text>
      <Text style={styles.subtitle}>
        {t('passwordreset.s_17')}</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={RESPONSIVE.errorTextSize + 6} color={appColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <Input
          label={t('passwordreset.s_18')}
          placeholder={t('passwordreset.s_19')}
          value={newPassword}
          onChangeText={(text: string) => {
            setNewPassword(text);
            if (errors.newPassword) {
              const newErrors = { ...errors };
              delete newErrors.newPassword;
              setErrors(newErrors);
            }
          }}
          error={errors.newPassword}
          secureTextEntry
          icon="lock-closed"
        />

        <Input
          label={t('passwordreset.s_20')}
          placeholder={t('passwordreset.s_21')}
          value={confirmPassword}
          onChangeText={(text: string) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) {
              const newErrors = { ...errors };
              delete newErrors.confirmPassword;
              setErrors(newErrors);
            }
          }}
          error={errors.confirmPassword}
          secureTextEntry
          icon="lock-closed"
        />

        <Button
          title={t('passwordreset.s_22')}
          onPress={handleResetPassword}
          loading={isLoading}
          style={styles.button}
        />
      </View>
    </View>
  );

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => {
                if (step === 'password') setStep('code');
                else if (step === 'code') {
                  setStep('request');
                  clearError();
                }
                else navigation.goBack();
              }} 
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={RESPONSIVE.backButtonSize} color={appColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'request' && t('passwordreset.s_23')}
              {step === 'code' && t('passwordreset.s_24')}
              {step === 'password' && t('passwordreset.s_25')}
            </Text>
          </View>

          <View style={styles.centerWrapper}>
            {step === 'request' && renderRequestStep()}
            {step === 'code' && renderCodeStep()}
            {step === 'password' && renderPasswordStep()}
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
    paddingVertical: RESPONSIVE.verticalPadding,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: RESPONSIVE.maxWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE.horizontalPadding,
    marginBottom: RESPONSIVE.iconMargin,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  backButton: {
    padding: isTablet ? 8 : 4,
    marginRight: isTablet ? 12 : 8,
  },
  headerTitle: {
    fontSize: RESPONSIVE.headerTitleSize,
    fontWeight: '600',
    color: appColors.text,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: RESPONSIVE.iconMargin,
  },
  title: {
    fontSize: RESPONSIVE.titleSize,
    fontWeight: '700',
    color: appColors.text,
    textAlign: 'center',
    marginBottom: RESPONSIVE.titleMargin,
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  subtitle: {
    fontSize: RESPONSIVE.subtitleSize,
    color: appColors.textMuted,
    textAlign: 'center',
    paddingHorizontal: isTablet ? 80 : isSmallDevice ? 24 : 32,
    marginBottom: RESPONSIVE.subtitleMargin,
    lineHeight: RESPONSIVE.subtitleSize * 1.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.dangerSurface,
    borderRadius: isTablet ? 16 : 12,
    padding: isTablet ? 16 : 12,
    marginHorizontal: RESPONSIVE.horizontalPadding,
    marginBottom: isTablet ? 20 : 16,
  },
  errorText: {
    flex: 1,
    marginLeft: isTablet ? 12 : 8,
    fontSize: RESPONSIVE.errorTextSize,
    color: appColors.danger,
    lineHeight: RESPONSIVE.errorTextSize * 1.4,
  },
  form: {
    paddingHorizontal: RESPONSIVE.horizontalPadding,
  },
  button: {
    marginTop: isTablet ? 12 : isSmallDevice ? 4 : 8,
  },
  resendButton: {
    marginTop: isTablet ? 20 : isSmallDevice ? 12 : 16,
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 12,
  },
  resendButtonText: {
    fontSize: isTablet ? 16 : isSmallDevice ? 12 : 14,
    color: appColors.primary,
    fontWeight: '600',
  },
});
