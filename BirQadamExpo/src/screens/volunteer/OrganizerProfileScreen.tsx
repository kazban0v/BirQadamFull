import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { Header } from '../../components/Header';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";
import { ModerationMenu } from '../../components/ModerationMenu';

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
    const { t } = useTranslation();
  const toast = useToast();
  const { organizerId } = route.params;
  const [organizer, setOrganizer] = useState<OrganizerPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOrganizerProfile = async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getPublicOrganizerPortfolio(organizerId);
      setOrganizer(response.data);
    } catch (error: unknown) {
      console.error('Error loading organizer profile:', error);
      const errorMessage = getAxiosErrorMessage(error, t('organizerprofile.s_0'));
      toast.error(errorMessage);
      navigation.goBack();
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
      toast.info(t('organizerprofile.s_3'));
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const sendEmail = () => {
    const email = organizer?.contact_email || organizer?.email;
    if (!email) {
      toast.info(t('organizerprofile.s_5'));
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  const openTelegram = async () => {
    if (!organizer?.contact_telegram) {
      toast.info(t('organizerprofile.s_7'));
      return;
    }
    
    const username = organizer.contact_telegram.replace('@', '');
    const url = `https://t.me/${username}`;
    
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      toast.error(t('organizerprofile.s_9'));
    }
  };

  // Функция для нормализации URL изображений

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  if (!organizer) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={appColors.textSoft} />
        <Text style={styles.errorText}>{t('organizerprofile.s_10')}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t('organizerprofile.s_11')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title={t('organizerprofile.s_12')} 
        showBack 
        rightElement={
          <ModerationMenu 
            targetUserId={organizerId}
            targetName={organizer.full_name || organizer.username}
            contentType="user_profile"
          />
        }
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {normalizeImageUrl(organizer.portfolio?.portfolio_photo_url) ? (
            <Image 
              source={{ uri: normalizeImageUrl(organizer.portfolio?.portfolio_photo_url) }} 
              style={styles.profileImage}
              resizeMode="cover"
              onError={(error) => {
                console.error('Error loading organizer image:', error);
              }}
            />
          ) : (
            <View style={[styles.profileImage, styles.imagePlaceholder]}>
              <Ionicons name="business-outline" size={64} color={appColors.textSoft} />
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
                    <Ionicons name="calendar-outline" size={18} color={appColors.primary} />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>{t('organizerprofile.s_13')}</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.age} {organizer.portfolio.age === 1 ? t('organizerprofile.s_14') : organizer.portfolio.age < 5 ? t('organizerprofile.s_15') : t('organizerprofile.s_16')}
                    </Text>
                  </View>
                </View>
              )}
              
              {organizer.portfolio?.gender_display && (
                <View style={[styles.portfolioInfoItem, { marginBottom: 12 }]}>
                  <View style={styles.portfolioInfoIcon}>
                    <Ionicons name="person-outline" size={18} color={appColors.primary} />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>{t('organizerprofile.s_17')}</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.gender_display}
                    </Text>
                  </View>
                </View>
              )}
              
              {organizer.portfolio?.work_experience_years && (
                <View style={styles.portfolioInfoItem}>
                  <View style={styles.portfolioInfoIcon}>
                    <Ionicons name="briefcase-outline" size={18} color={appColors.primary} />
                  </View>
                  <View style={styles.portfolioInfoContent}>
                    <Text style={styles.portfolioInfoLabel}>{t('organizerprofile.s_18')}</Text>
                    <Text style={styles.portfolioInfoValue}>
                      {organizer.portfolio.work_experience_years} {organizer.portfolio.work_experience_years === 1 ? t('organizerprofile.s_19') : organizer.portfolio.work_experience_years < 5 ? t('organizerprofile.s_20') : t('organizerprofile.s_21')}
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
                <Text style={styles.statLabel}>{t('organizerprofile.s_22')}</Text>
              </View>
            </View>
          )}

          {/* Bio */}
          {organizer.portfolio?.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('organizerprofile.s_23')}</Text>
              <Text style={styles.bioText}>{organizer.portfolio.bio}</Text>
            </View>
          )}

          {/* Contacts */}
          {(organizer.contact_phone || organizer.phone_number || organizer.contact_email || organizer.email || organizer.contact_telegram) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('organizerprofile.s_24')}</Text>
              <View style={styles.contactsGrid}>
                {(organizer.contact_phone || organizer.phone_number) && (
                  <TouchableOpacity style={styles.contactButton} onPress={callPhone}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="call-outline" size={20} color={appColors.primary} />
                    </View>
                  </TouchableOpacity>
                )}
                {(organizer.contact_email || organizer.email) && (
                  <TouchableOpacity style={styles.contactButton} onPress={sendEmail}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="mail-outline" size={20} color={appColors.primary} />
                    </View>
                  </TouchableOpacity>
                )}
                {organizer.contact_telegram && (
                  <TouchableOpacity style={styles.contactButton} onPress={openTelegram}>
                    <View style={styles.contactIcon}>
                      <Ionicons name="send-outline" size={20} color={appColors.primary} />
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
    backgroundColor: appColors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: appColors.textSoft,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: appColors.primary,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    height: 200,
    backgroundColor: appColors.surfaceMuted,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: appColors.surfaceMuted,
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
    color: appColors.text,
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 16,
    color: appColors.primary,
    fontWeight: '600',
  },
  portfolioInfoContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: appColors.background,
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
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  portfolioInfoContent: {
    flex: 1,
  },
  portfolioInfoLabel: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  portfolioInfoValue: {
    fontSize: 15,
    color: appColors.text,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  statItem: {
    alignItems: 'center',
    marginRight: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: appColors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 22,
  },
  experienceText: {
    fontSize: 14,
    color: appColors.textMuted,
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
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    height: 100,
  },
});

