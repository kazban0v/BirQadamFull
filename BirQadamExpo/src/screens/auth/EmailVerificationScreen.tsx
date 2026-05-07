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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../store/authStore';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

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
    const { t } = useTranslation();
  const email = route.params?.email || '';
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ code?: string }>({});
  
  const { verifyEmail, resendVerificationCode, cancelRegistration, isLoading, error, clearError } = useAuthStore();

  const validate = () => {
    const newErrors: { code?: string } = {};
    
    if (!code.trim()) {
      newErrors.code = t('emailverification.s_0');
    } else if (code.length !== 6) {
      newErrors.code = t('emailverification.s_1');
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
      Alert.alert(t('emailverification.s_2'), t('emailverification.s_3'));
    } catch (err: unknown) {
      Alert.alert(t('emailverification.s_4'), getAxiosErrorMessage(err, t('emailverification.s_5')));
    }
  };

  const handleCancel = () => {
    Alert.alert(
      t('emailverification.s_6'),
      t('emailverification.s_7'),
      [
        { text: t('emailverification.s_8'), style: 'cancel' },
        {
          text: t('emailverification.s_9'),
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[EmailVerification] Canceling registration for:', email);
              await cancelRegistration(email);
              console.log('[EmailVerification] Registration cancelled, navigating back');
              navigation.navigate('Login');
            } catch (err: unknown) {
              console.error('[EmailVerification] Cancel error:', err);
              Alert.alert(t('emailverification.s_10'), getAxiosErrorMessage(err, t('emailverification.s_11')));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          
          <Text style={styles.title}>{t('emailverification.s_12')}</Text>
          <Text style={styles.subtitle}>
            {t('emailverification.s_13')}{'\n'}{email}
          </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={appColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <Input
          label={t('emailverification.s_14')}
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
          title={t('emailverification.s_15')}
          onPress={handleVerify}
          loading={isLoading}
          style={styles.button}
        />

        <TouchableOpacity onPress={handleResendCode} style={styles.resendButton}>
          <Text style={styles.resendButtonText}>{t('emailverification.s_16')}</Text>
        </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>{t('emailverification.s_17')}</Text>
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

