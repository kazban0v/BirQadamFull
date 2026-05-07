import React, { useEffect, useState } from 'react';
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
import { useAuthStore } from '../../store/authStore';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

interface EditProfileScreenProps {
  navigation: any;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
    const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isLoading = useAuthStore((state) => state.isLoading);
  const storeError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [email, setEmail] = useState(user?.email || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    clearError();
  }, [clearError]);

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

    if (!fullName.trim()) {
      nextErrors.fullName = t('editprofile.s_0');
    }

    if (!phoneNumber.trim()) {
      nextErrors.phoneNumber = t('editprofile.s_1');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    try {
      await updateProfile({
        name: fullName.trim(),
        phone_number: phoneNumber.trim(),
      });

      Alert.alert(t('editprofile.s_2'), t('editprofile.s_3'), [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch {
      // Ошибка уже отображается из store
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
          <Text style={styles.headerTitle}>{t('editprofile.s_4')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.description}>
              {t('editprofile.s_5')}</Text>

            {storeError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={appColors.danger} />
                <Text style={styles.errorText}>{storeError}</Text>
              </View>
            ) : null}

            <Input
              label={t('editprofile.s_6')}
              placeholder={t('editprofile.s_7')}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                clearFieldError('fullName');
              }}
              error={errors.fullName}
              icon="person-outline"
              autoCapitalize="words"
            />

            <Input
              label={t('editprofile.s_8')}
              placeholder="+7 777 123 45 67"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                clearFieldError('phoneNumber');
              }}
              error={errors.phoneNumber}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <Input
              label="Email"
              placeholder="example@mail.com"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
              inputStyle={styles.readOnlyInput}
            />
            <Text style={styles.readOnlyHint}>{t('editprofile.s_9')}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button title={t('editprofile.s_10')} onPress={handleSave} loading={isLoading} />
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
  readOnlyInput: {
    color: appColors.textMuted,
  },
  readOnlyHint: {
    marginTop: -8,
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 18,
    color: appColors.textSoft,
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
