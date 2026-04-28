import React, { useEffect, useState, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TouchableOpacity,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appColors } from '../../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import { useTaskSyncStore } from '../../store/taskSyncStore';
import type { Task } from '../../types';
import { normalizeImageUrl, VOLUNTEER_FALLBACK_IMAGE_URL } from '../../utils/network';

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
  PhotoReportDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
  ChatDetail: { chatId: number; chatTitle: string; chatType: string };
};

type RouteProps = RouteProp<RootStackParamList, 'VolunteerTaskDetail'>;

export const VolunteerTaskDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;
  const lastTaskMutation = useTaskSyncStore((state) => state.lastMutation);
  const publishTaskMutation = useTaskSyncStore((state) => state.publishTaskMutation);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const fetchTaskDetail = useCallback(async () => {
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
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      fetchTaskDetail();
    }, [fetchTaskDetail])
  );

  useEffect(() => {
    if (!lastTaskMutation || lastTaskMutation.taskId !== taskId) {
      return;
    }

    setTask((current) =>
      current
        ? {
            ...current,
            ...lastTaskMutation.changes,
          }
        : current
    );
  }, [lastTaskMutation, taskId]);

  useEffect(() => {
    setHeroImageIndex(0);
  }, [task?.image, task?.task_image_url, task?.project_cover_image_url]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleAcceptTask = async () => {
    try {
      await volunteerAPI.acceptTask(taskId);
      const acceptedAt = new Date().toISOString();
      const acceptedChanges: Partial<Task> = {
        status: 'in_progress',
        accepted: true,
        accepted_at: acceptedAt,
        can_upload_photo: true,
      };
      setTask((current) => (current ? { ...current, ...acceptedChanges } : current));
      publishTaskMutation({
        taskId,
        reason: 'accepted',
        changes: acceptedChanges,
      });
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
      publishTaskMutation({
        taskId,
        reason: 'declined',
        changes: {
          status: 'rejected',
          accepted: false,
          can_upload_photo: false,
        },
      });
      Alert.alert('Успех', 'Задача отклонена');
      navigation.goBack();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Не удалось отклонить задачу';
      Alert.alert('Ошибка', errorMsg);
    }
  };

  const handleOpenReportDetails = () => {
    navigation.navigate('PhotoReportDetail', { taskId });
  };

  const handleOpenTaskChat = async () => {
    if (!task) {
      return;
    }

    try {
      const response = await volunteerAPI.getChats();
      const chats = response.data?.chats || [];
      const projectChat = chats.find(
        (chat: { id: number; title?: string; chat_type?: string; project_id?: number | null }) =>
          chat.chat_type === 'project' && chat.project_id === task.project_id
      );

      if (!projectChat) {
        Alert.alert('Чат недоступен', 'Для этой задачи активный чат проекта пока не найден.');
        return;
      }

      navigation.navigate('ChatDetail', {
        chatId: projectChat.id,
        chatTitle: projectChat.title || task.project_title || 'Чат проекта',
        chatType: projectChat.chat_type || 'project',
      });
    } catch (error) {
      console.error('Error opening task chat:', error);
      Alert.alert('Ошибка', 'Не удалось открыть чат проекта. Попробуйте ещё раз.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={appColors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={60} color={appColors.textSoft} />
        <Text style={styles.errorText}>Задача не найдена</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Вернуться назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroImageCandidates = Array.from(
    new Set(
      [
        normalizeImageUrl(task.image),
        normalizeImageUrl(task.task_image_url),
        normalizeImageUrl(task.project_cover_image_url),
        VOLUNTEER_FALLBACK_IMAGE_URL,
      ].filter((value): value is string => Boolean(value))
    )
  );
  const imageUrl = heroImageCandidates[heroImageIndex];
  const handleHeroImageError = () => {
    setHeroImageIndex((currentIndex) => {
      if (currentIndex >= heroImageCandidates.length - 1) {
        return heroImageCandidates.length;
      }

      return currentIndex + 1;
    });
  };
  
  // Strict time logic
  const now = new Date();
  const startDate = task.start_date ? new Date(task.start_date) : null;
  if (startDate && task.start_time) {
    const [h, m] = task.start_time.split(':').map(Number);
    startDate.setHours(h, m, 0, 0);
  }
  const endDate = task.end_date ? new Date(task.end_date) : null;
  if (endDate && task.end_time) {
    const [h, m] = task.end_time.split(':').map(Number);
    endDate.setHours(h, m, 0, 0);
  } else if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  const isNotOpenedYet = startDate && now < startDate;
  const isExpired = endDate && now > endDate;
  const taskStatus = task.status || 'open';
  const hasUploadedPhoto = Boolean(task.has_photo_report);
  const isPending = (taskStatus === 'pending' || taskStatus === 'open') && !task.accepted && !isExpired && !isNotOpenedYet;
  const isUnderReviewTask = taskStatus === 'under_review';
  const isRevisionTask = taskStatus === 'revision' || task.photo_status === 'rejected';
  const isCompletedTask = taskStatus === 'completed';
  const isArchivedTask = taskStatus === 'archived';
  const canUploadPhoto =
    Boolean(task.can_upload_photo || taskStatus === 'revision' || (task.accepted && !hasUploadedPhoto && taskStatus === 'in_progress')) &&
    !isArchivedTask &&
    !isNotOpenedYet &&
    !isExpired;
  const uploadButtonText = isRevisionTask ? 'Отправить фотоотчет повторно' : 'Отправить фотоотчет';
  const organizerAvatar = normalizeImageUrl(task.creator_avatar);

  // Formatting dates and times
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'long' });
    const year = date.getFullYear();
    return `${day} ${month} ${year} Рі.`;
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
    const startDate = task.start_date ? new Date(task.start_date) : null;
    const endDate = new Date(task.end_date);
    endDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Если задача еще не началась
    if (startDate) {
      const startDateOnly = new Date(startDate);
      startDateOnly.setHours(0, 0, 0, 0);
      
      const nowStrict = new Date();
      
      if (today < startDateOnly) {
        const diffTimeStart = startDateOnly.getTime() - today.getTime();
        const diffDaysStart = Math.ceil(diffTimeStart / (1000 * 60 * 60 * 24));
        
        let daysWord = 'ДНЕЙ';
        if (diffDaysStart % 10 === 1 && diffDaysStart % 100 !== 11) daysWord = 'ДЕНЬ';
        else if ([2, 3, 4].includes(diffDaysStart % 10) && ![12, 13, 14].includes(diffDaysStart % 100)) daysWord = 'ДНЯ';
        
        return `ОТКРОЕТСЯ ЧЕРЕЗ ${diffDaysStart} ${daysWord}`;
      } else if (today.getTime() === startDateOnly.getTime() && nowStrict < startDate) {
        return `ОТКРОЕТСЯ СЕГОДНЯ В ${formatTimeInfo(task.start_time)}`;
      }
    }

    const diffTime = endDate.getTime() - today.getTime();
    if (diffTime < 0) return 'ИСТЕКЛО';
    
    // Если сегодня последний день
    if (diffTime === 0) return 'СЕГОДНЯ';

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let daysWord = 'ДНЕЙ';
    if (diffDays % 10 === 1 && diffDays % 100 !== 11) daysWord = 'ДЕНЬ';
    else if ([2, 3, 4].includes(diffDays % 10) && ![12, 13, 14].includes(diffDays % 100)) daysWord = 'ДНЯ';
    
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
        <Ionicons key={i} name={i <= rating ? "star" : "star-outline"} size={14} color={appColors.warning} style={{ marginRight: 2 }} />
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={appColors.surface === appColors.white ? 'dark-content' : 'light-content'}
        backgroundColor={appColors.surface}
      />
      
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.appBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={appColors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Детали задачи</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Cover Image */}
          <View style={styles.imageContainer}>
            {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={handleHeroImageError}
            />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: appColors.surfaceMuted, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={40} color={appColors.textSoft} />
            </View>
          )}
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={appColors.primary} />
            <Text style={styles.verifiedText}>Проверено</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>
            {task.title 
              ? (task.title.startsWith('Задача:') ? task.title : `Задача: ${task.title}`)
              : 'Задача без названия'}
          </Text>

          {/* Description */}
          {!!task.description && (
            <Text style={styles.description} numberOfLines={3}>{task.description}</Text>
          )}

          {/* Deadline Card */}
          <View style={styles.deadlineCard}>
            <View style={styles.deadlineTopRow}>
              <View style={styles.deadlineLabelContainer}>
                <Ionicons name="calendar-outline" size={14} color={appColors.primary} />
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

          {/* Task Info (Location) */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={16} color={appColors.primary} />
              <Text style={styles.infoText} numberOfLines={1}>{task.location || 'Место не указано'}</Text>
            </View>
          </View>

          {/* Organized By */}
          <View style={styles.organizerRow}>
            {organizerAvatar ? (
              <Image source={{ uri: organizerAvatar }} style={styles.organizerAvatar} />
            ) : (
              <View style={styles.organizerAvatarFallback}>
                <Ionicons name="person" size={24} color={appColors.textSoft} />
              </View>
            )}
            <View style={styles.organizerInfo}>
              <Text style={styles.organizerLabel}>ОРГАНИЗАТОР</Text>
              <Text style={styles.organizerName}>{task.creator_name || 'Организация'}</Text>
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={handleOpenTaskChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={20} color={appColors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Activity Timeline */}
          <Text style={styles.timelineHeading}>ИСТОРИЯ АКТИВНОСТИ</Text>
          <View style={styles.timeline}>

            {/* 1. Task Created */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: appColors.primary }]}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: appColors.primary }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitleActive}>Задача создана</Text>
                <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.created_at)}</Text>
              </View>
            </View>

            {/* 2. You accepted */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: task.accepted ? appColors.primary : appColors.surfaceMuted }]}>
                  <Ionicons name="checkmark" size={14} color={task.accepted ? appColors.white : appColors.textSoft} />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: task.has_photo_report ? appColors.primary : appColors.surfaceMuted }]} />
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
                <View style={[styles.timelineDot, { backgroundColor: hasUploadedPhoto ? appColors.primary : appColors.surfaceMuted }]}>
                  <Ionicons name="checkmark" size={14} color={hasUploadedPhoto ? appColors.white : appColors.textSoft} />
                </View>
                <View style={[styles.timelineLine, { backgroundColor: (isUnderReviewTask || isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={hasUploadedPhoto ? styles.timelineTitleActive : styles.timelineTitleInactive}>Фотоотчет загружен</Text>
                {task.photo_uploaded_at && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.photo_uploaded_at)}</Text>
                )}
              </View>
            </View>

            {/* 4. Under Review */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: (isUnderReviewTask || isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted,
                    },
                  ]}
                >
                  {(isUnderReviewTask || isRevisionTask || isCompletedTask) ? (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  ) : (
                    <Ionicons name="time" size={14} color={appColors.textSoft} />
                  )}
                </View>
                <View style={[styles.timelineLine, { backgroundColor: (isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={(isUnderReviewTask || isRevisionTask || isCompletedTask) ? styles.timelineTitleActive : styles.timelineTitleInactive}
                >
                  На проверке
                </Text>
                {isUnderReviewTask && (
                  <Text style={styles.timelineSubtitle}>Отчет ожидает решения организатора</Text>
                )}
                {isRevisionTask && (
                  <Text style={styles.timelineSubtitle}>Проверка завершена, требуется доработка</Text>
                )}
                {isCompletedTask && (
                  <Text style={styles.timelineSubtitle}>Фотоотчет успешно принят</Text>
                )}
              </View>
            </View>

            {/* 5. Review Result */}
            <View style={styles.timelineNode}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { 
                  backgroundColor: isCompletedTask ? appColors.primary : isRevisionTask ? appColors.warning : appColors.surfaceMuted,
                }]}>
                  {isCompletedTask ? (
                    <Ionicons name="star" size={12} color="#FFF" />
                  ) : isRevisionTask ? (
                    <Ionicons name="refresh" size={13} color="#FFF" />
                  ) : (
                    <Ionicons name="star-outline" size={12} color={appColors.textSoft} />
                  )}
                </View>
              </View>
              <View style={styles.timelineContent}>
                <Text style={(isCompletedTask || isRevisionTask) ? styles.timelineTitleActive : styles.timelineTitleInactive}>
                  {isCompletedTask ? `Принято с оценкой ${task.rating || 5}` : isRevisionTask ? 'На доработке' : 'Решение организатора'}
                </Text>
                {isRevisionTask ? (
                  <Text style={[styles.timelineSubtitle, { color: '#D97706', marginTop: 2 }]} numberOfLines={2}>
                    Причина: {task.rejection_reason || 'Организатор попросил доработать фотоотчет'}
                  </Text>
                ) : isCompletedTask ? (
                  renderStars(task.rating || 5)
                ) : null}
              </View>
            </View>

          </View>

          {hasUploadedPhoto && (
            <>
              <View style={styles.divider} />

              <TouchableOpacity style={styles.reportDetailsCard} onPress={handleOpenReportDetails} activeOpacity={0.85}>
                <View style={styles.reportDetailsIcon}>
                  <Ionicons name="document-text-outline" size={22} color={appColors.primary} />
                </View>

                <View style={styles.reportDetailsContent}>
                  <Text style={styles.reportDetailsTitle}>Подробная информация об отчете</Text>
                  <Text style={styles.reportDetailsSubtitle}>
                    {isCompletedTask
                      ? 'Отчет одобрен. Откройте карточку с отзывом организатора.'
                      : isRevisionTask
                        ? 'Отчет возвращен на доработку. Откройте причину и комментарий.'
                        : 'Откройте отправленный отчет и текущий статус проверки.'}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Footer Button logic mapped to Activity status */}
      <View style={styles.footerContainer}>
        {isNotOpenedYet ? (
          <TouchableOpacity style={[styles.primaryButtonLarge, { backgroundColor: appColors.textSoft }]} disabled>
            <Ionicons name="time-outline" size={22} color={appColors.white} />
            <Text style={styles.primaryButtonText}>
              Откроется {startDate ? formatTimelineDate(startDate.toISOString()) : ''}
            </Text>
          </TouchableOpacity>
        ) : isExpired && !isCompletedTask ? (
          <TouchableOpacity style={[styles.primaryButtonLarge, { backgroundColor: appColors.textSoft }]} disabled>
            <Ionicons name="close-circle-outline" size={22} color={appColors.white} />
            <Text style={styles.primaryButtonText}>Срок истек</Text>
          </TouchableOpacity>
        ) : isPending ? (
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleDeclineTask}>
              <Text style={styles.secondaryButtonText}>Отклонить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAcceptTask}>
              <Text style={styles.primaryButtonText}>Начать задачу</Text>
            </TouchableOpacity>
          </View>
        ) : canUploadPhoto ? (
          <TouchableOpacity
            style={styles.primaryButtonLarge}
            onPress={() => navigation.navigate('SubmitPhotoReport', { taskId })}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={appColors.white} />
            <Text style={styles.primaryButtonText}>{uploadButtonText}</Text>
          </TouchableOpacity>
        ) : isCompletedTask ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-done-circle" size={24} color={appColors.primary} />
            <Text style={styles.completedBadgeText}>Задача успешно завершена!</Text>
          </View>
        ) : isUnderReviewTask ? (
          <View style={styles.reviewBadge}>
            <Ionicons name="time" size={24} color={appColors.warning} />
            <Text style={styles.reviewBadgeText}>Отчет на проверке</Text>
          </View>
        ) : isArchivedTask ? (
          <View style={[styles.completedBadge, { backgroundColor: appColors.surfaceSoft }]}>
            <Ionicons name="archive-outline" size={24} color={appColors.textMuted} />
            <Text style={[styles.completedBadgeText, { color: appColors.textMuted }]}>Задача в архиве</Text>
          </View>
        ) : hasUploadedPhoto ? (
          <View style={styles.reviewBadge}>
            <Ionicons name="image-outline" size={24} color={appColors.warning} />
            <Text style={styles.reviewBadgeText}>Фотоотчет отправлен</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.surface,
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
    color: appColors.text,
  },
  container: {
    flex: 1,
    backgroundColor: appColors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 148, // Extra space so the report card does not hide behind the footer
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surface,
  },
  errorText: {
    fontSize: 18,
    color: appColors.textSecondary,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  goBackButton: {
    backgroundColor: appColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackButtonText: {
    color: appColors.white,
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
    backgroundColor: appColors.surface,
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
    color: appColors.primary,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  description: {
    fontSize: 15,
    color: appColors.textMuted,
    lineHeight: 24,
    marginBottom: 24,
  },
  deadlineCard: {
    backgroundColor: appColors.primarySurface, // Light green bg
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#065F46',
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
    color: appColors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
   daysLeftPill: {
    backgroundColor: appColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  daysLeftText: {
    color: appColors.white,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  deadlineBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  deadlineDate: {
    fontSize: 16,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 2,
  },
  deadlineTime: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  estimatedTimeLabel: {
    fontSize: 12,
    color: appColors.textMuted,
    marginBottom: 2,
  },
  estimatedTimeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: appColors.text,
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
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  organizerInfo: {
    flex: 1,
  },
  organizerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: appColors.textSoft,
    letterSpacing: 1,
    marginBottom: 2,
  },
  organizerName: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: appColors.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: appColors.surfaceSoft,
    marginBottom: 24,
  },
  timelineHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: appColors.textSoft,
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
    color: appColors.text,
    marginBottom: 2,
  },
  timelineTitleInactive: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.textSoft,
    marginBottom: 2,
  },
  timelineSubtitle: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  reportDetailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: appColors.border,
    padding: 16,
    marginBottom: 20,
  },
  reportDetailsIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  reportDetailsContent: {
    flex: 1,
    paddingRight: 10,
  },
  reportDetailsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 4,
  },
  reportDetailsSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: appColors.textMuted,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32, // Adjust for iPhone notch safely
    backgroundColor: appColors.surface,
    borderTopWidth: 1,
    borderColor: appColors.border,
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
    backgroundColor: appColors.dangerSurface,
    borderWidth: 1,
    borderColor: appColors.danger,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.danger,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.primary,
  },
  primaryButtonLarge: {
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    gap: 8,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
  },
  completedBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: appColors.primarySurface,
    borderRadius: 16,
    gap: 8,
  },
  completedBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.primary,
  },
  reviewBadge: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: appColors.warningSurface,
    borderRadius: 16,
    gap: 8,
  },
  reviewBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.warning,
  },
});
