import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { authAPI } from '../../services/api';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";
import { SafeAreaView } from 'react-native-safe-area-context';

interface ChangePasswordScreenProps {
  navigation: any;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ navigation }) => {
    const { t } = useTranslation();
  const toast = useToast();
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
      nextErrors.currentPassword = t('changepassword.s_0');
    }

    if (!newPassword) {
      nextErrors.newPassword = t('changepassword.s_1');
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = t('changepassword.s_2');
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = t('changepassword.s_3');
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = t('changepassword.s_4');
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = t('changepassword.s_5');
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
      toast.success(t('changepassword.s_7'));
      navigation.goBack();
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('changepassword.s_8'));
      setRequestError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          <Text style={styles.headerTitle}>{t('changepassword.s_9')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.description}>
              {t('changepassword.s_10')}</Text>

            {requestError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={appColors.danger} />
                <Text style={styles.errorText}>{requestError}</Text>
              </View>
            ) : null}

            <Input
              label={t('changepassword.s_11')}
              placeholder={t('changepassword.s_12')}
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
              label={t('changepassword.s_13')}
              placeholder={t('changepassword.s_14')}
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
              label={t('changepassword.s_15')}
              placeholder={t('changepassword.s_16')}
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
          <Button title={t('changepassword.s_17')} onPress={handleSubmit} loading={submitting} />
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
