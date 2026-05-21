import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { volunteerAPI } from '../../services/api';
import { useTaskSyncStore } from '../../store/taskSyncStore';
import type { Task } from '../../types';
import { resolveVolunteerTaskHeroImageUrl } from '../../utils/network';
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { syncVolunteerLocalNotifications } from '../../utils/volunteerNotifications';
import { appColors } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { useTranslation } from "../../locales/i18n";
import { SkeletonTasksList } from '../../components/skeleton/screens/SkeletonTasksList';

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
  VolunteerProjects: undefined;
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

const getFilterTabs = (t: (key: string) => string): Array<{
  key: TaskFilter;
  label: string;
  variant?: 'review' | 'revision' | 'archive';
}> => [
  { key: 'all', label: t('tasks.s_0') },
  { key: 'open', label: t('tasks.s_1') },
  { key: 'in_progress', label: t('tasks.s_2') },
  { key: 'under_review', label: t('tasks.s_3'), variant: 'review' },
  { key: 'revision', label: t('tasks.s_4'), variant: 'revision' },
  { key: 'completed', label: t('tasks.s_5') },
  { key: 'archived', label: t('tasks.s_6'), variant: 'archive' },
];

const isOpenTask = (task: Task): boolean =>
  (task.status === 'pending' || task.status === 'open') && !task.accepted;

const isInProgressTask = (task: Task): boolean =>
  task.status === 'in_progress' ||
  task.status === 'active' ||
  Boolean(task.accepted && !ACTIVE_EXCLUDED_STATUSES.has(task.status) && !isTaskExpired(task));

const matchesFilter = (task: Task, filter: TaskFilter): boolean => {
  switch (filter) {
    case 'all':
      return ['open', 'pending', 'in_progress', 'active', 'under_review', 'revision', 'expired'].includes(
        task.status
      );
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
  tasks.filter((task) => matchesFilter(task, filter)).length;

export const VolunteerTasksScreen: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isNarrow = width < 360;
  const lastTaskMutation = useTaskSyncStore((state) => state.lastMutation);
  const publishTaskMutation = useTaskSyncStore((state) => state.publishTaskMutation);
  const hasLoadedTasksRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const filterTabs = useMemo(() => getFilterTabs(t), [t]);

  const handleGoToMain = useCallback(() => {
    (navigation as any).navigate('HomeTab');
  }, [navigation]);

  const loadTasks = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const [response, projectsResponse] = await Promise.all([
        volunteerAPI.getTasks(),
        volunteerAPI.getProjects(),
      ]);
      const tasksData = Array.isArray(response.data) ? response.data : response.data.tasks || [];
      const projectsData = Array.isArray(projectsResponse.data)
        ? projectsResponse.data
        : projectsResponse.data.projects || [];

      const seenTaskIds = new Set<number>();
      const uniqueTasksData = tasksData.filter((item: any) => {
        const id = Number(item?.id);
        if (!Number.isFinite(id)) {
          return false;
        }
        if (seenTaskIds.has(id)) {
          return false;
        }
        seenTaskIds.add(id);
        return true;
      });

      const transformedTasks: Task[] = uniqueTasksData.map((item: any) => ({
        id: item.id,
        title: item.title || item.text || t('tasks.s_7'),
        description: item.description || item.text || '',
        project_id: item.project_id,
        project_title: item.project_title,
        location: item.location || item.project_city || item.city || t('tasks.s_8'),
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

      if (Platform.OS !== 'web') {
        void syncVolunteerLocalNotifications(transformedTasks, projectsData);
      }
    } catch (error: unknown) {
      console.error('Error loading tasks:', error);
      toast.error(getAxiosErrorMessage(error, t('tasks.s_10')));
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
      scrollRef.current?.scrollTo({ y: 0, animated: false });
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
      t('tasks.s_11'),
      t('tasks.s_12'),
      [
        { text: t('tasks.s_13'), style: 'cancel' },
        {
          text: t('tasks.s_14'),
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
              toast.success(t('tasks.s_16'));
              await loadTasks(false);
            } catch (error: unknown) {
              const errorMsg = getAxiosErrorMessage(error, t('tasks.s_17'));
              toast.error(errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleDeclineTask = async (taskId: number) => {
    Alert.alert(
      t('tasks.s_19'),
      t('tasks.s_20'),
      [
        { text: t('tasks.s_21'), style: 'cancel' },
        {
          text: t('tasks.s_22'),
          style: 'destructive',
          onPress: async () => {
            try {
              await volunteerAPI.declineTask(taskId);
              publishTaskMutation({
                taskId,
                reason: 'declined',
                changes: {
                  status: 'archived',
                  accepted: false,
                  can_upload_photo: false,
                },
              });
              toast.success(t('tasks.s_23'));
              await loadTasks(false);
            } catch (error: unknown) {
              const errorMsg = getAxiosErrorMessage(error, t('tasks.s_24'));
              toast.error(errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleArchiveTask = async (taskId: number) => {
    Alert.alert(
      t('tasks.s_26'),
      t('tasks.s_27'),
      [
        { text: t('tasks.s_28'), style: 'cancel' },
        {
          text: t('tasks.s_29'),
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
              toast.success(t('tasks.s_31'));
              await loadTasks(false);
            } catch (error: unknown) {
              const errorMsg = getAxiosErrorMessage(error, t('tasks.s_32'));
              toast.error(errorMsg);
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
      dateText = t('tasks.s_34');
    } else if (diffDays === 1) {
      dateText = t('tasks.s_35');
    } else if (diffDays === -1) {
      dateText = t('tasks.s_36');
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
      return { text: t('tasks.s_37'), color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'revision') {
      return { text: t('tasks.s_38'), color: '#D97706', bgColor: appColors.warningSurface };
    }
    if (status === 'in_progress' || status === 'active') {
      return { text: t('tasks.s_39'), color: appColors.primary, bgColor: appColors.surfaceMuted };
    }
    if (status === 'completed') {
      return { text: t('tasks.s_40'), color: appColors.primary, bgColor: appColors.primarySurface };
    }
    if (status === 'archived') {
      return { text: t('tasks.s_41'), color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'failed' || status === 'rejected') {
      return { text: t('tasks.s_42'), color: appColors.danger, bgColor: '#4C1D24' };
    }
    if (status === 'closed') {
      return { text: t('tasks.s_43'), color: appColors.textMuted, bgColor: appColors.surfaceMuted };
    }
    if (status === 'expired') {
      return { text: t('tasks.s_44'), color: appColors.danger, bgColor: '#FEE2E2' };
    }

    const end = new Date(endDate);
    const now = new Date();
    const midnightEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const midnightNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((midnightEnd - midnightNow) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: t('tasks.s_45'), color: appColors.danger, bgColor: '#4C1D24' };
    }

    return { text: t('tasks.s_46'), color: appColors.primary, bgColor: appColors.primarySurfaceStrong };
  };

  const filteredTasks = tasks.filter((task) => matchesFilter(task, filter));

  const TaskCard = ({ task }: { task: Task }) => {
    const isExpiredTaskCard = isTaskExpired(task);
    const deadline = getDeadlineText(task.end_date, task.status);
    const imageUrl = resolveVolunteerTaskHeroImageUrl(task);
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
            <Image source={{ uri: imageUrl }} style={styles.taskImage} resizeMode="cover" />
          </View>

          <View style={[styles.taskContentRight, isNarrow && styles.taskContentRightCompact]}>
            <View style={[styles.taskHeader, isCompact && styles.taskHeaderCompact]}>
              <Text
                style={[styles.projectName, isCompact && styles.projectNameCompact]}
                numberOfLines={isCompact ? 2 : 1}
              >
                {task.project_title || t('tasks.s_47')}
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
                <Text style={[styles.acceptButtonText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_48')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineButton, isNarrow && styles.actionButtonCompact]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeclineTask(task.id);
                }}
              >
                <Text style={[styles.declineButtonText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_49')}</Text>
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
                {t('tasks.s_50')}</Text>
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
              <Text style={[styles.archiveButtonText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_51')}</Text>
            </TouchableOpacity>
          )}

          {task.status === 'completed' && (
            <View style={[styles.completedBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="checkmark-done-circle" size={20} color={appColors.primary} />
              <Text style={[styles.completedText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_52')}</Text>
            </View>
          )}

          {task.status === 'under_review' && (
            <View style={[styles.underReviewBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="eye-outline" size={20} color="#7C3AED" />
              <Text style={[styles.underReviewText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_53')}</Text>
            </View>
          )}

          {task.status === 'archived' && (
            <View style={[styles.archivedBadge, isNarrow && styles.actionButtonCompact]}>
              <Ionicons name="archive-outline" size={20} color={appColors.textMuted} />
              <Text style={[styles.archivedText, isCompact && styles.actionButtonTextCompact]}>{t('tasks.s_54')}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <SkeletonTasksList />;
  }

  const emptyDescription =
    filter === 'all'
      ? t('tasks.s_55')
      : t('tasks.s_56');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <TouchableOpacity style={styles.backHomeButton} onPress={handleGoToMain} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={appColors.primary} />
          <Text style={[styles.backHomeButtonText, isCompact && styles.backHomeButtonTextCompact]}>{t('tasks.s_57')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isCompact && styles.headerTitleCompact]}>{t('tasks.s_59')}</Text>
        <TouchableOpacity style={styles.headerActionButton} onPress={() => toast.info(t('tasks.s_60'))}>
          <Ionicons name="notifications-outline" size={24} color="#F8FAFC" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterContainer, isCompact && styles.filterContainerCompact]}
      >
        {filterTabs.map((tab: (typeof filterTabs)[number]) => {
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
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isCompact && styles.scrollContentCompact]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title={t('tasks.s_62')}
            description={emptyDescription}
            size="lg"
            action={{
              label: t('tasks.s_65'),
              icon: 'compass-outline',
              onPress: () => navigation.navigate('VolunteerProjects'),
            }}
          />
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.surface },
  container: { flex: 1, backgroundColor: appColors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: appColors.surface },
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
  taskContentRight: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  taskContentRightCompact: { width: '100%', marginLeft: 0 },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    minWidth: 0,
    gap: 8,
  },
  taskHeaderCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  projectName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
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
  deadlineText: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 13, fontWeight: '500' },
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
});
