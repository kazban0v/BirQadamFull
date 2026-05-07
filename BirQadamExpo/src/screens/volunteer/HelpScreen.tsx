import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/AppNavigator';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

// Включаем анимацию LayoutAnimation для Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItemProps {
  question: string;
  answer: string;
  isLast: boolean;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isLast }) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.faqItemContainer, !isLast && styles.faqItemBorder]}>
      <TouchableOpacity
        style={styles.faqHeader}
        onPress={toggleExpand}
        activeOpacity={0.6}
      >
        <Text style={[styles.questionText, expanded && styles.questionTextActive]}>
          {question}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={expanded ? "#10B981" : appColors.textSoft}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.faqBody}>
          <Text style={styles.answerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

export const VolunteerHelpScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { t } = useTranslation();

  const handleContactSupport = () => {
    // Открываем почтовый клиент с предзаполненным адресом и темой письма
    Linking.openURL(t('help.s_0'));
  };

  const faqs = [
    // О рейтинге и часах
    {
      q: t('help.s_1'),
      a: t('help.s_2')
    },
    {
      q: t('help.s_3'),
      a: t('help.s_4')
    },
    // Trust Factor и отмены
    {
      q: t('help.s_5'),
      a: t('help.s_6')
    },
    {
      q: t('help.s_7'),
      a: t('help.s_8')
    },
    // О фотоотчетах (очень частая боль волонтеров)
    {
      q: t('help.s_9'),
      a: t('help.s_10')
    },
    {
      q: t('help.s_11'),
      a: t('help.s_12')
    },
    // Технические и организационные вопросы
    {
      q: t('help.s_13'),
      a: t('help.s_14')
    },
    {
      q: t('help.s_15'),
      a: t('help.s_16')
    }
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>{t('help.s_17')}</Text>
          <Text style={styles.subtitle}>{t('help.s_18')}</Text>
        </View>

        {/* Карточка службы поддержки */}
        <View style={styles.supportCard}>
          <View style={styles.supportHeader}>
            <View style={styles.supportIconWrapper}>
              {/* Поменяли иконку на почтовый конверт */}
              <Ionicons name="mail-outline" size={24} color={appColors.primary} />
            </View>
            <View style={styles.supportTextContent}>
              <Text style={styles.supportTitle}>{t('help.s_19')}</Text>
              <Text style={styles.supportDescription}>
                {t('help.s_20')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="mail" size={18} color={appColors.white} style={{ marginRight: 8 }} />
            <Text style={styles.supportButtonText}>{t('help.s_21')}</Text>
          </TouchableOpacity>
        </View>

        {/* Частые вопросы */}
        <Text style={styles.sectionTitle}>{t('help.s_22')}</Text>
        <View style={styles.faqListContainer}>
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.q}
              answer={faq.a}
              isLast={index === faqs.length - 1}
            />
          ))}
        </View>
        
        {/* Ссылка на политику конфиденциальности */}
        <TouchableOpacity
          style={styles.privacyButton}
          onPress={() => navigation.navigate('PrivacyPolicy')}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={appColors.primary} style={{ marginRight: 10 }} />
          <Text style={styles.privacyText}>{t('help.s_23')}</Text>
          <Ionicons name="chevron-forward" size={18} color={appColors.primary} />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background, // Стандартный фон приложения
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: appColors.textMuted,
  },

  /* Стили карточки поддержки */
  supportCard: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  supportHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  supportIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  supportTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: 13,
    color: appColors.textMuted,
    lineHeight: 18,
  },
  supportButton: {
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  supportButtonText: {
    color: appColors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Стили блока FAQ */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  faqListContainer: {
    backgroundColor: appColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  faqItemContainer: {
    backgroundColor: appColors.surface,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.textSecondary,
    flex: 1,
    paddingRight: 16,
    lineHeight: 20,
  },
  questionTextActive: {
    color: appColors.primary, // При открытии вопрос подсвечивается зеленым
  },
  faqBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 0,
  },
  answerText: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 22,
  },
  privacyButton: {
    marginTop: 24,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appColors.primary,
  },
  privacyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
  },
});
