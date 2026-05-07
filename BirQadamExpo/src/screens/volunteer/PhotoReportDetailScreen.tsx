import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { volunteerAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { PhotoReport, Task } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

type RootStackParamList = {
  PhotoReportDetail: { taskId: number };
};

type RouteProps = RouteProp<RootStackParamList, 'PhotoReportDetail'>;
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const formatDate = (value: string | null | undefined, t: (key: string) => string) => {
  if (!value) {
    return t('photoreportdetail.s_0');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t('photoreportdetail.s_1');
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getInitials = (value?: string | null) => {
  if (!value) {
    return '?';
  }

  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

const getStatusConfig = (
  status: PhotoReport['status'] | undefined,
  t: (key: string) => string
) => {
  switch (status) {
    case 'approved':
      return {
        label: t('photoreportdetail.s_2'),
        color: '#047857',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'rejected':
      return {
        label: t('photoreportdetail.s_3'),
        color: '#D97706',
        backgroundColor: appColors.warningSurface,
      };
    default:
      return {
        label: t('photoreportdetail.s_4'),
        color: appColors.primaryDark,
        backgroundColor: appColors.primarySurfaceStrong,
      };
  }
};

const getPointsWord = (value: number, t: (key: string) => string) => {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return t('photoreportdetail.s_5');
  }

  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) {
    return t('photoreportdetail.s_6');
  }

  return t('photoreportdetail.s_7');
};

const getFallbackFeedback = (report: PhotoReport, t: (key: string) => string) => {
  if (report.status === 'approved') {
    return t('photoreportdetail.s_8');
  }

  if (report.status === 'rejected') {
    return report.rejection_reason || t('photoreportdetail.s_9');
  }

  return t('photoreportdetail.s_10');
};

const renderStars = (rating: number) => {
  const stars = [];

  for (let index = 1; index <= 5; index += 1) {
    stars.push(
      <Ionicons
        key={index}
        name={index <= rating ? 'star' : 'star-outline'}
        size={16}
        color={appColors.primary}
        style={{ marginLeft: index === 1 ? 0 : 2 }}
      />
    );
  }

  return <View style={styles.starsRow}>{stars}</View>;
};

export const PhotoReportDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { taskId } = route.params;
  const user = useAuthStore((state) => state.user);
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isNarrow = width < 360;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [reports, setReports] = useState<PhotoReport[]>([]);
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const latestReport = useMemo(() => reports[selectedImageIndex] ?? null, [reports, selectedImageIndex]);
  const statusConfig = getStatusConfig(latestReport?.status, t);

  const volunteerName = user?.full_name || user?.username || t('photoreportdetail.s_11');
  const volunteerAvatar = normalizeImageUrl(user?.avatar);
  const heroImageUrl = normalizeImageUrl(latestReport?.image_url || latestReport?.image);
  const feedbackSource = task?.creator_name || latestReport?.project_title || t('photoreportdetail.s_12');
  const ratingValue = Math.max(0, Math.min(5, latestReport?.rating ?? 0));
  const pointsValue = latestReport?.rating || task?.reward_points || 0;
  const submittedLabel = formatDate(latestReport?.uploaded_at || task?.photo_uploaded_at, t);
  const heroHeight = Math.max(220, Math.min(300, width - (isNarrow ? 24 : 32)));

  const loadReportDetails = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResponse, reportsResponse] = await Promise.all([
        volunteerAPI.getTaskDetail(taskId),
        volunteerAPI.getTaskPhotoReports(taskId),
      ]);

      const taskData = taskResponse.data as Task;
      const reportsData = Array.isArray(reportsResponse.data?.photos) ? reportsResponse.data.photos : [];

      setTask(taskData);
      setReports(reportsData);

      if (!reportsData.length) {
        Alert.alert(t('photoreportdetail.s_13'), t('photoreportdetail.s_14'), [
          {
            text: t('photoreportdetail.s_15'),
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('photoreportdetail.s_16'));

      Alert.alert(t('photoreportdetail.s_17'), errorMessage, [
        {
          text: t('photoreportdetail.s_18'),
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [navigation, taskId]);

  useFocusEffect(
    useCallback(() => {
      loadReportDetails();
    }, [loadReportDetails])
  );

  const handleShare = useCallback(async () => {
    if (!latestReport) {
      return;
    }

    const statusLabel = getStatusConfig(latestReport.status, t).label;
    const shareMessage = [
      t('photoreportdetail.s_19'),
      task?.title ? t('photoreportdetail.s_29', { title: task.title }) : null,
      t('photoreportdetail.s_30', { status: statusLabel }),
      t('photoreportdetail.s_31', { date: submittedLabel }),
      latestReport.volunteer_comment
        ? t('photoreportdetail.s_32', { comment: latestReport.volunteer_comment })
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        title: t('photoreportdetail.s_20'),
        message: shareMessage,
      });
    } catch {
      Alert.alert(t('photoreportdetail.s_21'), t('photoreportdetail.s_22'));
    }
  }, [latestReport, submittedLabel, task?.title, t]);

  const openImagePreview = useCallback(() => {
    if (!heroImageUrl) {
      return;
    }

    setIsImagePreviewVisible(true);
  }, [heroImageUrl]);

  const closeImagePreview = useCallback(() => {
    setIsImagePreviewVisible(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  if (!latestReport) {
    return (
      <View style={styles.center}>
        <Ionicons name="document-text-outline" size={48} color={appColors.textSoft} />
        <Text style={styles.emptyTitle}>{t('photoreportdetail.s_23')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={appColors.surface === appColors.white ? 'dark-content' : 'light-content'}
        backgroundColor={appColors.surface}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={appColors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isCompact && styles.headerTitleCompact]}>{t('photoreportdetail.s_24')}</Text>

        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color={appColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroContainer, isNarrow && styles.heroContainerNarrow]}>
          {heroImageUrl ? (
            <TouchableOpacity activeOpacity={0.95} onPress={openImagePreview}>
              <Image
                source={{ uri: heroImageUrl }}
                style={[styles.heroImage, { height: heroHeight }, isCompact && styles.heroImageCompact]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <View style={[styles.heroImage, { height: heroHeight }, styles.heroPlaceholder, isCompact && styles.heroImageCompact]}>
              <Ionicons name="image-outline" size={42} color={appColors.textSoft} />
            </View>
          )}

          {pointsValue > 0 && latestReport.status === 'approved' && (
            <View style={[styles.pointsBadge, isCompact && styles.pointsBadgeCompact]}>
              <Ionicons name="flash" size={14} color={appColors.white} />
              <Text style={[styles.pointsText, isCompact && styles.pointsTextCompact]}>{`+${pointsValue} ${getPointsWord(pointsValue, t)}`}</Text>
            </View>
          )}
        </View>

        {reports.length > 1 && (
          <View style={styles.thumbnailScrollContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailScrollContent}>
              {reports.map((r, idx) => {
                const imgUrl = normalizeImageUrl(r.image_url || r.image);
                const isSelected = idx === selectedImageIndex;
                return (
                  <TouchableOpacity 
                    key={r.id || idx} 
                    onPress={() => setSelectedImageIndex(idx)} 
                    style={[styles.thumbnailWrapper, isSelected && styles.thumbnailSelected]}
                    activeOpacity={0.8}
                  >
                    {imgUrl ? (
                      <Image source={{ uri: imgUrl }} style={styles.thumbnailImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbnailImage} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={[styles.contentCard, isCompact && styles.contentCardCompact, isNarrow && styles.contentCardNarrow]}>
          <View style={[styles.userRow, isCompact && styles.userRowCompact]}>
            <View style={[styles.userInfoRow, isCompact && styles.userInfoRowCompact]}>
              {volunteerAvatar ? (
                <Image source={{ uri: volunteerAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{getInitials(volunteerName)}</Text>
                </View>
              )}

              <View style={styles.userMeta}>
                <Text style={[styles.userName, isCompact && styles.userNameCompact]}>{volunteerName}</Text>
                <Text style={styles.userDate}>{t('photoreportdetail.s_25')}{submittedLabel}</Text>
              </View>
            </View>

            <View style={[styles.statusBadge, isCompact && styles.statusBadgeCompact, { backgroundColor: statusConfig.backgroundColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('photoreportdetail.s_26')}</Text>
          <Text style={[styles.sectionText, isCompact && styles.sectionTextCompact]}>
            {latestReport.volunteer_comment?.trim() || t('photoreportdetail.s_27')}
          </Text>

          <View style={[styles.feedbackCard, isCompact && styles.feedbackCardCompact]}>
            <View style={[styles.feedbackHeader, isCompact && styles.feedbackHeaderCompact]}>
              <Text style={[styles.feedbackTitle, isCompact && styles.feedbackTitleCompact]}>{t('photoreportdetail.s_28')}</Text>
              {latestReport.status === 'approved' && ratingValue > 0 ? (
                renderStars(ratingValue)
              ) : (
                <View style={[styles.feedbackStatusBadge, isCompact && styles.feedbackStatusBadgeCompact, { backgroundColor: statusConfig.backgroundColor }]}>
                  <Text style={[styles.feedbackStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
              )}
            </View>

            <View style={styles.feedbackSourceRow}>
              <View style={styles.feedbackSourceIcon}>
                <Ionicons name="business-outline" size={16} color={appColors.textMuted} />
              </View>
              <Text style={styles.feedbackSourceText}>{feedbackSource}</Text>
            </View>

            <Text style={[styles.feedbackText, isCompact && styles.feedbackTextCompact]}>
              {latestReport.organizer_comment?.trim() || getFallbackFeedback(latestReport, t)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isImagePreviewVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeImagePreview}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.imagePreviewCloseButton}
            onPress={closeImagePreview}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={26} color={appColors.white} />
          </TouchableOpacity>

          {reports.length > 1 && (
            <View style={{ position: 'absolute', top: 66, left: 0, right: 0, alignItems: 'center', zIndex: 2 }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  {selectedImageIndex + 1} / {reports.length}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.imagePreviewBackdrop, { paddingHorizontal: 0, paddingVertical: 0 }]}>
            {reports.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: selectedImageIndex * width, y: 0 }}
                onMomentumScrollEnd={(e) => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                  if (newIndex >= 0 && newIndex < reports.length && newIndex !== selectedImageIndex) {
                    setSelectedImageIndex(newIndex);
                  }
                }}
                style={{ width, height: '100%' }}
              >
                {reports.map((r, idx) => {
                  const URI = normalizeImageUrl(r.image_url || r.image);
                  return (
                    <TouchableOpacity
                      key={r.id || idx}
                      activeOpacity={1}
                      onPress={closeImagePreview}
                      style={{ width, height: '100%', justifyContent: 'center', alignItems: 'center' }}
                    >
                      {URI ? (
                        <Image
                          source={{ uri: URI }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="contain"
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: appColors.text,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  headerTitleCompact: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    position: 'relative',
  },
  heroContainerNarrow: {
    marginHorizontal: 12,
  },
  heroImage: {
    width: '100%',
    height: 270,
    borderRadius: 28,
    backgroundColor: appColors.surfaceMuted,
  },
  heroImageCompact: {
    borderRadius: 24,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailScrollContainer: {
    marginTop: 16,
  },
  thumbnailScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderColor: appColors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: appColors.surfaceMuted,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 78, 59, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  imagePreviewBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  imagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  pointsBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pointsBadgeCompact: {
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
  },
  pointsTextCompact: {
    fontSize: 12,
  },
  contentCard: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: appColors.surface,
    borderRadius: 28,
  },
  contentCardCompact: {
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  contentCardNarrow: {
    marginHorizontal: 12,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  userRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfoRowCompact: {
    width: '100%',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.textSoft,
  },
  userMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 19,
    fontWeight: '700',
    color: appColors.text,
    flexShrink: 1,
  },
  userNameCompact: {
    fontSize: 17,
  },
  userDate: {
    marginTop: 4,
    fontSize: 13,
    color: appColors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeCompact: {
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: appColors.textSoft,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 17,
    lineHeight: 30,
    color: appColors.textSecondary,
  },
  sectionTextCompact: {
    fontSize: 16,
    lineHeight: 28,
  },
  feedbackCard: {
    marginTop: 28,
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: appColors.surface,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  feedbackCardCompact: {
    marginTop: 24,
    padding: 16,
    borderRadius: 22,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  feedbackHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  feedbackTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: appColors.text,
  },
  feedbackTitleCompact: {
    flex: 0,
    width: '100%',
    fontSize: 17,
    lineHeight: 24,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  feedbackStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  feedbackStatusBadgeCompact: {
    alignSelf: 'flex-start',
  },
  feedbackStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  feedbackSourceIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: appColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  feedbackSourceText: {
    fontSize: 14,
    fontWeight: '600',
    color: appColors.textMuted,
    flex: 1,
    flexWrap: 'wrap',
  },
  feedbackText: {
    fontSize: 16,
    lineHeight: 29,
    color: appColors.textSoft,
  },
  feedbackTextCompact: {
    fontSize: 15,
    lineHeight: 27,
  },
});
