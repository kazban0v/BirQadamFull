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
          color={expanded ? "#10B981" : "#9CA3AF"}
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

  const handleContactSupport = () => {
    // Открываем почтовый клиент с предзаполненным адресом и темой письма
    Linking.openURL('mailto:info@birqadam.site?subject=Вопрос в поддержку BirQadam');
  };

  const faqs = [
    // О рейтинге и часах
    {
      q: "Как начисляются часы и баллы?",
      a: "Часы начисляются автоматически после подтверждения вашей задачи организатором. Баллы (рейтинг от 1 до 5) выдаются за качество выполнения работы."
    },
    {
      q: "Как получить новые достижения?",
      a: "Достижения выдаются за активность: участвуйте в разных типах проектов (экология, социальная помощь), накапливайте волонтерские часы и получайте высокие оценки."
    },
    // О Trust Factor
    {
      q: "Что такое Trust Factor (TF)?",
      a: "Это ваш индекс доверия на платформе (максимум 30 баллов). Он растет при успешном закрытии задач и снижается при отменах в последний момент или отклонении отчетов. При TF = 0 вы не сможете вступать в проекты."
    },
    {
      q: "Как отказаться от задачи без потери Trust Factor?",
      a: "Вы можете отклонить задачу в приложении минимум за 24 часа до её начала. В таком случае штрафные баллы начислены не будут."
    },
    // О фотоотчетах (очень частая боль волонтеров)
    {
      q: "Сколько времени проверяется фотоотчет?",
      a: "Обычно организаторы проверяют отчеты в течение 1-3 рабочих дней. Как только отчет проверят, вам придет уведомление."
    },
    {
      q: "Что делать, если мой фотоотчет отклонили?",
      a: "Если задача еще активна, вы можете загрузить новое фото. Если вы считаете, что отчет отклонен ошибочно, свяжитесь со службой поддержки."
    },
    // Технические и организационные вопросы
    {
      q: "Организатор не отвечает, что делать?",
      a: "Если вопрос не срочный, подождите ответа. Если проблема требует немедленного решения (например, вы уже на месте, а никого нет), напишите в нашу поддержку."
    },
    {
      q: "Как удалить аккаунт?",
      a: "Для полного удаления аккаунта и всех связанных с ним данных, пожалуйста, напишите запрос в нашу службу поддержки с вашего зарегистрированного email."
    }
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Помощь</Text>
          <Text style={styles.subtitle}>Частые вопросы и связь с нами</Text>
        </View>

        {/* Карточка службы поддержки */}
        <View style={styles.supportCard}>
          <View style={styles.supportHeader}>
            <View style={styles.supportIconWrapper}>
              {/* Поменяли иконку на почтовый конверт */}
              <Ionicons name="mail-outline" size={24} color="#10B981" />
            </View>
            <View style={styles.supportTextContent}>
              <Text style={styles.supportTitle}>Служба поддержки</Text>
              <Text style={styles.supportDescription}>
                Не нашли ответ? Напишите нам на почту, мы постараемся ответить как можно быстрее.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="mail" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.supportButtonText}>Написать письмо</Text>
          </TouchableOpacity>
        </View>

        {/* Список вопросов */}
        <Text style={styles.sectionTitle}>Частые вопросы</Text>
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
        >
          <Text style={styles.privacyText}>Политика конфиденциальности</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Стандартный фон приложения
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
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },

  /* Стили карточки поддержки */
  supportCard: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#ECFDF5',
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
    color: '#111827',
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  supportButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  supportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Стили блока FAQ */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    marginLeft: 4,
  },
  faqListContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  faqItemContainer: {
    backgroundColor: '#FFFFFF',
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    color: '#374151',
    flex: 1,
    paddingRight: 16,
    lineHeight: 20,
  },
  questionTextActive: {
    color: '#10B981', // При открытии вопрос подсвечивается зеленым
  },
  faqBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 0,
  },
  answerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  privacyButton: {
    marginTop: 24,
    marginBottom: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  privacyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
  },
});