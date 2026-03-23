import React, { useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import type { Task } from '../../types';

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
};

type RouteProps = RouteProp<RootStackParamList, 'VolunteerTaskDetail'>;

export const VolunteerTaskDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTaskDetail = async () => {
    try {
      const response = await volunteerAPI.getTaskDetail(taskId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTask(response.data);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить детали задачи');
      console.error('Error fetching task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTaskDetail();
    }, [taskId])
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleAcceptTask = async () => {
    try {
      await volunteerAPI.acceptTask(taskId);
      Alert.alert('Успешно', 'Задача принята в работу');
      fetchTaskDetail();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Не удалось принять задачу';
      Alert.alert('Ошибка', errorMsg);
    }
  };

  const handleDeclineTask = async () => {
    try {
      await volunteerAPI.declineTask(taskId);
      Alert.alert('Успех', 'Задача отклонена');
      navigation.goBack();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Не удалось отклонить задачу';
      Alert.alert('Ошибка', errorMsg);
    }
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={60} color="#9CA3AF" />
        <Text style={styles.errorText}>Задача не найдена</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Вернуться назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl = normalizeImageUrl(task.image);
  const isPending = task.status === 'pending' || task.status === 'open' || !task.status;
  const inProgress = task.status === 'in_progress' || task.status === 'active';
  const organizerAvatar = normalizeImageUrl(task.creator_avatar);

  // Formatting dates and times
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTimeInfo = (timeString?: string) => {
    if (!timeString) return '';
    // timeString form is typically 'HH:MM' or 'HH:MM:SS'
    // By extracting directly we avoid JS Date timezone shifting bugs!
    const parts = timeString.includes('T') ? timeString.split('T')[1].split(':') : timeString.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeString;
  };
  const formatTimelineDate = (dateString?: string) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    const today = new Date();
    const isToday = dateObj.getDate() === today.getDate() && dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    const timeStr = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isToday) return `Сегодня, ${timeStr}`;
    return `${dateObj.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const getDaysLeft = () => {
    if (!task.end_date) return '';
    const endDate = new Date(task.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    if (diffTime < 0) return 'ИСТЕКЛО';
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Russian pluralization
    let daysWord = 'ДНЕЙ';
    if (diffDays % 10 === 1 && diffDays % 100 !== 11) {
      daysWord = 'ДЕНЬ';
    } else if ([2, 3, 4].includes(diffDays % 10) && ![12, 13, 14].includes(diffDays % 100)) {
      daysWord = 'ДНЯ';
    }
    return `ОСТАЛОСЬ ${diffDays} ${daysWord}`;
  };

  const getEstimatedTime = () => {
    if (task.start_time && task.end_time) {
      const [startH, startM] = task.start_time.split(':').map(Number);
      const [endH, endM] = task.end_time.split(':').map(Number);
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff < 0) diff += 24 * 60; // Cross midnight
      const hours = Math.round(diff / 60);
      
      let hoursWord = 'часов';
      if (hours === 1) hoursWord = 'час';
      else if ([2, 3, 4].includes(hours)) hoursWord = 'часа';
      
      return `${hours} ${hoursWord}`;
    }
    return 'Весь день';
  };

  const renderStars = (rating: number = 0) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons key={i} name={i <= rating ? "star" : "star-outline"} size={14} color="#F59E0B" style={{marginRight: 2}} />
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Детали задачи</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Cover Image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={40} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
            <Text style={styles.verifiedText}>Проверено</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>{task.title}</Text>

          {/* Description */}
          {!!task.description && (
            <Text style={styles.description}>{task.description}</Text>
          )}

          {/* Deadline Card */}
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineTopRow}>
              <View style={styles.deadlineLabelContainer}>
                <Ionicons name="calendar-outline" size={14} color="#10B981" />
                <Text style={styles.deadlineLabel}>ДЕДЛАЙН</Text>
              </View>
              <View style={styles.daysLeftPill}>
                <Text style={styles.daysLeftText}>{getDaysLeft()}</Text>
              </View>
            </View>
            <View style={styles.deadlineBottomRow}>
              <View>
                <Text style={styles.deadlineDate}>{formatDate(task.end_date)}</Text>
                <Text style={styles.deadlineTime}>
                  {task.start_time ? `с ${formatTimeInfo(task.start_time)} ` : ''}
                  {task.end_time ? `до ${formatTimeInfo(task.end_time)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 12 }}>
                <Text style={[styles.estimatedTimeLabel, { textAlign: 'right', fontSize: 10, lineHeight: 12 }]} numberOfLines={2}>Занимает времени</Text>
                <Text style={styles.estimatedTimeValue}>{getEstimatedTime()}</Text>
              </View>
            </View>
          </View>

          {/* Organized By */}
          <View style={styles.organizerRow}>
            {organizerAvatar ? (
              <Image source={{ uri: organizerAvatar }} style={styles.organizerAvatar} />
            ) : (
              <View style={styles.organizerAvatarFallback}>
                <Ionicons name="person" size={24} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.organizerInfo}>
              <Text style={styles.organizerLabel}>ОРГАНИЗАТОР</Text>
              <Text style={styles.organizerName}>{task.creator_name || 'Организация'}</Text>
            </View>
            <TouchableOpacity style={styles.chatButton}>
              <Ionicons name="chatbubble-outline" size={20} color="#10B981" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Activity Timeline */}
          <Text style={styles.timelineHeading}>ИСТОРИЯ АКТИВНОСТИ</Text>
          <View style={styles.timeline}>
            
            {/* 1. Task Created */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: '#10B981' }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitleActive}>Задача создана</Text>
                <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.created_at)}</Text>
              </View>
            </View>

            {/* 2. You accepted */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: task.accepted ? '#10B981' : '#E5E7EB' }]}>
                  <Ionicons name="checkmark" size={14} color={task.accepted ? '#FFF' : '#9CA3AF'} />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: task.has_photo_report ? '#10B981' : '#E5E7EB' }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={task.accepted ? styles.timelineTitleActive : styles.timelineTitleInactive}>Вы приняли задачу</Text>
                {task.accepted_at && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.accepted_at)}</Text>
                )}
              </View>
            </View>

            {/* 3. Photo uploaded */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: task.has_photo_report ? '#10B981' : '#E5E7EB' }]}>
                  <Ionicons name="checkmark" size={14} color={task.has_photo_report ? '#FFF' : '#9CA3AF'} />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: task.status === 'under_review' || task.completed ? '#10B981' : '#E5E7EB' }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={task.has_photo_report ? styles.timelineTitleActive : styles.timelineTitleInactive}>Фотоотчет загружен</Text>
                {task.photo_uploaded_at && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.photo_uploaded_at)}</Text>
                )}
              </View>
            </View>

            {/* 4. Under Review */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: task.status === 'under_review' || task.completed ? '#10B981' : '#E5E7EB' }]}>
                  {task.status === 'under_review' || task.completed ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : (
                    <Ionicons name="time" size={14} color="#9CA3AF" />
                  )}
                </View>
                <View style={[styles.timelineLine, { backgroundColor: task.completed ? '#10B981' : '#E5E7EB' }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={task.status === 'under_review' || task.completed ? styles.timelineTitleActive : styles.timelineTitleInactive}>На проверке</Text>
                {task.photo_moderated_at && task.completed && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.photo_moderated_at)}</Text>
                )}
              </View>
            </View>

            {/* 4. Approved */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: task.completed ? '#10B981' : '#E5E7EB' }]}>
                  {task.completed ? (
                    <Ionicons name="star" size={12} color="#FFF" />
                  ) : (
                    <Ionicons name="star-outline" size={12} color="#9CA3AF" />
                  )}
                </View>
              </View>
              <View style={styles.timelineContent}>
                <Text style={task.completed ? styles.timelineTitleActive : styles.timelineTitleInactive}>
                  {task.completed ? `Принято с оценкой ${task.rating || 5}` : 'Принятие'}
                </Text>
                {task.completed ? (
                  renderStars(task.rating || 5)
                ) : null}
              </View>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Footer Button logic mapped to Activity status */}
      <View style={styles.footerContainer}>
        {isPending ? (
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleDeclineTask}>
              <Text style={styles.secondaryButtonText}>Отклонить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAcceptTask}>
              <Text style={styles.primaryButtonText}>Начать задачу</Text>
            </TouchableOpacity>
          </View>
        ) : task.can_upload_photo ? (
          <TouchableOpacity 
            style={styles.primaryButtonLarge} 
            onPress={() => navigation.navigate('SubmitPhotoReport', { taskId })}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Загрузить фотоотчет</Text>
          </TouchableOpacity>
        ) : task.completed ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
            <Text style={styles.completedBadgeText}>Задача успешно завершена!</Text>
          </View>
        ) : task.has_photo_report && !task.completed ? (
          <View style={styles.reviewBadge}>
            <Ionicons name="time" size={24} color="#F59E0B" />
            <Text style={styles.reviewBadgeText}>Отчет на проверке</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Leave space for footer
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  imageContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    right: 28, // 16 padding + 12
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 28,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 24,
  },
  deadlineCard: {
    backgroundColor: '#ECFDF5', // Light green bg
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginBottom: 24,
  },
  deadlineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deadlineLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deadlineLabel: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  daysLeftPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysLeftText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  deadlineBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  deadlineDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  deadlineTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  estimatedTimeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  estimatedTimeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  organizerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  organizerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizerInfo: {
    flex: 1,
  },
  organizerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 2,
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 24,
  },
  timelineHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 4,
  },
  timelineNode: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineIndicatorColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 24,
    justifyContent: 'flex-start',
    marginTop: -2, // Align with dot top
  },
  timelineTitleActive: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  timelineTitleInactive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  timelineSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32, // Adjust for iPhone notch safely
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
  },
  primaryButtonLarge: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completedBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    gap: 8,
  },
  completedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  reviewBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    gap: 8,
  },
  reviewBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
});

