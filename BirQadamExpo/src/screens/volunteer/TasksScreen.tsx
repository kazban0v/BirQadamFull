import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { volunteerAPI } from '../../services/api';
import type { Task } from '../../types';

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const VolunteerTasksScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'assigned' | 'in_progress' | 'under_review' | 'completed' | 'archived' | 'rejected'>('assigned');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getTasks();
      const tasksData = Array.isArray(response.data) ? response.data : (response.data.tasks || []);

      const transformedTasks: Task[] = tasksData.map((item: any) => ({
        id: item.id,
        title: item.text || item.title || 'Без названия',
        description: item.description || item.text || '',
        project_id: item.project_id,
        project_title: item.project_title,
        location: item.project_title || 'Локация не указана',
        start_date: item.created_at || item.deadline_date || new Date().toISOString(),
        end_date: item.deadline_date || item.created_at || new Date().toISOString(),
        status: item.status || (item.is_assigned ? 'in_progress' : 'pending'),
        assigned_users_count: item.is_assigned ? 1 : 0,
        reward_points: item.reward_points,
        image: item.image,
      }));

      setTasks(transformedTasks);
    } catch (error: any) {
      console.error('❌ Error loading tasks:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить задачи');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleAcceptTask = async (taskId: number) => {
    Alert.alert(
      'Принять задачу?',
      'Вы уверены, что хотите принять эту задачу?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Принять',
          onPress: async () => {
            try {
              await volunteerAPI.acceptTask(taskId);
              Alert.alert('Успешно', 'Задача принята в работу');
              await loadTasks();
            } catch (error: any) {
              const errorMsg = error?.response?.data?.detail || error?.response?.data?.error || 'Не удалось принять задачу';
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
              Alert.alert('Задача отклонена');
              await loadTasks();
            } catch (error: any) {
              const errorMsg = error?.response?.data?.detail || error?.response?.data?.error || 'Не удалось отклонить задачу';
              Alert.alert('Ошибка', errorMsg);
            }
          },
        },
      ]
    );
  };

  const handleCompleteTask = async (taskId: number) => {
    Alert.alert(
      'Завершить задачу?',
      'Вы уверены, что хотите завершить эту задачу?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          onPress: async () => {
            try {
              await volunteerAPI.completeTask(taskId);
              Alert.alert('Успешно', 'Задача завершена! Ожидайте подтверждения.');
              await loadTasks();
            } catch (error: any) {
              const errorMsg = error?.response?.data?.detail || error?.response?.data?.error || 'Не удалось завершить задачу';
              Alert.alert('Ошибка', errorMsg);
            }
          },
        },
      ]
    );
  };

  const getDeadlineText = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Просрочено', color: '#EF4444' };
    if (diffDays === 0) return { text: 'Сегодня', color: '#F59E0B' };
    if (diffDays === 1) return { text: 'Завтра', color: '#F59E0B' };
    return { text: `${diffDays} дн.`, color: '#10B981' };
  };

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

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'assigned') return task.status === 'pending' || task.status === 'open' || (!task.status && !task.project_title);
    if (filter === 'in_progress') return task.status === 'in_progress' || task.status === 'active';
    if (filter === 'under_review') return task.status === 'under_review';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'archived') return task.status === 'archived';
    if (filter === 'rejected') return task.status === 'cancelled' || task.status === 'rejected' || task.status === 'failed';
    return true;
  });

  const getFilterCount = (filterName: string) => {
    if (filterName === 'assigned') return tasks.filter(t => t.status === 'pending' || t.status === 'open' || (!t.status && !t.project_title)).length;
    if (filterName === 'in_progress') return tasks.filter(t => t.status === 'in_progress' || t.status === 'active').length;
    if (filterName === 'under_review') return tasks.filter(t => t.status === 'under_review').length;
    if (filterName === 'completed') return tasks.filter(t => t.status === 'completed').length;
    if (filterName === 'archived') return tasks.filter(t => t.status === 'archived').length;
    return 0;
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const deadline = getDeadlineText(task.end_date);
    const imageUrl = normalizeImageUrl(task.image);

    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => navigation.navigate('VolunteerTaskDetail', { taskId: task.id })}
        activeOpacity={0.7}
      >
        <View style={styles.taskImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.taskImage} resizeMode="cover" />
          ) : (
            <View style={styles.taskImagePlaceholder}>
              <Ionicons name="image-outline" size={40} color="#9CA3AF" />
            </View>
          )}
        </View>

        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text style={styles.projectName}>{task.project_title || 'BirQadam'}</Text>
            {task.reward_points && (
              <View style={styles.rewardBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.rewardText}>{task.reward_points}</Text>
              </View>
            )}
          </View>

          <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>

          <View style={styles.deadlineRow}>
            <Ionicons name="time-outline" size={16} color="#EF4444" />
            <Text style={styles.deadlineText}>
              Дедлайн: {new Date(task.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </Text>
          </View>

          <View style={styles.taskActions}>
            {(task.status === 'pending' || !task.project_title) && (
              <>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={(e) => { e.stopPropagation(); handleAcceptTask(task.id); }}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Принять</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={(e) => { e.stopPropagation(); handleDeclineTask(task.id); }}
                >
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                  <Text style={styles.declineButtonText}>Отклонить</Text>
                </TouchableOpacity>
              </>
            )}

            {(task.status === 'active' || task.status === 'in_progress') && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={(e) => { e.stopPropagation(); handleCompleteTask(task.id); }}
              >
                <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Завершить</Text>
              </TouchableOpacity>
            )}

            {task.status === 'completed' && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                <Text style={styles.completedText}>Завершено</Text>
              </View>
            )}

            {task.status === 'under_review' && (
              <View style={styles.underReviewBadge}>
                <Ionicons name="eye-outline" size={20} color="#7C3AED" />
                <Text style={styles.underReviewText}>На проверке</Text>
              </View>
            )}

            {task.status === 'archived' && (
              <View style={styles.archivedBadge}>
                <Ionicons name="archive-outline" size={20} color="#6B7280" />
                <Text style={styles.archivedText}>В архиве</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="menu-outline" size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мои задачи</Text>
        <TouchableOpacity onPress={() => Alert.alert('Уведомления', 'В разработке')}>
          <Ionicons name="notifications-outline" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterTab, filter === 'assigned' && styles.filterTabActive]}
          onPress={() => setFilter('assigned')}
        >
          <Text style={[styles.filterTabText, filter === 'assigned' && styles.filterTabTextActive]}>
            Назначенные
          </Text>
          <View style={[styles.filterCount, filter === 'assigned' && styles.filterCountActive]}>
            <Text style={[styles.filterCountText, filter === 'assigned' && styles.filterCountTextActive]}>
              {getFilterCount('assigned')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'in_progress' && styles.filterTabActive]}
          onPress={() => setFilter('in_progress')}
        >
          <Text style={[styles.filterTabText, filter === 'in_progress' && styles.filterTabTextActive]}>
            В работе
          </Text>
          <View style={[styles.filterCount, filter === 'in_progress' && styles.filterCountActive]}>
            <Text style={[styles.filterCountText, filter === 'in_progress' && styles.filterCountTextActive]}>
              {getFilterCount('in_progress')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'under_review' && styles.filterTabActiveReview]}
          onPress={() => setFilter('under_review')}
        >
          <Text style={[styles.filterTabText, filter === 'under_review' && styles.filterTabTextReview]}>
            На проверке
          </Text>
          <View style={[styles.filterCount, filter === 'under_review' && styles.filterCountReview]}>
            <Text style={[styles.filterCountText, filter === 'under_review' && styles.filterCountTextActive]}>
              {getFilterCount('under_review')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'completed' && styles.filterTabActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterTabText, filter === 'completed' && styles.filterTabTextActive]}>
            Завершённые
          </Text>
          <View style={[styles.filterCount, filter === 'completed' && styles.filterCountActive]}>
            <Text style={[styles.filterCountText, filter === 'completed' && styles.filterCountTextActive]}>
              {getFilterCount('completed')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'archived' && styles.filterTabActiveArchive]}
          onPress={() => setFilter('archived')}
        >
          <Text style={[styles.filterTabText, filter === 'archived' && styles.filterTabTextArchive]}>
            В архиве
          </Text>
          <View style={[styles.filterCount, filter === 'archived' && styles.filterCountArchive]}>
            <Text style={[styles.filterCountText, filter === 'archived' && styles.filterCountTextActive]}>
              {getFilterCount('archived')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterTab, filter === 'rejected' && styles.filterTabActiveRejected]}
          onPress={() => setFilter('rejected')}
        >
          <Text style={[styles.filterTabText, filter === 'rejected' && styles.filterTabTextRejected]}>
            Отклонённые
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tasks List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIllustration}>
              <Ionicons name="clipboard-outline" size={80} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Задач пока нет</Text>
            <Text style={styles.emptyText}>
              Ваш список задач пуст. Присоединяйтесь к проектам, чтобы получать задачи и начинать влиять на мир!
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => Alert.alert('Переход', 'К списку проектов')}
            >
              <Ionicons name="compass-outline" size={20} color="#FFFFFF" />
              <Text style={styles.browseButtonText}>Смотреть проекты</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  filterScroll: { maxHeight: 56, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterTabActive: { borderBottomWidth: 2, borderBottomColor: '#10B981' },
  filterTabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  filterTabTextActive: { color: '#10B981' },
  filterCount: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  filterCountActive: { backgroundColor: '#10B981' },
  filterCountText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  filterCountTextActive: { color: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  taskImageContainer: { width: '100%', height: 140, backgroundColor: '#F3F4F6' },
  taskImage: { width: '100%', height: '100%' },
  taskImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  taskContent: { padding: 16 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  projectName: { fontSize: 12, fontWeight: '700', color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.5 },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  rewardText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  deadlineText: { fontSize: 13, color: '#EF4444', fontWeight: '500' },
  taskActions: { flexDirection: 'row', gap: 12 },
  acceptButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, gap: 6 },
  acceptButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  declineButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EF4444', paddingVertical: 10, borderRadius: 10, gap: 6 },
  declineButtonText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  completeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10, gap: 6 },
  completeButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  completedBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', paddingVertical: 12, borderRadius: 10, gap: 6 },
  completedText: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  underReviewBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF', paddingVertical: 12, borderRadius: 10, gap: 6 },
  underReviewText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  archivedBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, gap: 6 },
  archivedText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  filterTabActiveReview: { borderBottomWidth: 2, borderBottomColor: '#7C3AED' },
  filterTabTextReview: { color: '#7C3AED' },
  filterCountReview: { backgroundColor: '#7C3AED' },
  filterTabActiveArchive: { borderBottomWidth: 2, borderBottomColor: '#6B7280' },
  filterTabTextArchive: { color: '#6B7280' },
  filterCountArchive: { backgroundColor: '#6B7280' },
  filterTabActiveRejected: { borderBottomWidth: 2, borderBottomColor: '#EF4444' },
  filterTabTextRejected: { color: '#EF4444' },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyIllustration: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  browseButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, gap: 8 },
  browseButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
