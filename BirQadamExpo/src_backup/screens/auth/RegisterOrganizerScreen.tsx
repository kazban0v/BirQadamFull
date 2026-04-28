import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../store/authStore';
import { appColors } from '../../theme';

interface RegisterOrganizerScreenProps {
  navigation: any;
}

export const RegisterOrganizerScreen: React.FC<RegisterOrganizerScreenProps> = ({
  navigation,
}) => {
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    phone_number: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization_name: '',
    inn: '',
    bin: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const { registerOrganizer, isLoading, error, clearError, requiresEmailVerification } = useAuthStore();

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Введите имя пользователя';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Введите ваше имя';
    }
    
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Введите номер телефона';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Введите email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Введите корректный email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Введите пароль';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать не менее 8 символов';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }
    
    if (!formData.organization_name.trim()) {
      newErrors.organization_name = 'Введите название организации';
    }
    
    if (!formData.inn.trim()) {
      newErrors.inn = 'Введите ИИН/ИНН';
    }
    
    if (!formData.bin.trim()) {
      newErrors.bin = 'Введите БИН/ИИК';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    
    clearError();
    
    try {
      await registerOrganizer({
        username: formData.username,
        name: formData.name,
        phone_number: formData.phone_number,
        email: formData.email,
        password: formData.password,
        organization_name: formData.organization_name,
        inn: formData.inn,
        bin: formData.bin,
      });
    } catch (err) {
      // Ошибка уже установлена в store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
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
          <Text style={styles.headerTitle}>Регистрация организатора</Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={appColors.primary} />
          <Text style={styles.infoText}>
            После регистрации ваша организация пройдет проверку администратором
          </Text>
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
          <Text style={styles.sectionTitle}>Личная информация</Text>
          
          <Input
            label="Имя пользователя"
            placeholder="Придумайте логин"
            value={formData.username}
            onChangeText={(text: string) => {
              setFormData({ ...formData, username: text });
              if (errors.username) setErrors({ ...errors, username: undefined });
            }}
            error={errors.username}
            icon="person"
          />

          <Input
            label="Ваше имя"
            placeholder="Как к вам обращаться"
            value={formData.name}
            onChangeText={(text: string) => {
              setFormData({ ...formData, name: text });
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            error={errors.name}
            icon="person-outline"
          />

          <Input
            label="Номер телефона"
            placeholder="+7 (___) ___-__-__"
            value={formData.phone_number}
            onChangeText={(text: string) => {
              setFormData({ ...formData, phone_number: text });
              if (errors.phone_number) setErrors({ ...errors, phone_number: undefined });
            }}
            error={errors.phone_number}
            keyboardType="phone-pad"
            icon="call"
          />

          <Input
            label="Email"
            placeholder="example@mail.com"
            value={formData.email}
            onChangeText={(text: string) => {
              setFormData({ ...formData, email: text });
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail"
          />

          <Input
            label="Пароль"
            placeholder="Придумайте пароль"
            value={formData.password}
            onChangeText={(text: string) => {
              setFormData({ ...formData, password: text });
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
            secureTextEntry
            error={errors.password}
            icon="lock-closed"
          />

          <Input
            label="Подтверждение пароля"
            placeholder="Повторите пароль"
            value={formData.confirmPassword}
            onChangeText={(text: string) => {
              setFormData({ ...formData, confirmPassword: text });
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
            }}
            secureTextEntry
            error={errors.confirmPassword}
            icon="lock-closed"
          />

          <Text style={[styles.sectionTitle, styles.sectionTitleMargin]}>
            Информация об организации
          </Text>

          <Input
            label="Название организации"
            placeholder="ТОО, ИП или другое"
            value={formData.organization_name}
            onChangeText={(text: string) => {
              setFormData({ ...formData, organization_name: text });
              if (errors.organization_name)
                setErrors({ ...errors, organization_name: undefined });
            }}
            error={errors.organization_name}
            icon="business"
          />

          <Input
            label="ИИН/ИНН"
            placeholder="12 цифр"
            value={formData.inn}
            onChangeText={(text: string) => {
              setFormData({ ...formData, inn: text });
              if (errors.inn) setErrors({ ...errors, inn: undefined });
            }}
            error={errors.inn}
            keyboardType="numeric"
            icon="card"
          />

          <Input
            label="БИН/ИИК"
            placeholder="12 цифр"
            value={formData.bin}
            onChangeText={(text: string) => {
              setFormData({ ...formData, bin: text });
              if (errors.bin) setErrors({ ...errors, bin: undefined });
            }}
            error={errors.bin}
            keyboardType="numeric"
            icon="card"
          />

          <Button
            title="Подать заявку"
            onPress={handleRegister}
            loading={isLoading}
            style={styles.registerButton}
          />
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Уже есть аккаунт?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLinkText}>Войти</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: appColors.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: appColors.primaryDark,
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
    fontSize: 14,
    color: appColors.danger,
  },
  form: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: appColors.text,
    marginTop: 8,
  },
  sectionTitleMargin: {
    marginTop: 24,
  },
  registerButton: {
    marginTop: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  loginText: {
    fontSize: 14,
    color: appColors.textMuted,
  },
  loginLinkText: {
    fontSize: 14,
    color: appColors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
});
