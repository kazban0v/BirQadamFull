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

export const PrivacyPolicyScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Политика конфиденциальности</Text>
        {/* Добавили дату, так как для неё уже был заготовлен стиль */}
        <Text style={styles.date}>Последнее обновление: 26 марта 2026 г.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Общие положения</Text>
          <Text style={styles.text}>
            Ваша конфиденциальность важна для нас. Настоящая Политика конфиденциальности объясняет, как
            BirQadam собирает, использует и защищает ваши персональные данные при использовании мобильного приложения.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Сбор данных</Text>
          <Text style={styles.text}>
            Мы собираем только те данные, которые необходимы для функционирования платформы:
            {'\n'}• Имя и контактные сведения (телефон, email)
            {'\n'}• Фотоотчеты о выполненных задачах
            {'\n'}• Данные о вашей активности (часы, рейтинг)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Использование данных</Text>
          <Text style={styles.text}>
            Ваши данные используются для:
            {'\n'}• Подтверждения вашего участия в проектах
            {'\n'}• Связи с организаторами мероприятий
            {'\n'}• Формирования вашего волонтерского профиля и рейтинга
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Защита данных</Text>
          <Text style={styles.text}>
            Мы принимаем все необходимые технические и организационные меры для защиты ваших данных от
            несанкционированного доступа, изменения или удаления.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Ваши права</Text>
          <Text style={styles.text}>
            Вы имеете право запросить доступ к своим данным, их исправление или полное удаление. Для этого
            вы можете написать в нашу службу поддержки по адресу info@birqadam.site.
          </Text>
        </View>

        {/* ПЕРЕНЕСЕНО ВНУТРЬ SCROLLVIEW, чтобы прокручивалось вместе с текстом */}
        <View style={styles.footerLinks}>
          <Text style={styles.footerTitle}>Мы в соцсетях</Text>
          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton} onPress={() => Linking.openURL('https://birqadam.almau.edu.kz/portal/')}>
              <Ionicons name="globe-outline" size={20} color="#F8FAFC" />
              <Text style={styles.socialButtonText}>Веб-сайт</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.appVersion}>BirQadam • Версия 1.0.0</Text>
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
    backgroundColor: appColors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  socialButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: appColors.text,
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
