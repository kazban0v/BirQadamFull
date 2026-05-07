import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { volunteerAPI } from '../../services/api';
import { useTaskSyncStore } from '../../store/taskSyncStore';
import type { Task } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { appColors } from '../../theme';

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TaskFilter = 'all' | 'open' | 'in_progress' | 'under_review' | 'revision' | 'completed' | 'archived';

const ACTIVE_EXCLUDED_STATUSES = new Set([
  'completed',
  'under_review',
  'failed',
  'closed',
  'archived',
  'revision',
  'expired',
]);

const parseTaskDeadline = (dateValue?: string, endTime?: string) => {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const [hours, minutes, seconds] = (endTime || '23:59:59').split(':').map((part) => Number(part));
  return new Date(
    year,
    month - 1,
    day,
    Number.isFinite(hours) ? hours : 23,
    Number.isFinite(minutes) ? minutes : 59,
    Number.isFinite(seconds) ? seconds : 59,
    999
  );
};

const isTaskExpired = (task: Pick<Task, 'status' | 'end_date' | 'end_time' | 'is_expired'>): boolean => {
  if (task.status === 'expired' || task.is_expired) {
    return true;
  }

  const deadline = parseTaskDeadline(task.end_date, task.end_time);
  return Boolean(deadline && Date.now() > deadline.getTime());
};

const FILTER_TABS: Array<{ key: TaskFilter; label: string; variant?: 'review' | 'revision' | 'archive' }> = [
  { key: 'all', label: 'Всего задач' },
  { key: 'open', label: 'Открытые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'under_review', label: 'На проверке', variant: 'review' },
  { key: 'revision', label: 'На доработке', variant: 'revision' },
  { key: 'completed', label: 'Завершено' },
  { key: 'archived', label: 'В архиве', variant: 'archive' },
];

const isOpenTask = (task: Task): boolean =>
  (task.status === 'pending' || task.status === 'open') && !task.accepted;

const isInProgressTask = (task: Task): boolean =>
  task.status === 'in_progress' ||
  task.status === 'active' ||
  Boolean(task.accepted && !ACTIVE_EXCLUDED_STATUSES.has(task.status) && !isTaskExpired(task));

const matchesFilter = (task: Task, filter: TaskFilter): boolean => {
  switch (filter) {
    case 'open':
      return isOpenTask(task);
    case 'in_progress':
      return isInProgressTask(task);
    case 'under_review':
      return task.status === 'under_review';
    case 'revision':
      return task.status === 'revision';
    case 'completed':
      return task.status === 'completed';
    case 'archived':
      return task.status === 'archived';
    default:
      return true;
  }
};

const getFilterCount = (tasks: Task[], filter: TaskFilter): number =>
  filter === 'all' ? tasks.length : tasks.filter((task) => matchesFilter(task, filter)).length;

export const VolunteerTasksScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isNarrow = width < 360;
  const lastTaskMutation = useTaskSyncStore((state) => state.lastMutation);
  const publishTaskMutation = useTaskSyncStore((state) => state.publishTaskMutation);
  const hasLoadedTasksRef = useRef(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>('all');

  const handleGoToMain = useCallback(() => {
    (navigation as any).navigate('HomeTab');
  }, [navigation]);

  const loadTasks = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await volunteerAPI.getTasks();
      const tasksData = Array.isArray(response.data) ? response.data : response.data.tasks || [];

      const transformedTasks: Task[] = tasksData.map((item: any) => ({
        id: item.id,
        title: item.title || item.text || 'Без названия',
        description: item.description || item.text || '',
        project_id: item.project_id,
        project_title: item.project_title,
        location: item.location || item.project_city || item.city || 'Локация не указана',
        start_date: item.start_date || item.deadline_date || item.created_at || new Date().toISOString(),
        end_date: item.end_date || item.deadline_date || item.created_at || new Date().toISOString(),
        status: item.status || 'open',
        assigned_users_count: item.accepted ? 1 : 0,
        reward_points: item.reward_points,
        image: item.image || item.task_image || item.task_image_url,
        start_time: item.start_time,
        end_time: item.end_time,
        creator_name: item.creator_name,
        creator_avatar: item.creator_avatar,
        accepted: Boolean(item.accepted || item.is_assigned || item.assignment_status),
        accepted_at: item.accepted_at,
        photo_uploaded_at: item.photo_uploaded_at,
        photo_moderated_at: item.photo_moderated_at,
        created_at: item.created_at,
        rating: item.rating,
        has_photo_report: Boolean(item.has_photo_report),
        completed: Boolean(item.completed || item.status === 'completed'),
        is_expired: Boolean(item.is_expired),
        can_upload_photo: Boolean(item.can_upload_photo || (item.is_assigned && item.status !== 'completed' && item.status !== 'archived')),
        photo_status: item.photo_status ?? null,
        rejection_reason: item.rejection_reason ?? null,
      }));

      setTasks(transformedTasks);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить задачи');
      if (showLoader) {
        setTasks([]);
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks(!hasLoadedTasksRef.current);
      hasLoadedTasksRef.current = true;
    }, [loadTasks])
  );

  useEffect(() => {
    if (!lastTaskMutation) {
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === lastTaskMutation.taskId
          ? {
              ...task,
              ...lastTaskMutation.changes,
            }
          : task
      )
    );
  }, [lastTaskMutation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks(false);
    setRefreshing(false);
  };

  const handleAcceptTask = async (taskId: number) => {
    Alert.alert(
      'Принять задачу?',
      'Вы уверены, что хотите взять эту задачу?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Принять',
          onPress: async () => {
            try {
              await volunteerAPI.acceptTask(taskId);
              publishTaskMutation({
                taskId,
                reason: 'accepted',
                changes: {
                  status: 'in_progress',
                  accepted: true,
                  accepted_at: new Date().toISOString(),
                  can_upload_photo: true,
                },
              });
              Alert.alert('Успешно', 'Задача принята в работу');
              await loadTasks(false);
            } catch (error: any) {
              const errorMsg =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                'Не удалось принять задачу';
              Alert.alert('Ошибка', errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleDeclineTask = async (taskId: number) => {
    Alert.alert(
      'Отклонить задачу?',
      'Вы уверены, что хотите отклонить эту задачу?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отклонить',
          style: 'destructive',
          onPress: async () => {
            try {
              await volunteerAPI.declineTask(taskId);
              publishTaskMutation({
                taskId,
                reason: 'declined',
                changes: {
                  status: 'rejected',
                  accepted: false,
                  can_upload_photo: false,
                },
              });
              Alert.alert('Задача отклонена');
              await loadTasks(false);
            } catch (error: any) {
              const errorMsg =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                'Не удалось отклонить задачу';
              Alert.alert('Ошибка', errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleArchiveTask = async (taskId: number) => {
    Alert.alert(
      'Архивировать задачу?',
      'Вы уверены, что хотите перенести эту задачу в архив? Она перестанет отображаться в списке активных.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'В архив',
          onPress: async () => {
            try {
              await volunteerAPI.archiveTask(taskId);
              publishTaskMutation({
                taskId,
                reason: 'archived',
                changes: {
                  status: 'archived',
                  can_upload_photo: false,
                },
              });
              Alert.alert('Успешно', 'Задача перенесена в архив');
              await loadTasks(false);
            } catch (error: any) {
              const errorMsg =
                error?.response?.data?.detail ||
                error?.response?.data?.error ||
                'Не удалось архивировать задачу';
              Alert.alert('Ошибка', errorMsg);
            }
          },
        },
      ]
    );
  };

  const formatDateTimeRange = (
    startStr: string,
    endStr: string,
    startTimeStr?: string,
    endTimeStr?: string
  ) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const now = new Date();

    const midnightStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((midnightStart - midnightNow) / (1000 * 60 * 60 * 24));

    const formatDate = (date: Date) =>
      date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

    const formatTime = (date: Date, explicitTime?: string) => {
      if (explicitTime) {
        const parts = explicitTime.split(':');
        if (parts.length >= 2) {
          return `${parts[0]}:${parts[1]}`;
        }
      }
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    let dateText = formatDate(start);
    if (diffDays === 0) {
      dateText = 'Сегодня';
    } else if (diffDays === 1) {
      dateText = 'Завтра';
    } else if (diffDays === -1) {
      dateText = 'Вчера';
    }

    const isSameDay = start.toDateString() === end.toDateString();

    if (isSameDay) {
      return {
        dateText,
        timeText: `${formatTime(start, startTimeStr)} - ${formatTime(end, endTimeStr)}`,
      };
    }

    return {
      dateText: `${formatDate(start)} - ${formatDate(end)}`,
      timeText: `${formatTime(start, startTimeStr)} - ${formatTime(end, endTimeStr)}`,
    };
  };

  const getDeadlineText = (endDate: string, status: Task['status']) => {
    if (status === 'under_review') {
      return { text: 'На проверке', color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'revision') {
      return { text: 'На доработке', color: '#D97706', bgColor: appColors.warningSurface };
    }
    if (status === 'in_progress' || status === 'active') {
      return { text: 'В работе', color: appColors.primary, bgColor: appColors.surfaceMuted };
    }
    if (status === 'completed') {
      return { text: 'Завершено', color: appColors.primary, bgColor: appColors.primarySurface };
    }
    if (status === 'archived') {
      return { text: 'В архиве', color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'failed' || status === 'rejected') {
      return { text: 'Отклонено', color: appColors.danger, bgColor: '#4C1D24' };
    }
    if (status === 'closed') {
      return { text: 'Закрыто', color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'expired') {
      return { text: 'Просрочено', color: appColors.danger, bgColor: '#FEE2E2' };
    }

    const end = new Date(endDate);
    const now = new Date();
    const midnightEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((midnightEnd - midnightNow) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Просрочено', color: appColors.danger, bgColor: '#4C1D24' };
    }

    return { text: 'Открыто', color: appColors.primary, bgColor: appColors.primarySurfaceStrong };
  };

  const filteredTasks = tasks.filter((task) => matchesFilter(task, filter));

  const TaskCard = ({ task }: { task: Task }) => {
    const isExpiredTaskCard = isTaskExpired(task);
    const deadline = getDeadlineText(task.end_date, task.status);
    const imageUrl = normalizeImageUrl(task.image);
    const { dateText, timeText } = formatDateTimeRange(
      task.start_date,
      task.end_date,
      task.start_time,
      task.end_time
    );

    return (
      <TouchableOpacity
        style={[styles.taskCard, isCompact && styles.taskCardCompact]}
        onPress={() => navigation.navigate('VolunteerTaskDetail', { taskId: task.id })}
        activeOpacity={0.7}
      >
        <View style={[styles.cardTopRow, isNarrow && styles.cardTopRowCompact]}>
          <View style={[styles.taskImageContainer, isNarrow && styles.taskImageContainerCompact]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.taskImage} resizeMode="cover" />
            ) : (
              <View style={styles.taskImagePlaceholder}>
                <Ionicons name="image-outline" size={32} color={appColors.textSoft} />
              </View>
            )}
          </View>

          <View style={[styles.taskContentRight, isNarrow && styles.taskContentRightCompact]}>
            <View style={[styles.taskHeader, isCompact && styles.taskHeaderCompact]}>
              <Text
                style={[styles.projectName, isCompact && styles.projectNameCompact]}
                numberOfLines={isCompact ? 2 : 1}
              >
                {task.project_title || 'Локальная задача'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isCompact && styles.statusBadgeCompact,
                  { backgroundColor: deadline.bgColor },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: deadline.color }]}>{deadline.text}</Text>
              </View>
            </View>

            <Text style={[styles.taskTitle, isCompact && styles.taskTitleCompact]} numberOfLines={2}>
              {task.title}
            </Text>

            <View style={styles.deadlineColumn}>
              <View style={styles.deadlineRow}>
                <Ionicons name="calendar-outline" size={14} color={appColors.textMuted} />
                <Text style={[styles.deadlineText, { color: appColors.textSecondary }]}>{dateText}</Text>
              </View>
              <View style={styles.deadlineRow}>
                <Ionicons name="time-outline" size={14} color={appColors.textMuted} />
                <Text style={[styles.deadlineText, { color: appColors.textMuted }]}>{timeText}</Text>
              </View>
              <View style={styles.deadlineRow}>
                <Ionicons name="location-outline" size={14} color={appColors.textMuted} />
                <Text style={[styles.deadlineText, { color: appColors.textMuted }]} numberOfLines={1}>
                  {task.location}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.taskActions, isNarrow && styles.taskActionsCompact]}>
          {isOpenTask(task) && (
            <>
              <TouchableOpacity
                style={[styles.acceptButton, isNarrow && styles.actionButtonCompact]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAcceptTask(task.id);
                }}
              >
                <Text style={[styles.acceptButtonText, isCompact && styles.actionButtonTextCompact]}>Принять</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineButton, isNarrow && styles.actionButtonCompact]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeclineTask(task.id);
                }}
              >
                <Text style={[styles.declineButtonText, isCompact && styles.actionButtonTextCompact]}>Отклонить</Text>
              </TouchableOpacity>
            </>
          )}

          {!isExpiredTaskCard && task.can_upload_photo && (isInProgressTask(task) || task.status === 'revision') && (
            <TouchableOpacity
              style={[styles.completeButton, isNarrow && styles.actionButtonCompact]}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('SubmitPhotoReport', { taskId: task.id });
              }}
            >
              <Ionicons name="camera-reverse-outline" size={20} color={appColors.white} />
              <Text style={[styles.completeButtonText, isCompact && styles.actionButtonTextCompact]}>
                Загрузить фотоотчет
              </Text>
            </TouchableOpacity>
          )}

          {task.status === 'completed' && (
            <TouchableOpacity
              style={[styles.archiveButton, isNarrow && styles.actionButtonCompact]}
              onPress={(e) => {
                e.stopPropagation();
                handleArchiveTask(task.id);
              }}
            >
              <Ionicons name="archive-outline" size={18} color={appColors.textMuted} />
              <Text style={[styles.archiveButtonText, isCompact && styles.actionButtonTextCompact]}>В архив</Text>
            </TouchableOpacity>
          )}

          {task.status === 'completed' && (
            <View style={[styles.completedBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="checkmark-done-circle" size={20} color={appColors.primary} />
              <Text style={[styles.completedText, isCompact && styles.actionButtonTextCompact]}>Завершено</Text>
            </View>
          )}

          {task.status === 'under_review' && (
            <View style={[styles.underReviewBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="eye-outline" size={20} color="#7C3AED" />
              <Text style={[styles.underReviewText, isCompact && styles.actionButtonTextCompact]}>Отчет на проверке</Text>
            </View>
          )}

          {task.status === 'archived' && (
            <View style={[styles.archivedBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="archive-outline" size={20} color={appColors.textMuted} />
              <Text style={[styles.archivedText, isCompact && styles.actionButtonTextCompact]}>Перенесено в архив</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={appColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const emptyDescription =
    filter === 'all'
      ? 'Задачи появятся в проектах, к которым вы присоединились. Сейчас можно открыть проекты и выбрать подходящую активность.'
      : 'Нет задач с выбранным статусом. Попробуйте переключиться на другой фильтр.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <TouchableOpacity style={styles.backHomeButton} onPress={handleGoToMain} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={appColors.primary} />
          <Text style={[styles.backHomeButtonText, isCompact && styles.backHomeButtonTextCompact]}>Главная</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isCompact && styles.headerTitleCompact]}>Мои задачи</Text>
        <TouchableOpacity style={styles.headerActionButton} onPress={() => Alert.alert('Уведомления', 'Раздел находится в разработке.')}>
          <Ionicons name="notifications-outline" size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterContainer, isCompact && styles.filterContainerCompact]}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          const tabStyles =
            tab.variant === 'review'
              ? [styles.filterTab, isActive && styles.filterTabActiveReview]
              : tab.variant === 'revision'
                ? [styles.filterTab, isActive && styles.filterTabActiveRevision]
                : tab.variant === 'archive'
                  ? [styles.filterTab, isActive && styles.filterTabActiveArchive]
                  : [styles.filterTab, isActive && styles.filterTabActive];

          const tabTextStyles =
            tab.variant === 'review'
              ? [styles.filterTabText, isActive && styles.filterTabTextReview]
              : tab.variant === 'revision'
                ? [styles.filterTabText, isActive && styles.filterTabTextRevision]
                : tab.variant === 'archive'
                  ? [styles.filterTabText, isActive && styles.filterTabTextArchive]
                  : [styles.filterTabText, isActive && styles.filterTabTextActive];

          const countStyles =
            tab.variant === 'review'
              ? [styles.filterCount, isActive && styles.filterCountReview]
              : tab.variant === 'revision'
                ? [styles.filterCount, isActive && styles.filterCountRevision]
                : tab.variant === 'archive'
                  ? [styles.filterCount, isActive && styles.filterCountArchive]
                  : [styles.filterCount, isActive && styles.filterCountActive];

          return (
            <TouchableOpacity
              key={tab.key}
              style={[tabStyles, isCompact && styles.filterTabCompact]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[tabTextStyles, isCompact && styles.filterTabTextCompact]}>{tab.label}</Text>
              <View style={countStyles}>
                <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                  {getFilterCount(tasks, tab.key)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <View style={[styles.emptyState, isCompact && styles.emptyStateCompact]}>
            <View style={styles.emptyIllustration}>
              <Ionicons name="clipboard-outline" size={80} color={appColors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Задач пока нет</Text>
            <Text style={styles.emptyText}>{emptyDescription}</Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => Alert.alert('Переход', 'Откройте раздел проектов в приложении.')}
            >
              <Ionicons name="compass-outline" size={20} color={appColors.white} />
              <Text style={styles.browseButtonText}>Открыть проекты</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.background },
  container: { flex: 1, backgroundColor: appColors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: appColors.surface,
  },
  headerCompact: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backHomeButton: {
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backHomeButtonText: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: '700',
    color: appColors.primary,
  },
  backHomeButtonTextCompact: {
    fontSize: 14,
  },
  headerActionButton: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: appColors.text,
    textAlign: 'center',
  },
  headerTitleCompact: { fontSize: 18 },
  filterScroll: {
    maxHeight: 56,
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  filterContainerCompact: { paddingHorizontal: 16 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTabCompact: { paddingHorizontal: 12, gap: 6 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: appColors.primary },
  filterTabText: { fontSize: 14, fontWeight: '600', color: appColors.textSoft },
  filterTabTextCompact: { fontSize: 13 },
  filterTabTextActive: { color: appColors.primary },
  filterCount: { backgroundColor: appColors.surfaceSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  filterCountActive: { backgroundColor: appColors.primary },
  filterCountText: { fontSize: 12, fontWeight: '600', color: appColors.textSoft },
  filterCountTextActive: { color: appColors.white },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  scrollContentCompact: { paddingHorizontal: 12, paddingBottom: 20 },
  taskCard: {
    backgroundColor: appColors.surface,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  taskCardCompact: { padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  cardTopRowCompact: { flexDirection: 'column' },
  taskImageContainer: { width: 84, height: 84, borderRadius: 12, backgroundColor: appColors.surfaceSoft, overflow: 'hidden' },
  taskImageContainerCompact: { width: '100%', height: 160, marginBottom: 14 },
  taskImage: { width: '100%', height: '100%' },
  taskImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  taskContentRight: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  taskContentRightCompact: { width: '100%', marginLeft: 0 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  taskHeaderCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  projectName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: appColors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  projectNameCompact: { width: '100%', marginRight: 0 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeCompact: { alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  taskTitle: { fontSize: 17, fontWeight: '700', color: appColors.text, marginBottom: 8, lineHeight: 22 },
  taskTitleCompact: { fontSize: 16, lineHeight: 21 },
  deadlineColumn: { gap: 4, marginTop: 2 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deadlineText: { fontSize: 13, fontWeight: '500' },
  taskActions: { flexDirection: 'row', gap: 12 },
  taskActionsCompact: { flexDirection: 'column' },
  actionButtonCompact: { flex: 0, width: '100%' },
  actionButtonTextCompact: { fontSize: 14, flexShrink: 1, textAlign: 'center' },
  acceptButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptButtonText: { fontSize: 15, fontWeight: '700', color: appColors.white },
  declineButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surface,
    borderWidth: 1.5,
    borderColor: appColors.danger,
    paddingVertical: 10.5,
    borderRadius: 10,
  },
  declineButtonText: { fontSize: 15, fontWeight: '700', color: appColors.danger },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  completeButtonText: { fontSize: 15, fontWeight: '700', color: appColors.white },
  archiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surfaceSoft,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  archiveButtonText: { fontSize: 15, fontWeight: '700', color: appColors.textMuted },
  completedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySurface,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  completedText: { fontSize: 15, fontWeight: '700', color: appColors.primary },
  underReviewBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  underReviewText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  archivedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.surfaceSoft,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  archivedText: { fontSize: 15, fontWeight: '700', color: appColors.textMuted },
  filterTabActiveReview: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  filterTabTextReview: { color: '#7C3AED' },
  filterCountReview: { backgroundColor: '#7C3AED' },
  filterTabActiveRevision: { borderBottomWidth: 2, borderBottomColor: '#D97706' },
  filterTabTextRevision: { color: '#D97706' },
  filterCountRevision: { backgroundColor: '#D97706' },
  filterTabActiveArchive: { borderBottomWidth: 2, borderBottomColor: appColors.textMuted },
  filterTabTextArchive: { color: appColors.textMuted },
  filterCountArchive: { backgroundColor: appColors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyStateCompact: { paddingHorizontal: 20, paddingVertical: 56 },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: appColors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: appColors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  browseButtonText: { fontSize: 16, fontWeight: '700', color: appColors.white },
});
