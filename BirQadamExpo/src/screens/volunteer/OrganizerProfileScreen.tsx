import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { Header } from '../../components/Header';

interface RouteParams {
  organizerId: number;
}

interface OrganizerProfileScreenProps {
  navigation: any;
  route: {
    params: RouteParams;
  };
}

interface OrganizerPortfolio {
  id: number;
  username: string;
  full_name: string;
  organization_name?: string;
  portfolio: {
    age?: number;
    gender?: string;
    gender_display?: string;
    bio?: string;
    work_experience_years?: number;
    portfolio_photo_url?: string;
  };
  projects_count?: number;
  contact_phone?: string;
  contact_email?: string;
  contact_telegram?: string;
  email?: string;
  phone_number?: string;
}

export const OrganizerProfileScreen = ({
  navigation,
  route,
}: OrganizerProfileScreenProps) => {
  const { organizerId } = route.params;
  const [organizer, setOrganizer] = useState<OrganizerPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrganizerProfile = async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getOrganizerPortfolio(organizerId);
      setOrganizer(response.data);
    } catch (error: any) {
      console.error('❌ Error loading organizer profile:', error);
      const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить профиль организатора';
      Alert.alert('Ошибка', errorMessage, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizerProfile();
  }, [organizerId]);

  const callPhone = () => {
    const phone = organizer?.contact_phone || organizer?.phone_number;
    if (!phone) {
      Alert.alert('Внимание', 'Номер телефона не указан');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const sendEmail = () => {
    const email = organizer?.contact_email || organizer?.email;
    if (!email) {
      Alert.alert('Внимание', 'Email не указан');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  const openTelegram = async () => {
    if (!organizer?.contact_telegram) {
      Alert.alert('Внимание', 'Telegram не указан');
      return;
    }
    
    const username = organizer.contact_telegram.replace('@', '');
    const url = `https://t.me/${username}`;
    
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('Внимание', 'Не удалось открыть Telegram');
    }
  };

  // Функция для нормализации URL изображений
  const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
    if (!url) return undefined;
    
    if (__DEV__) {
      if (url.includes('cleanup.almau.edu.kz') || url.includes('birqadam.almau.edu.kz')) {
        return url.replace(/https?:\/\/[^\/]+/, 'http://192.168.0.129:8000');
      }
      if (url.startsWith('https://')) {
        return url.replace('https://', 'http://');
      }
    }
    
    return url;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!organizer) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
        <Text style={styles.errorText}>Организатор не найден</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Профиль организатора" showBack />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {normalizeImageUrl(organizer.portfolio?.portfolio_photo_url) ? (
            <Image 
              source={{ uri: normalizeImageUrl(organizer.portfolio?.portfolio_photo_url) }} 
              style={styles.profileImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('❌ Error loading organizer image:', error);
              }}
            />
          ) : (
            <View style={[styles.profileImage, styles.imagePlaceholder]}>
              <Ionicons name="business-outline" size={64} color="#9CA3AF" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Name and Organization */}
          <View style={styles.nameSection}>
            <Text style={styles.organizerName}>
              {organizer.full_name || organizer.username}
            </Text>
            {organizer.organization_name && (
              <Text style={styles.organizationName}>
                {organizer.organization_name}
              </Text>
            )}
          </View>

          {/* Portfolio Info */}
          {(organizer.portfolio?.age || organizer.portfolio?.gender_display || organizer.portfolio?.work_experience_years) && (
            <View style={styles.portfolioInfoContainer}>
              {organizer.portfolio?.age && (
                <View style={[styles.portfolioInfoItem, { marginBottom: 12 }]}>
                  <View style={styles.portfolioInfoIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>Возраст</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.age} {organizer.portfolio.age === 1 ? 'год' : organizer.portfolio.age < 5 ? 'года' : 'лет'}
                    </Text>
                  </View>
                </View>
              )}
              
              {organizer.portfolio?.gender_display && (
                <View style={[styles.portfolioInfoItem, { marginBottom: 12 }]}>
                  <View style={styles.portfolioInfoIcon}>
                    <Ionicons name="person-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>Пол</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.gender_display}
                    </Text>
                  </View>
                </View>
              )}
              
              {organizer.portfolio?.work_experience_years && (
                <View style={styles.portfolioInfoItem}>
                  <View style={styles.portfolioInfoIcon}>
                    <Ionicons name="briefcase-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>Стаж работы</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.work_experience_years} {organizer.portfolio.work_experience_years === 1 ? 'год' : organizer.portfolio.work_experience_years < 5 ? 'года' : 'лет'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Stats */}
          {organizer.projects_count !== undefined && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{organizer.projects_count}</Text>
                <Text style={styles.statLabel}>Проектов</Text>
              </View>
            </View>
          )}

          {/* Bio */}
          {organizer.portfolio?.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>О себе</Text>
              <Text style={styles.bioText}>{organizer.portfolio.bio}</Text>
            </View>
          )}

          {/* Contacts */}
          {(organizer.contact_phone || organizer.phone_number || organizer.contact_email || organizer.email || organizer.contact_telegram) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Контакты</Text>
              <View style={styles.contactsGrid}>
                {(organizer.contact_phone || organizer.phone_number) && (
                  <TouchableOpacity style={styles.contactButton} onPress={callPhone}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="call-outline" size={20} color="#10B981" />
                    </View>
                  </TouchableOpacity>
                )}
                {(organizer.contact_email || organizer.email) && (
                  <TouchableOpacity style={styles.contactButton} onPress={sendEmail}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="mail-outline" size={20} color="#10B981" />
                    </View>
                  </TouchableOpacity>
                )}
                {organizer.contact_telegram && (
                  <TouchableOpacity style={styles.contactButton} onPress={openTelegram}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="send-outline" size={20} color="#10B981" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Spacer */}
          <View style={styles.spacer} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: 200,
    backgroundColor: '#E5E7EB',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  nameSection: {
    marginBottom: 20,
  },
  organizerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  portfolioInfoContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  portfolioInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portfolioInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  portfolioInfoContent: {
    flex: 1,
  },
  portfolioInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  portfolioInfoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
    marginRight: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  experienceText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  contactsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactButton: {
    // Убрали flex: 1, чтобы кнопки не растягивались
  },
  contactIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    height: 100,
  },
});

