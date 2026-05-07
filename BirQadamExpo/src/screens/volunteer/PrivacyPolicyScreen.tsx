import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

export const PrivacyPolicyScreen: React.FC = () => {
    const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('privacypolicy.s_0')}</Text>
        {/* Добавили дату, так как для неё уже был заготовлен стиль */}
        <Text style={styles.date}>{t('privacypolicy.s_1')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacypolicy.s_2')}</Text>
          <Text style={styles.text}>
            {t('privacypolicy.s_3')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacypolicy.s_4')}</Text>
          <Text style={styles.text}>
            {t('privacypolicy.s_5')}{'\n'}{t('privacypolicy.s_6')}{'\n'}{t('privacypolicy.s_7')}{'\n'}{t('privacypolicy.s_8')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacypolicy.s_9')}</Text>
          <Text style={styles.text}>
            {t('privacypolicy.s_10')}{'\n'}{t('privacypolicy.s_11')}{'\n'}{t('privacypolicy.s_12')}{'\n'}{t('privacypolicy.s_13')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacypolicy.s_14')}</Text>
          <Text style={styles.text}>
            {t('privacypolicy.s_15')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacypolicy.s_16')}</Text>
          <Text style={styles.text}>
            {t('privacypolicy.s_17')}</Text>
        </View>

        {/* ПЕРЕНЕСЕНО ВНУТРЬ SCROLLVIEW, чтобы прокручивалось вместе с текстом */}
        <View style={styles.footerLinks}>
          <Text style={styles.footerTitle}>{t('privacypolicy.s_18')}</Text>
          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={() => Linking.openURL('https://birqadam.almau.edu.kz/portal/')}>
              <Ionicons name="globe-outline" size={20} color={appColors.primary} />
              <Text style={styles.socialButtonText}>{t('privacypolicy.s_19')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.appVersion}>{t('privacypolicy.s_20')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: appColors.textMuted,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    color: appColors.textMuted,
    lineHeight: 22,
  },
  footerLinks: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.textSoft,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.primary,
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: appColors.primary,
  },
  legalLinks: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  legalText: {
    fontSize: 13,
    color: appColors.textMuted,
    textDecorationLine: 'underline',
  },
  appVersion: {
    fontSize: 12,
    color: '#D1D5DB',
  },
});
