import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { volunteerAPI } from '../../services/api';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { appColors } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import { hapticLight } from '../../utils/haptics';
import { EmptyState } from '../../components/EmptyState';
import type { Notification, Project, Task } from '../../types';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getVolunteerNotificationPreferences,
  setVolunteerNotificationPreferences,
  syncVolunteerLocalNotifications,
  type VolunteerNotificationPreferences,
} from '../../utils/volunteerNotifications';
import { useTranslation } from "../../locales/i18n";

interface VolunteerNotificationsScreenProps {
  navigation: any;
}

type NotificationPreferenceKey = keyof VolunteerNotificationPreferences;

const getPreferenceItems = (t: (key: string) => string): Array<{
  key: NotificationPreferenceKey;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  implemented: boolean;
}> => [
  {
    key: 'tasks',
    title: t('notifications.s_0'),
    description: t('notifications.s_1'),
    icon: 'clipboard-outline',
    implemented: true,
  },
  {
    key: 'deadlines',
    title: t('notifications.s_2'),
    description: t('notifications.s_3'),
    icon: 'time-outline',
    implemented: true,
  },
  {
    key: 'photoReports',
    title: t('notifications.s_4'),
    description: t('notifications.s_5'),
    icon: 'camera-outline',
    implemented: true,
  },
  {
    key: 'chats',
    title: t('notifications.s_6'),
    description: t('notifications.s_7'),
    icon: 'chatbubble-ellipses-outline',
    implemented: false,
  },
  {
    key: 'projects',
    title: t('notifications.s_8'),
    description: t('notifications.s_9'),
    icon: 'folder-open-outline',
    implemented: true,
  },
];

function stripEmojis(value: string | undefined | null): string {
  if (!value) {
    return '';
  }

  return value
    .replace(
      /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
      ''
    )
    .trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isUnread(notification: Notification): boolean {
  return notification.status === 'pending' || notification.status === 'sent';
}

function normalizeProjectsPayload(payload: any): Project[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload?.projects) ? payload.projects : [];
}

function normalizeTasksPayload(payload: any, t: (key: string) => string): Task[] {
  const tasksData = Array.isArray(payload) ? payload : payload?.tasks || [];

  return tasksData.map((item: any) => ({
    id: item.id,
    title: item.title || item.text || t('notifications.s_10'),
    description: item.description || item.text || '',
    project_id: item.project_id,
    project_title: item.project_title,
    location: item.location || item.project_city || item.city || t('notifications.s_11'),
    start_date: item.start_date || item.deadline_date || item.created_at || new Date().toISOString(),
    end_date: item.end_date || item.deadline_date || item.created_at || new Date().toISOString(),
    status: item.status || 'open',
    assigned_users_count: item.accepted ? 1 : 0,
    reward_points: item.reward_points,
    image: item.image || item.task_image || item.task_image_url || item.project_cover_image_url,
    task_image_url: item.task_image_url ?? null,
    project_cover_image_url: item.project_cover_image_url ?? null,
    start_time: item.start_time,
    end_time: item.end_time,
    creator_name: item.creator_name,
    creator_avatar: item.creator_avatar,
    accepted: Boolean(item.accepted),
    accepted_at: item.accepted_at,
    photo_uploaded_at: item.photo_uploaded_at,
    photo_moderated_at: item.photo_moderated_at,
    created_at: item.created_at,
    rating: item.rating,
    has_photo_report: Boolean(item.has_photo_report),
    completed: Boolean(item.completed),
    is_expired: Boolean(item.is_expired),
    can_upload_photo: Boolean(item.can_upload_photo),
    photo_status: item.photo_status ?? null,
    rejection_reason: item.rejection_reason ?? null,
  }));
}

export const VolunteerNotificationsScreen: React.FC<VolunteerNotificationsScreenProps> = ({
  navigation,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const isDarkTheme = useThemeStore((state) => state.isDarkTheme);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [preferences, setPreferences] = useState<VolunteerNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const preferenceItems = useMemo(() => getPreferenceItems(t), [t]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await volunteerAPI.getNotifications();
      const data = response.data?.notifications || response.data || [];
      const list = Array.isArray(data) ? data : [];

      setNotifications(
        list.map((item) => ({
          ...item,
          subject: stripEmojis(item.subject || item.title),
          message: stripEmojis(item.message),
        }))
      );
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedPreferences = await getVolunteerNotificationPreferences();
        setPreferences(savedPreferences);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const unreadCount = useMemo(() => notifications.filter(isUnread).length, [notifications]);

  const filteredNotifications = useMemo(
    () => notifications.filter((notification) => (filter === 'all' ? true : isUnread(notification))),
    [filter, notifications]
  );

  const handlePreferenceToggle = useCallback(
    async (key: NotificationPreferenceKey, value: boolean) => {
      const nextPreferences = { ...preferences, [key]: value };
      setPreferences(nextPreferences);
      setIsSavingPreferences(true);

      try {
        await setVolunteerNotificationPreferences(nextPreferences);

        const selectedPreference = preferenceItems.find((item) => item.key === key);
        if (selectedPreference?.implemented) {
          const [tasksResponse, projectsResponse] = await Promise.all([
            volunteerAPI.getTasks(),
            volunteerAPI.getProjects(),
          ]);

          await syncVolunteerLocalNotifications(
            normalizeTasksPayload(tasksResponse.data, t),
            normalizeProjectsPayload(projectsResponse.data)
          );
        } else {
          toast.warning(t('notifications.s_13'));
        }
      } catch (error: unknown) {
        setPreferences(preferences);
        toast.error(getAxiosErrorMessage(error, t('notifications.s_15')));
      } finally {
        setIsSavingPreferences(false);
      }
    },
    [preferences]
  );

  const handleNotificationPress = async (notification: Notification) => {
    if (isUnread(notification)) {
      try {
        await volunteerAPI.markNotificationRead(notification.id, notification.activity_id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, status: 'opened' as const } : item))
        );
      } catch (error: unknown) {
        if (getAxiosErrorResponse(error)?.status !== 404) {
          console.error('Error marking notification as read:', error);
        }
      }
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      await volunteerAPI.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, status: 'opened' as const })));
      setTimeout(loadNotifications, 500);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getStatusColor = (notification: Notification) => {
    const type = notification.notification_type || '';
    if (type === 'task_assigned') return appColors.primary;
    if (type === 'project_update') return appColors.primary;
    if (type === 'joined_project') return appColors.primary;
    if (isUnread(notification)) return appColors.primary;
    return appColors.textMuted;
  };

  const getIconName = (notification: Notification): keyof typeof Ionicons.glyphMap => {
    const type = notification.notification_type || '';
    const message = (notification.message || '').toLowerCase();
    const subject = (notification.subject || '').toLowerCase();

    if (type === 'task_assigned' || subject.includes(t('notifications.s_16'))) return 'clipboard-outline';
    if (type === 'project_update' || subject.includes(t('notifications.s_17'))) return 'business-outline';
    if (message.includes(t('notifications.s_18')) || subject.includes(t('notifications.s_19'))) return 'exit-outline';
    if (message.includes(t('notifications.s_20')) || subject.includes(t('notifications.s_21'))) return 'person-add-outline';
    if (message.includes(t('notifications.s_22')) || subject.includes(t('notifications.s_23'))) return 'add-circle-outline';

    return 'notifications-outline';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDarkTheme ? 'light-content' : 'dark-content'} backgroundColor={appColors.background} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color={appColors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{t('notifications.s_24')}</Text>
            {unreadCount > 0 ? <Text style={styles.headerSub}>{unreadCount} {t('notifications.s_25')}</Text> : null}
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setIsSettingsVisible(true)} style={styles.headerIconBtn}>
            <Ionicons name="settings-outline" size={20} color={appColors.primary} />
          </TouchableOpacity>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerIconBtn}>
              <Ionicons name="checkmark-done" size={20} color={appColors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>{t('notifications.s_26')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'unread' && styles.filterBtnActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterBtnText, filter === 'unread' && styles.filterBtnTextActive]}>
            {t('notifications.s_27')}</Text>
          {unreadCount > 0 ? (
            <View
              style={[
                styles.filterBadge,
                filter === 'unread' ? styles.filterBadgeActive : styles.filterBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filter === 'unread' ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive,
                ]}
              >
                {unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={appColors.primary} colors={[appColors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title={t('notifications.s_28')}
            description={filter === 'unread' ? t('notifications.s_29') : t('notifications.s_30')}
          />
        ) : (
          filteredNotifications.map((item) => {
            const unread = isUnread(item);
            const color = getStatusColor(item);

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, unread && styles.cardUnread]}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.8}
              >
                {unread ? <View style={styles.unreadBar} /> : null}

                <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                  <Ionicons name={getIconName(item)} size={22} color={color} />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.cardSubject} numberOfLines={2}>
                    {item.subject || t('notifications.s_31')}
                  </Text>
                  <Text style={styles.cardMessage} numberOfLines={3}>
                    {item.message}
                  </Text>
                  <View style={styles.cardFooter}>
                    {item.project_title ? (
                      <Text style={styles.projectText} numberOfLines={1}>
                        {stripEmojis(item.project_title)}
                      </Text>
                    ) : (
                      <View />
                    )}
                    <Text style={styles.cardTime}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>

                {unread ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={isSettingsVisible} transparent={true} animationType="fade" onRequestClose={() => setIsSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="settings-outline" size={20} color={appColors.primary} />
                </View>
                <View style={styles.modalTitleTextWrap}>
                  <Text style={styles.modalTitle}>{t('notifications.s_32')}</Text>
                  <Text style={styles.modalSubtitle}>{t('notifications.s_33')}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  hapticLight();
                  setIsSettingsVisible(false);
                }}
              >
                <Ionicons name="close" size={22} color={appColors.textMuted} />
              </TouchableOpacity>
            </View>

            {preferenceItems.map((item, index) => (
              <View
                key={item.key}
                style={[styles.settingsRow, index === preferenceItems.length - 1 && styles.settingsRowLast]}
              >
                <View style={styles.settingsRowLeft}>
                  <View style={styles.settingsRowIcon}>
                    <Ionicons name={item.icon} size={18} color={appColors.primary} />
                  </View>
                  <View style={styles.settingsRowText}>
                    <Text style={styles.settingsRowTitle}>{item.title}</Text>
                    <Text style={styles.settingsRowDescription}>{item.description}</Text>
                  </View>
                </View>

                <Switch
                  value={preferences[item.key]}
                  onValueChange={(value) => void handlePreferenceToggle(item.key, value)}
                  disabled={isSavingPreferences}
                  trackColor={{ false: appColors.borderSoft, true: appColors.primary }}
                  thumbColor={appColors.white}
                />
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 2,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: appColors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: appColors.primary,
    fontWeight: '600',
    marginTop: -2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: appColors.primarySurface,
  },
  filterBtnActive: {
    backgroundColor: appColors.primary,
  },
  filterBtnText: {
    fontSize: 14,
    color: appColors.primary,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: appColors.white,
  },
  filterBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  filterBadgeActive: {
    backgroundColor: appColors.surface,
  },
  filterBadgeInactive: {
    backgroundColor: appColors.primary,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  filterBadgeTextActive: {
    color: appColors.primary,
  },
  filterBadgeTextInactive: {
    color: appColors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: appColors.primarySurface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: appColors.primary,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 13,
    color: appColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectText: {
    fontSize: 11,
    color: appColors.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 11,
    color: appColors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: appColors.primary,
    marginLeft: 6,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: appColors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 12,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: appColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalTitleTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 3,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: appColors.textMuted,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: appColors.borderSoft,
  },
  settingsRowLast: {
    paddingBottom: 8,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  settingsRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: appColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settingsRowText: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 2,
  },
  settingsRowDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: appColors.textMuted,
  },
});
