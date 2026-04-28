import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import type { CalendarEvent } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import {
  disableCalendarReminder,
  enableCalendarReminder,
  getCalendarReminderEligibility,
  hasCalendarReminder,
} from '../../utils/calendarReminders';
import { appColors } from '../../theme';

type RootStackParamList = {
  CalendarEventDetail: { event: CalendarEvent };
};

type CalendarEventDetailRoute = RouteProp<RootStackParamList, 'CalendarEventDetail'>;

const getEventTypeConfig = (type: string) => {
  switch (type) {
    case 'project_start':
      return {
        label: 'Старт проекта',
        icon: 'leaf-outline' as const,
        color: '#16A34A',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'project_end':
      return {
        label: 'Завершение проекта',
        icon: 'flag-outline' as const,
        color: '#2563EB',
        backgroundColor: '#DBEAFE',
      };
    default:
      return {
        label: 'Задача',
        icon: 'document-text-outline' as const,
        color: '#BE123C',
        backgroundColor: '#FFE4E6',
      };
  }
};

const getStatusConfig = (status?: string | null) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Завершено',
        color: '#15803D',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'approved':
      return {
        label: 'Одобрено',
        color: '#047857',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'under_review':
      return {
        label: 'На проверке',
        color: '#047857',
        backgroundColor: appColors.primarySurfaceStrong,
      };
    case 'revision':
      return {
        label: 'На доработке',
        color: '#2563EB',
        backgroundColor: '#DBEAFE',
      };
    case 'rejected':
      return {
        label: 'Отклонено',
        color: '#BE123C',
        backgroundColor: '#FFE4E6',
      };
    case 'in_progress':
      return {
        label: 'В работе',
        color: appColors.primary,
        backgroundColor: appColors.surfaceMuted,
      };
    case 'archived':
      return {
        label: 'В архиве',
        color: appColors.textMuted,
        backgroundColor: appColors.surfaceMuted,
      };
    case 'open':
      return {
        label: 'Открыта',
        color: '#0F766E',
        backgroundColor: appColors.primarySurface,
      };
    default:
      return null;
  }
};

const formatLongDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
};

const formatTimeRange = (event: CalendarEvent) => {
  if (event.is_all_day) {
    return 'Весь день';
  }

  const start = event.start_time?.slice(0, 5);
  const end = event.end_time?.slice(0, 5);

  if (start && end) {
    return `${start}, до ${end}`;
  }

  if (start) {
    return start;
  }

  return 'Время уточняется';
};

const getLocation = (event: CalendarEvent) =>
  event.location || event.project_address || event.project_city || 'Локация уточняется';

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

const buildShareMessage = (event: CalendarEvent) => {
  return [
    event.title,
    event.subtitle || null,
    `Дата: ${formatLongDate(event.date)}`,
    `Время: ${formatTimeRange(event)}`,
    `Место: ${getLocation(event)}`,
    event.description || null,
  ]
    .filter(Boolean)
    .join('\n');
};

export const CalendarEventDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<CalendarEventDetailRoute>();
  const { event } = route.params;
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  const typeConfig = useMemo(() => getEventTypeConfig(event.type), [event.type]);
  const statusConfig = useMemo(() => getStatusConfig(event.status), [event.status]);
  const heroImage = useMemo(() => normalizeImageUrl(event.image), [event.image]);
  const hasHeroImage = Boolean(heroImage);
  const participantsPreview = event.participants_preview ?? [];
  const extraParticipants = Math.max(0, event.participants_count - participantsPreview.length);
  const reminderEligibility = useMemo(() => getCalendarReminderEligibility(event), [event]);
  const canShowReminder = reminderEligibility.allowed;
  const canShowMap = Boolean(
    event.project_gis2_url ||
      (event.project_latitude != null && event.project_longitude != null) ||
      event.project_address ||
      event.location
  );

  const syncReminderState = useCallback(async () => {
    try {
      if (!reminderEligibility.allowed) {
        await disableCalendarReminder(event.id);
        setReminderEnabled(false);
        return;
      }

      const enabled = await hasCalendarReminder(event.id);
      setReminderEnabled(enabled);
    } catch {
      setReminderEnabled(false);
    }
  }, [event.id, reminderEligibility.allowed]);

  useFocusEffect(
    useCallback(() => {
      syncReminderState();
    }, [syncReminderState])
  );

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: event.title,
        message: buildShareMessage(event),
      });
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть меню отправки.');
    }
  }, [event]);

  const handleOpenMap = useCallback(() => {
    const { project_gis2_url, project_latitude, project_longitude, project_address, location } = event;

    const targetAddress = project_address || location;
    const coordinatesAvailable = project_latitude != null && project_longitude != null;

    if (project_gis2_url) {
      void Linking.openURL(project_gis2_url);
      return;
    }

    if (coordinatesAvailable) {
      void Linking.openURL(`https://www.google.com/maps?q=${project_latitude},${project_longitude}`);
      return;
    }

    if (targetAddress) {
      const encodedAddress = encodeURIComponent(targetAddress);
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      return;
    }

    Alert.alert('Внимание', 'Для этого события пока не указана карта.');
  }, [event]);

  const handleToggleReminder = useCallback(async () => {
    setReminderLoading(true);
    try {
      if (reminderEnabled) {
        await disableCalendarReminder(event.id);
        setReminderEnabled(false);
      } else {
        await enableCalendarReminder(event, 30);
        setReminderEnabled(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обновить напоминание.';
      Alert.alert('Напоминание', message);
    } finally {
      setReminderLoading(false);
    }
  }, [event, reminderEnabled]);

  const openProject = useCallback(() => {
    if (!event.project_id) {
      return;
    }
    navigation.navigate('VolunteerProjectDetail', { projectId: event.project_id });
  }, [event.project_id, navigation]);

  const openTask = useCallback(() => {
    if (!event.task_id) {
      return;
    }
    navigation.navigate('VolunteerTaskDetail', { taskId: event.task_id });
  }, [event.task_id, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle={appColors.surface === appColors.white ? 'dark-content' : 'light-content'}
        backgroundColor={appColors.surface}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color="#0A0A0A" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Детали события</Text>

          <TouchableOpacity style={styles.headerButton} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={22} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={heroImage ? 0.92 : 1} onPress={() => heroImage && setIsPreviewVisible(true)}>
          <View style={[styles.heroCard, { minHeight: Math.max(240, width * 0.72) }]}>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroFallback, { backgroundColor: typeConfig.backgroundColor }]}>
                <Ionicons name={typeConfig.icon} size={42} color={typeConfig.color} />
              </View>
            )}

            <View style={[styles.heroOverlay, !hasHeroImage && styles.heroOverlayPlain]}>
              <View style={[styles.heroBadge, { backgroundColor: typeConfig.backgroundColor }]}>
                <Ionicons name={typeConfig.icon} size={14} color={typeConfig.color} />
                <Text style={[styles.heroBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              </View>
              <Text
                style={[
                  styles.heroTitle,
                  !hasHeroImage && styles.heroTitlePlain,
                  isCompact && styles.heroTitleCompact,
                ]}
              >
                {event.title}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={[styles.metaIconWrap, { backgroundColor: appColors.primarySurfaceStrong }]}>
              <Ionicons name="calendar-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>Дата</Text>
              <Text style={styles.metaValue}>{formatLongDate(event.date)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaIconWrap, { backgroundColor: appColors.primarySurfaceStrong }]}>
              <Ionicons name="time-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.metaTextBlock}>
              <Text style={styles.metaLabel}>Время</Text>
              <Text style={styles.metaValue}>{formatTimeRange(event)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaIconWrap, { backgroundColor: appColors.primarySurfaceStrong }]}>
              <Ionicons name="location-outline" size={20} color="#16A34A" />
            </View>
            <View style={[styles.metaTextBlock, styles.metaTextBlockWide]}>
              <Text style={styles.metaLabel}>Локация</Text>
              <Text style={styles.metaValue}>{getLocation(event)}</Text>
            </View>

            {canShowMap ? (
              <TouchableOpacity style={styles.mapButton} onPress={handleOpenMap} activeOpacity={0.9}>
                <Text style={styles.mapButtonText}>Открыть карту</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {statusConfig ? (
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Статус</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Описание</Text>
          <Text style={styles.descriptionText}>
            {event.description || 'Организатор пока не добавил подробное описание для этого события.'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Участники</Text>

          {participantsPreview.length ? (
            <View style={styles.participantsRow}>
              <View style={styles.avatarsRow}>
                {participantsPreview.map((participant, index) => {
                  const avatar = normalizeImageUrl(participant.avatar);
                  return (
                    <View key={participant.id} style={[styles.avatarWrap, { marginLeft: index === 0 ? 0 : -12 }]}>
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.avatarImage} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <Text style={styles.avatarFallbackText}>{getInitials(participant.name)}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {extraParticipants > 0 ? (
                  <View style={[styles.avatarWrap, styles.extraAvatar, { marginLeft: -12 }]}>
                    <Text style={styles.extraAvatarText}>+{extraParticipants}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.participantsText}>{event.participants_count} участников присоединились</Text>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Список участников пока не заполнен.</Text>
          )}
        </View>

        {canShowReminder ? (
          <View style={styles.sectionCard}>
            <View style={styles.reminderRow}>
              <View style={styles.reminderTextBlock}>
                <Text style={styles.sectionTitle}>Напомнить за 30 минут</Text>
                <Text style={styles.placeholderText}>
                  {reminderEnabled
                    ? 'Локальное уведомление уже запланировано.'
                    : 'Напоминание доступно только для принятой будущей задачи.'}
                </Text>
              </View>

              <Switch
                value={reminderEnabled}
                onValueChange={handleToggleReminder}
                trackColor={{ false: appColors.textMuted, true: '#86EFAC' }}
                thumbColor={reminderLoading ? appColors.textSoft : reminderEnabled ? appColors.primary : appColors.white}
                disabled={reminderLoading}
              />
            </View>
          </View>
        ) : null}

        {event.project_id ? (
          <TouchableOpacity style={styles.relatedCard} onPress={openProject} activeOpacity={0.92}>
            <View style={[styles.relatedIconWrap, { backgroundColor: appColors.primarySurfaceStrong }]}>
              <Ionicons name="layers-outline" size={22} color="#16A34A" />
            </View>
            <View style={styles.relatedTextBlock}>
              <Text style={styles.relatedLabel}>Связанный проект</Text>
              <Text style={styles.relatedTitle}>{event.project_title || 'Открыть проект'}</Text>
              {event.project_city ? <Text style={styles.relatedSubtitle}>{event.project_city}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {event.task_id ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={openTask} activeOpacity={0.9}>
            <Ionicons name="open-outline" size={18} color={appColors.white} />
            <Text style={styles.secondaryButtonText}>Открыть задачу</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={isPreviewVisible} transparent animationType="fade" onRequestClose={() => setIsPreviewVisible(false)}>
        <View style={styles.previewBackdrop}>
          <TouchableOpacity style={styles.previewCloseButton} onPress={() => setIsPreviewVisible(false)} activeOpacity={0.85}>
            <Ionicons name="close" size={28} color={appColors.white} />
          </TouchableOpacity>

          {heroImage ? <Image source={{ uri: heroImage }} style={styles.previewImage} resizeMode="contain" /> : null}
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
  screen: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: appColors.text,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: appColors.surfaceSoft,
    marginBottom: 16,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  heroOverlayPlain: {
    backgroundColor: 'transparent',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  heroBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: appColors.white,
    lineHeight: 36,
  },
  heroTitlePlain: {
    color: appColors.text,
  },
  heroTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  metaCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  metaTextBlock: {
    flex: 1,
  },
  metaTextBlockWide: {
    marginRight: 12,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: appColors.textSoft,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    lineHeight: 22,
  },
  mapButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: appColors.primary,
  },
  mapButtonText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: appColors.textSoft,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: appColors.primarySurface,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySurfaceStrong,
  },
  avatarFallbackText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '800',
  },
  extraAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
  },
  extraAvatarText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  participantsText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: appColors.textSoft,
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 21,
    color: appColors.textMuted,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderTextBlock: {
    flex: 1,
    paddingRight: 16,
  },
  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 14,
  },
  relatedIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  relatedTextBlock: {
    flex: 1,
  },
  relatedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: appColors.textSoft,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  relatedTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: appColors.text,
  },
  relatedSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: appColors.textMuted,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 18,
    backgroundColor: appColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: appColors.white,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 8,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  previewImage: {
    width: '100%',
    height: '78%',
  },
});
