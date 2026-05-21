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
} from 'react-native';
import { useToast } from '../../components/Toast';
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

interface RegisterVolunteerScreenProps {
  navigation: any;
}

export const RegisterVolunteerScreen: React.FC<RegisterVolunteerScreenProps> = ({
  navigation,
}) => {
    const { t } = useTranslation();
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const { registerVolunteer, isLoading, error, clearError, requiresEmailVerification, verificationEmail } = useAuthStore();

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('registervolunteer.s_0');
    }
    
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = t('registervolunteer.s_1');
    }
    
    if (!formData.email.trim()) {
      newErrors.email = t('registervolunteer.s_2');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('registervolunteer.s_3');
    }
    
    if (!formData.password) {
      newErrors.password = t('registervolunteer.s_4');
    } else if (formData.password.length < 8) {
      newErrors.password = t('registervolunteer.s_5');
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('registervolunteer.s_6');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    
    clearError();
    
    try {
      await registerVolunteer({
        name: formData.name,
        phone_number: formData.phone_number,
        email: formData.email,
        password: formData.password,
      });
      // После успешной регистрации показываем экран подтверждения email
    } catch (err) {
      // Ошибка уже установлена в store
    }
  };

  const handleCancelRegistration = async () => {
    Alert.alert(
      t('registervolunteer.s_7'),
      t('registervolunteer.s_8'),
      [
        { text: t('registervolunteer.s_9'), style: 'cancel' },
        {
          text: t('registervolunteer.s_10'),
          style: 'destructive',
          onPress: async () => {
            try {
              await useAuthStore.getState().cancelRegistration(verificationEmail || formData.email);
              navigation.goBack();
            } catch (err: unknown) {
              toast.error(getAxiosErrorMessage(err, t('registervolunteer.s_12')));
            }
          },
        },
      ]
    );
  };

  // Экран подтверждения email
  if (requiresEmailVerification) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.verificationScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.verificationContainer}>
              <Ionicons name="mail" size={isSmallDevice ? 60 : 80} color={appColors.primary} />
              <Text style={styles.verificationTitle}>{t('registervolunteer.s_13')}</Text>
              <Text style={styles.verificationSubtitle}>
                {t('registervolunteer.s_14')}{verificationEmail}
              </Text>
              
              <TouchableOpacity
                onPress={() => navigation.navigate('EmailVerification', { email: verificationEmail })}
                style={styles.verifyButton}
              >
                <Text style={styles.verifyButtonText}>{t('registervolunteer.s_15')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleCancelRegistration}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>{t('registervolunteer.s_16')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={appColors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('registervolunteer.s_17')}</Text>
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
            label={t('registervolunteer.s_18')}
            placeholder={t('registervolunteer.s_19')}
            value={formData.name}
            onChangeText={(text: string) => {
              setFormData({ ...formData, name: text });
              if (errors.name) {
                const newErrors = { ...errors };
                delete newErrors.name;
                setErrors(newErrors);
              }
            }}
            error={errors.name}
            icon="person-outline"
          />

          <Input
            label={t('registervolunteer.s_20')}
            placeholder="(___) ___-__-__"
            value={formData.phone_number}
            onChangeText={(text: string) => {
              setFormData({ ...formData, phone_number: text });
              if (errors.phone_number) {
                const newErrors = { ...errors };
                delete newErrors.phone_number;
                setErrors(newErrors);
              }
            }}
            error={errors.phone_number}
            keyboardType="phone-pad"
            icon="call"
            prefix="+7"
            isPhone={true}
          />

          <Input
            label="Email"
            placeholder="example@mail.com"
            value={formData.email}
            onChangeText={(text: string) => {
              setFormData({ ...formData, email: text });
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

          <Input
            label={t('registervolunteer.s_21')}
            placeholder={t('registervolunteer.s_22')}
            value={formData.password}
            onChangeText={(text: string) => {
              setFormData({ ...formData, password: text });
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

          <Input
            label={t('registervolunteer.s_23')}
            placeholder={t('registervolunteer.s_24')}
            value={formData.confirmPassword}
            onChangeText={(text: string) => {
              setFormData({ ...formData, confirmPassword: text });
              if (errors.confirmPassword) {
                const newErrors = { ...errors };
                delete newErrors.confirmPassword;
                setErrors(newErrors);
              }
            }}
            secureTextEntry
            error={errors.confirmPassword}
            icon="lock-closed"
          />

          <Button
            title={t('registervolunteer.s_25')}
            onPress={handleRegister}
            loading={isLoading}
            style={styles.registerButton}
          />
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>{t('registervolunteer.s_26')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>{t('registervolunteer.s_27')}</Text>
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
    paddingVertical: isSmallDevice ? 12 : 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: isSmallDevice ? 16 : 24,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: isSmallDevice ? 18 : 20,
    fontWeight: '600',
    color: appColors.text,
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
    marginBottom: isSmallDevice ? 12 : 24,
  },
  registerButton: {
    marginTop: isSmallDevice ? 4 : 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  loginText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.textMuted,
  },
  loginLinkText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Стили для экрана верификации
  verificationScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height - 100,
  },
  verificationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isSmallDevice ? 24 : 32,
    paddingVertical: 40,
  },
  verificationTitle: {
    fontSize: isSmallDevice ? 20 : 24,
    fontWeight: '700',
    color: appColors.text,
    marginTop: isSmallDevice ? 16 : 24,
    textAlign: 'center',
  },
  verificationSubtitle: {
    fontSize: isSmallDevice ? 14 : 16,
    color: appColors.textMuted,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: isSmallDevice ? 20 : 24,
  },
  verifyButton: {
    backgroundColor: appColors.primary,
    borderRadius: 12,
    paddingVertical: isSmallDevice ? 12 : 14,
    paddingHorizontal: isSmallDevice ? 24 : 32,
    marginTop: isSmallDevice ? 24 : 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: isSmallDevice ? 14 : 16,
    fontWeight: '600',
    color: appColors.white,
  },
  cancelButton: {
    marginTop: isSmallDevice ? 12 : 16,
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: isSmallDevice ? 12 : 14,
    color: appColors.danger,
    fontWeight: '500',
  },
});
