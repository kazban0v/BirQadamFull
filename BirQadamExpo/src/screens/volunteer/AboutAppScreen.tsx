import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../navigation/AppNavigator';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

const APP_VERSION = require('../../../app.json').expo.version as string;
const PORTAL_URL = 'https://birqadam.almau.edu.kz/portal/';
const SUPPORT_EMAIL = 'info@birqadam.site';

export const AboutAppScreen: React.FC = () => {
    const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const openPortal = () => {
    Linking.openURL(PORTAL_URL);
  };

  const openSupport = () => {
    const subject = encodeURIComponent(t('aboutapp.s_10'));
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.heroIconImage}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text style={styles.appName}>BirQadam</Text>
          <Text style={styles.appVersion}>{t('aboutapp.s_0', { APP_VERSION })}</Text>
          <Text style={styles.appDescription}>{t('aboutapp.s_1')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aboutapp.s_2')}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="checkbox-outline" size={20} color={appColors.primary} />
              <Text style={styles.infoText}>{t('aboutapp.s_3')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="camera-outline" size={20} color={appColors.primary} />
              <Text style={styles.infoText}>{t('aboutapp.s_4')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="stats-chart-outline" size={20} color={appColors.primary} />
              <Text style={styles.infoText}>{t('aboutapp.s_5')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aboutapp.s_6')}</Text>
          <View style={styles.linksCard}>
            <TouchableOpacity style={styles.linkRow} onPress={openPortal}>
              <View style={styles.linkLeft}>
                <Ionicons name="globe-outline" size={20} color={appColors.textMuted} />
                <Text style={styles.linkText}>{t('aboutapp.s_7')}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('PrivacyPolicy')}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color={appColors.textMuted} />
                <Text style={styles.linkText}>{t('aboutapp.s_8')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('VolunteerHelp')}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="help-circle-outline" size={20} color={appColors.textMuted} />
                <Text style={styles.linkText}>{t('aboutapp.s_9')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, styles.lastRow]}
              onPress={openSupport}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="mail-outline" size={20} color={appColors.textMuted} />
                <Text style={styles.linkText}>{SUPPORT_EMAIL}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={appColors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  heroCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: appColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroIconImage: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.text,
  },
  appVersion: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: appColors.primary,
  },
  appDescription: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.textMuted,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 14,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.textSecondary,
  },
  linksCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  linkLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  linkText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: appColors.textSecondary,
  },
});

