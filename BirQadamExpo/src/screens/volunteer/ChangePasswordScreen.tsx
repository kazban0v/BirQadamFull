import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { authAPI } from '../../services/api';
import { appColors } from '../../theme';

interface ChangePasswordScreenProps {
  navigation: any;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');

  const clearFieldError = (field: string) => {
    if (!errors[field]) {
      return;
    }

    const nextErrors = { ...errors };
    delete nextErrors[field];
    setErrors(nextErrors);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!currentPassword) {
      nextErrors.currentPassword = 'Введите текущий пароль';
    }

    if (!newPassword) {
      nextErrors.newPassword = 'Введите новый пароль';
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = 'Пароль должен содержать не менее 8 символов';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Повторите новый пароль';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Пароли не совпадают';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = 'Новый пароль должен отличаться от текущего';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setRequestError('');
    setSubmitting(true);

    try {
      await authAPI.changePassword(currentPassword, newPassword);
      Alert.alert('Успешно', 'Пароль успешно изменен.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Не удалось изменить пароль.';
      setRequestError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={appColors.surface === appColors.white ? 'dark-content' : 'light-content'}
        backgroundColor={appColors.surface}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={appColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Изменить пароль</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.description}>
              Укажите текущий пароль и придумайте новый. Новый пароль должен содержать минимум 8 символов.
            </Text>

            {requestError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={appColors.danger} />
                <Text style={styles.errorText}>{requestError}</Text>
              </View>
            ) : null}

            <Input
              label="Текущий пароль"
              placeholder="Введите текущий пароль"
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                clearFieldError('currentPassword');
                if (requestError) {
                  setRequestError('');
                }
              }}
              error={errors.currentPassword}
              secureTextEntry
              icon="lock-closed-outline"
            />

            <Input
              label="Новый пароль"
              placeholder="Введите новый пароль"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                clearFieldError('newPassword');
                if (requestError) {
                  setRequestError('');
                }
              }}
              error={errors.newPassword}
              secureTextEntry
              icon="key-outline"
            />

            <Input
              label="Повторите новый пароль"
              placeholder="Повторите новый пароль"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearFieldError('confirmPassword');
                if (requestError) {
                  setRequestError('');
                }
              }}
              error={errors.confirmPassword}
              secureTextEntry
              icon="shield-checkmark-outline"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Сохранить новый пароль" onPress={handleSubmit} loading={submitting} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 140,
  },
  card: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: appColors.textMuted,
    marginBottom: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: appColors.dangerSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 20,
    color: appColors.danger,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: appColors.surface,
    borderTopWidth: 1,
    borderColor: appColors.border,
  },
});
