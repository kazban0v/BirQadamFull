import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appColors } from '../../theme';
import { volunteerAPI } from '../../services/api';
import { useTranslation } from '../../locales/i18n';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { useToast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import type { Task, PhotoReport } from '../../types';
import type { MainStackParamList } from '../../navigation/AppNavigator';

type ActivityEventType = 'task_completed' | 'photo_approved' | 'photo_rejected' | 'photo_pending';

interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  date: string;
  title: string;
  subtitle?: string;
  meta?: string;
  taskId?: number;
}

const EVENT_CONFIG: Record<ActivityEventType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  surface: string;
  label: (t: (k: string) => string) => string;
}> = {
  task_completed: {
    icon: 'checkmark-circle',
    color: appColors.primary,
    surface: appColors.primarySurface,
    label: (t) => t('activity.s_2'),
  },
  photo_approved: {
    icon: 'camera',
    color: appColors.primary,
    surface: appColors.primarySurface,
    label: (t) => t('activity.s_3'),
  },
  photo_rejected: {
    icon: 'close-circle',
    color: appColors.danger,
    surface: appColors.dangerSurface,
    label: (t) => t('activity.s_4'),
  },
  photo_pending: {
    icon: 'time-outline',
    color: appColors.warning,
    surface: appColors.warningSurface,
    label: (t) => t('activity.s_5'),
  },
};

const parseDate = (dateStr: string): Date => {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

const formatDateLabel = (dateStr: string, t: (k: string) => string): string => {
  const date = parseDate(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return t('activity.s_6');
  if (sameDay(date, yesterday)) return t('activity.s_7');

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

const formatMonthLabel = (dateStr: string): string => {
  const date = parseDate(dateStr);
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
};

const isSameMonth = (a: string, b: string): boolean => {
  const da = parseDate(a);
  const db = parseDate(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
};

const buildEvents = (tasks: Task[], photoReports: PhotoReport[]): ActivityEvent[] => {
  const events: ActivityEvent[] = [];

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'under_review') {
      const date = task.photo_moderated_at || task.photo_uploaded_at || task.end_date || task.created_at;
      if (!date) continue;
      events.push({
        id: `task-${task.id}`,
        type: 'task_completed',
        date,
        title: task.title,
        subtitle: task.project_title,
        meta: task.reward_points ? `+${task.reward_points} pts` : undefined,
        taskId: task.id,
      });
    }
  }

  for (const report of photoReports) {
    const date = report.moderated_at || report.uploaded_at || report.created_at;
    if (!date) continue;
    const type: ActivityEventType =
      report.status === 'approved' ? 'photo_approved' :
        report.status === 'rejected' ? 'photo_rejected' : 'photo_pending';

    events.push({
      id: `photo-${report.id}`,
      type,
      date,
      title: report.task_text || `Фотоотчёт #${report.id}`,
      subtitle: report.project_title,
      meta: report.rating ? `★ ${report.rating}` : undefined,
      taskId: report.task_id,
    });
  }

  return events.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
};

export const VolunteerActivityScreen: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Use refs to avoid unstable hook references in useCallback deps
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, photosRes] = await Promise.all([
        volunteerAPI.getTasks(),
        volunteerAPI.getPhotoReports(),
      ]);

      const rawTasks = tasksRes.data;
      const tasks: Task[] = Array.isArray(rawTasks)
        ? rawTasks
        : (rawTasks?.tasks ?? rawTasks?.results ?? []);

      const rawPhotos = photosRes.data;
      const photos: PhotoReport[] = Array.isArray(rawPhotos)
        ? rawPhotos
        : (rawPhotos?.photo_reports ?? rawPhotos?.photos ?? rawPhotos?.results ?? []);

      setEvents(buildEvents(tasks, photos));
    } catch (error) {
      toastRef.current.error(getAxiosErrorMessage(error, tRef.current('activity.s_8')));
    } finally {
      setLoading(false);
    }
  }, []); // пустые deps — loadData стабилен, refs обновляются автоматически

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={appColors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('activity.s_0')}</Text>
          <Text style={styles.headerSubtitle}>{t('activity.s_1')}</Text>
        </View>

        {events.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title={t('activity.s_9')}
            description={t('activity.s_10')}
            size="lg"
          />
        ) : (
          <View style={styles.timeline}>
            {events.map((event, index) => {
              const config = EVENT_CONFIG[event.type];
              const prevEvent = index > 0 ? events[index - 1] : null;
              const showMonthHeader = !prevEvent || !isSameMonth(event.date, prevEvent.date);
              const isLast = index === events.length - 1;

              return (
                <View key={event.id}>
                  {showMonthHeader && (
                    <Text style={styles.monthLabel}>
                      {formatMonthLabel(event.date).toUpperCase()}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.eventRow}
                    activeOpacity={event.taskId ? 0.7 : 1}
                    onPress={() => {
                      if (event.taskId) {
                        navigation.navigate('VolunteerTaskDetail', { taskId: event.taskId });
                      }
                    }}
                  >
                    {/* Timeline line + dot */}
                    <View style={styles.timelineLeft}>
                      <View style={[styles.dot, { backgroundColor: config.color }]}>
                        <Ionicons name={config.icon} size={14} color={appColors.white} />
                      </View>
                      {!isLast && <View style={styles.line} />}
                    </View>

                    {/* Card */}
                    <View style={[styles.card, { borderLeftColor: config.color }]}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.typeBadge, { backgroundColor: config.surface }]}>
                          <Text style={[styles.typeBadgeText, { color: config.color }]}>
                            {config.label(t)}
                          </Text>
                        </View>
                        {event.meta && (
                          <Text style={[styles.meta, { color: config.color }]}>{event.meta}</Text>
                        )}
                      </View>

                      <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>

                      <View style={styles.cardFooter}>
                        {event.subtitle && (
                          <View style={styles.cardSubtitleRow}>
                            <Ionicons name="folder-outline" size={12} color={appColors.textMuted} />
                            <Text style={styles.cardSubtitle} numberOfLines={1}>{event.subtitle}</Text>
                          </View>
                        )}
                        <Text style={styles.dateLabel}>
                          {formatDateLabel(event.date, t)}
                        </Text>
                      </View>

                      {event.taskId && (
                        <View style={styles.arrowHint}>
                          <Ionicons name="chevron-forward" size={14} color={appColors.textSoft} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: appColors.textMuted,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: appColors.textSoft,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 20,
    marginTop: 8,
  },
  timeline: {
    paddingHorizontal: 20,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: appColors.border,
    marginTop: 4,
    marginBottom: -4,
  },
  card: {
    flex: 1,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    color: appColors.textMuted,
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: appColors.textSoft,
    marginLeft: 8,
  },
  arrowHint: {
    position: 'absolute',
    right: 12,
    top: '50%',
  },
});
