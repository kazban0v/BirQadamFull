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
import { LinearGradient } from 'expo-linear-gradient';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { Header } from '../../components/Header';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from '../../locales/i18n';
import { ModerationMenu } from '../../components/ModerationMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'ОР';
};

const AVATAR_GRADIENTS: [string, string][] = [
  ['#10B981', '#059669'],
  ['#3B82F6', '#1D4ED8'],
  ['#8B5CF6', '#6D28D9'],
  ['#F59E0B', '#D97706'],
  ['#EF4444', '#B91C1C'],
  ['#06B6D4', '#0E7490'],
];

const getGradient = (name: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

// ─── Component ────────────────────────────────────────────────────────────────

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
    if (!phone) { toast.info(t('organizerprofile.s_3')); return; }
    Linking.openURL(`tel:${phone}`);
  };

  const sendEmail = () => {
    const email = organizer?.contact_email || organizer?.email;
    if (!email) { toast.info(t('organizerprofile.s_5')); return; }
    Linking.openURL(`mailto:${email}`);
  };

  const openTelegram = async () => {
    if (!organizer?.contact_telegram) { toast.info(t('organizerprofile.s_7')); return; }
    const username = organizer.contact_telegram.replace('@', '');
    const url = `https://t.me/${username}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
    else toast.error(t('organizerprofile.s_9'));
  };

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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('organizerprofile.s_11')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = organizer.full_name || organizer.username;
  const photoUrl = normalizeImageUrl(organizer.portfolio?.portfolio_photo_url);
  const hasPhoto = Boolean(photoUrl);
  const hasContacts = Boolean(
    organizer.contact_phone || organizer.phone_number ||
    organizer.contact_email || organizer.email ||
    organizer.contact_telegram
  );
  const hasProfile = Boolean(
    organizer.portfolio?.bio ||
    organizer.portfolio?.age ||
    organizer.portfolio?.work_experience_years ||
    organizer.organization_name ||
    hasContacts
  );
  const gradient = getGradient(displayName);
  const initials = getInitials(displayName);

  return (
    <View style={styles.container}>
      <Header
        title={t('organizerprofile.s_12')}
        showBack
        rightElement={
          <ModerationMenu
            targetUserId={organizerId}
            targetName={displayName}
            contentType="user_profile"
          />
        }
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* ── HERO: Случай 2 — есть фото ──────────────────────── */}
        {hasPhoto ? (
          <View style={styles.heroContainer}>
            <Image source={{ uri: photoUrl! }} style={styles.heroImage} resizeMode="cover" />
            {/* Градиент снизу */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              style={styles.heroGradient}
            />
            {/* Имя + орг поверх фото */}
            <View style={styles.heroOverlay}>
              {hasContacts && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={styles.verifiedText}>Верифицирован</Text>
                </View>
              )}
              <Text style={styles.heroName}>{displayName}</Text>
              {organizer.organization_name && (
                <View style={styles.heroOrgRow}>
                  <Ionicons name="business-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.heroOrg}>{organizer.organization_name}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* ── HERO: Случай 1 — нет фото, градиент + инициалы ── */
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroContainer}
          >
            {/* Декоративные круги */}
            <View style={[styles.decorCircle, styles.decorCircle1]} />
            <View style={[styles.decorCircle, styles.decorCircle2]} />

            <View style={styles.heroOverlay}>
              <View style={styles.initialsCircle}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
              <Text style={styles.heroName}>{displayName}</Text>
              {organizer.organization_name ? (
                <View style={styles.heroOrgRow}>
                  <Ionicons name="business-outline" size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.heroOrg}>{organizer.organization_name}</Text>
                </View>
              ) : null}
              {!hasProfile && (
                <View style={styles.emptyBadge}>
                  <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.emptyBadgeText}>Профиль не заполнен</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        )}

        {/* ── КОНТЕНТ ──────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Имя (только если нет фото — тогда имя уже в hero) */}
          {!hasPhoto && hasProfile && (
            <View style={styles.nameSection}>
              <Text style={styles.organizerName}>{displayName}</Text>
              {organizer.organization_name && (
                <Text style={styles.organizationName}>{organizer.organization_name}</Text>
              )}
            </View>
          )}

          {/* Статистика-карточки */}
          {organizer.projects_count !== undefined && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{organizer.projects_count}</Text>
                <Text style={styles.statLabel}>{t('organizerprofile.s_22')}</Text>
              </View>
              {organizer.portfolio?.work_experience_years ? (
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{organizer.portfolio.work_experience_years}</Text>
                  <Text style={styles.statLabel}>лет опыта</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Инфо-блок */}
          {(organizer.portfolio?.age || organizer.portfolio?.gender_display) && (
            <View style={styles.infoCard}>
              {organizer.portfolio?.age && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="calendar-outline" size={18} color={appColors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>{t('organizerprofile.s_13')}</Text>
                    <Text style={styles.infoValue}>
                      {organizer.portfolio.age}{' '}
                      {organizer.portfolio.age === 1
                        ? t('organizerprofile.s_14')
                        : organizer.portfolio.age < 5
                        ? t('organizerprofile.s_15')
                        : t('organizerprofile.s_16')}
                    </Text>
                  </View>
                </View>
              )}
              {organizer.portfolio?.gender_display && (
                <View style={styles.infoRow}>
                  <View style={styles.infoIconWrap}>
                    <Ionicons name="person-outline" size={18} color={appColors.primary} />
                  </View>
                  <View>
                    <Text style={styles.infoLabel}>{t('organizerprofile.s_17')}</Text>
                    <Text style={styles.infoValue}>{organizer.portfolio.gender_display}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* О себе */}
          {organizer.portfolio?.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('organizerprofile.s_23')}</Text>
              <View style={styles.bioCard}>
                <Text style={styles.bioText}>{organizer.portfolio.bio}</Text>
              </View>
            </View>
          )}

          {/* Контакты */}
          {hasContacts && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('organizerprofile.s_24')}</Text>
              <View style={styles.contactsRow}>
                {(organizer.contact_phone || organizer.phone_number) && (
                  <TouchableOpacity style={styles.contactBtn} onPress={callPhone}>
                    <View style={[styles.contactIconWrap, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="call-outline" size={20} color={appColors.primary} />
                    </View>
                    <Text style={styles.contactLabel}>Позвонить</Text>
                  </TouchableOpacity>
                )}
                {(organizer.contact_email || organizer.email) && (
                  <TouchableOpacity style={styles.contactBtn} onPress={sendEmail}>
                    <View style={[styles.contactIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="mail-outline" size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.contactLabel}>Email</Text>
                  </TouchableOpacity>
                )}
                {organizer.contact_telegram && (
                  <TouchableOpacity style={styles.contactBtn} onPress={openTelegram}>
                    <View style={[styles.contactIconWrap, { backgroundColor: '#E0F2FE' }]}>
                      <Ionicons name="send-outline" size={20} color="#0088CC" />
                    </View>
                    <Text style={styles.contactLabel}>Telegram</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const HERO_HEIGHT = 240;

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
    textAlign: 'center',
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
  scrollView: { flex: 1 },

  // ── Hero ────────────────────────────────────────────────
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.65,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'flex-start',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroOrgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroOrg: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  // Декоративные круги для плейсхолдера
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle1: {
    width: 180,
    height: 180,
    top: -50,
    right: -40,
  },
  decorCircle2: {
    width: 120,
    height: 120,
    bottom: -20,
    left: -30,
  },
  initialsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  initialsText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  emptyBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },

  // ── Контент ─────────────────────────────────────────────
  content: {
    padding: 20,
    backgroundColor: appColors.background,
    flex: 1,
  },
  nameSection: {
    marginBottom: 16,
  },
  organizerName: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 15,
    color: appColors.primary,
    fontWeight: '600',
  },
  // Статистика
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: appColors.textMuted,
    textAlign: 'center',
  },
  // Инфо-блок
  infoCard: {
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: appColors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: appColors.text,
    fontWeight: '600',
  },
  // Секции
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 12,
  },
  bioCard: {
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bioText: {
    fontSize: 14,
    color: appColors.textSecondary,
    lineHeight: 22,
  },
  // Контакты
  contactsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  contactBtn: {
    alignItems: 'center',
    gap: 8,
  },
  contactIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  contactLabel: {
    fontSize: 12,
    color: appColors.textMuted,
    fontWeight: '500',
  },
});
