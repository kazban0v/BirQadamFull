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
  Animated,
  Easing,
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
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { useTranslation } from "../../locales/i18n";

type RootStackParamList = {
  VolunteerTaskDetail: { taskId: number };
  PhotoReportDetail: { taskId: number };
  SubmitPhotoReport: { taskId: number };
  ChatDetail: { chatId: number; chatTitle: string; chatType: string };
};

type RouteProps = RouteProp<RootStackParamList, 'VolunteerTaskDetail'>;

// ─── Premium Timeline Components ─────────────────────────────────────────────

const TIMELINE_NODES = 5;

/** Dot with double-ring pulse + glow shadow for a premium look */
const PremiumDot: React.FC<{
  color: string;
  /** Continuously pulsing ring (e.g. the current active step) */
  isLive: boolean;
  /** Glowing solid ring shown once for completed steps */
  isCompleted: boolean;
  children: React.ReactNode;
}> = ({ color, isLive, isCompleted, children }) => {
    const { t } = useTranslation();
  // Outer ring — slow, dreamy fade
  const ring1Scale = React.useRef(new Animated.Value(1)).current;
  const ring1Opacity = React.useRef(new Animated.Value(0.45)).current;
  // Inner ring — faster, snappier
  const ring2Scale = React.useRef(new Animated.Value(1)).current;
  const ring2Opacity = React.useRef(new Animated.Value(0.25)).current;

  React.useEffect(() => {
    if (!isLive) return;

    const outerLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1Scale, { toValue: 2.6, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring1Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ring1Opacity, { toValue: 0, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0.45, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    const innerLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring2Scale, { toValue: 1.75, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ring2Opacity, { toValue: 0, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ring2Opacity, { toValue: 0.25, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    // Stagger the two rings so they feel independent
    outerLoop.start();
    setTimeout(() => innerLoop.start(), 500);

    return () => {
      outerLoop.stop();
      innerLoop.stop();
    };
  }, [isLive]);

  const dotSize = 26;
  const dotRadius = dotSize / 2;

  return (
    <View style={{ width: dotSize, height: dotSize, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer glow ring */}
      {(isLive || isCompleted) && (
        <Animated.View
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            borderRadius: dotRadius,
            backgroundColor: color,
            transform: [{ scale: isLive ? ring1Scale : 1 }],
            opacity: isLive ? ring1Opacity : 0.18,
          }}
        />
      )}
      {/* Inner ring */}
      {isLive && (
        <Animated.View
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            borderRadius: dotRadius,
            backgroundColor: color,
            transform: [{ scale: ring2Scale }],
            opacity: ring2Opacity,
          }}
        />
      )}
      {/* Core dot with shadow glow */}
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotRadius,
          backgroundColor: color,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 3,
          // iOS glow
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isCompleted || isLive ? 0.75 : 0,
          shadowRadius: isCompleted || isLive ? 8 : 0,
          // Android elevation
          elevation: isCompleted || isLive ? 6 : 0,
        }}
      >
        {/* Subtle inner highlight (top-left gloss) */}
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 5,
            width: 8,
            height: 5,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        />
        {children}
      </View>
    </View>
  );
};

/** Animated line that draws itself from top to bottom + travelling shimmer */
const AnimatedLine: React.FC<{
  color: string;
  isActive: boolean;
  drawProgress: Animated.Value;
}> = ({ color, isActive, drawProgress }) => {
  const shimmerY = React.useRef(new Animated.Value(-50)).current;

  React.useEffect(() => {
    if (!isActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerY, {
          toValue: 60,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerY, { toValue: -50, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive]);

  const scaleY = drawProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        premiumLineStyle,
        {
          backgroundColor: color,
          transform: [{ scaleY }, { translateY: -999 }, { translateY: 999 }], // origin top
        },
      ]}
    >
      {isActive && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 18,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.5)',
            transform: [{ translateY: shimmerY }],
          }}
        />
      )}
    </Animated.View>
  );
};

// Shared style objects referenced before StyleSheet.create
const timelineDotStyle = {
  width: 26,
  height: 26,
  borderRadius: 13,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  zIndex: 2,
};
const premiumLineStyle = {
  width: 2,
  flex: 1,
  marginTop: -2,
  marginBottom: -2,
  zIndex: 1,
  overflow: 'hidden' as const,
};

// ─────────────────────────────────────────────────────────────────────────────

export const VolunteerTaskDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<any>();
  const { t, language } = useTranslation();
  const localeTag = language === 'en' ? 'en-US' : language === 'kk' ? 'kk-KZ' : 'ru-RU';
  const { taskId } = route.params;
  const lastTaskMutation = useTaskSyncStore((state) => state.lastMutation);
  const publishTaskMutation = useTaskSyncStore((state) => state.publishTaskMutation);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  // ── Premium timeline entrance animations ─────────────────────────────────
  const nodeAnims = React.useRef(
    Array.from({ length: TIMELINE_NODES }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(22),
      scale: new Animated.Value(0.88),
      dotScale: new Animated.Value(0),
      lineProgress: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!task) return;

    nodeAnims.forEach((a) => {
      a.opacity.setValue(0);
      a.translateY.setValue(22);
      a.scale.setValue(0.88);
      a.dotScale.setValue(0);
      a.lineProgress.setValue(0);
    });

    // Staggered float-up entrance — deliberate, luxurious pace
    Animated.stagger(
      150,
      nodeAnims.map((a) =>
        Animated.parallel([
          Animated.timing(a.opacity, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(a.translateY, {
            toValue: 0,
            duration: 560,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }),
          Animated.timing(a.scale, {
            toValue: 1,
            duration: 560,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }),
          // Dot springs in with overshoot
          Animated.spring(a.dotScale, {
            toValue: 1,
            tension: 100,
            friction: 7,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();

    // Lines draw themselves after their dot appears
    nodeAnims.forEach((a, i) => {
      Animated.timing(a.lineProgress, {
        toValue: 1,
        duration: 500,
        delay: i * 150 + 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  }, [task]);
  // ─────────────────────────────────────────────────────────────────────────

  const fetchTaskDetail = useCallback(async () => {
    try {
      const response = await volunteerAPI.getTaskDetail(taskId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTask(response.data);
    } catch (error: unknown) {
      Alert.alert(t('volunteertaskdetail.s_0'), getAxiosErrorMessage(error, t('volunteertaskdetail.s_1')));
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
      Alert.alert(t('volunteertaskdetail.s_2'), t('volunteertaskdetail.s_3'));
      fetchTaskDetail();
    } catch (error: unknown) {
      const errorMsg = getAxiosErrorMessage(error, t('volunteertaskdetail.s_4'));
      Alert.alert(t('volunteertaskdetail.s_5'), errorMsg);
    }
  };

  const handleDeclineTask = async () => {
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
      Alert.alert(t('volunteertaskdetail.s_6'), t('volunteertaskdetail.s_7'));
      navigation.goBack();
    } catch (error: unknown) {
      const errorMsg = getAxiosErrorMessage(error, t('volunteertaskdetail.s_8'));
      Alert.alert(t('volunteertaskdetail.s_9'), errorMsg);
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
        Alert.alert(t('volunteertaskdetail.s_10'), t('volunteertaskdetail.s_11'));
        return;
      }

      navigation.navigate('ChatDetail', {
        chatId: projectChat.id,
        chatTitle: projectChat.title || task.project_title || t('volunteertaskdetail.s_12'),
        chatType: projectChat.chat_type || 'project',
      });
    } catch (error) {
      console.error('Error opening task chat:', error);
      Alert.alert(t('volunteertaskdetail.s_13'), t('volunteertaskdetail.s_14'));
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
        <Text style={styles.errorText}>{t('volunteertaskdetail.s_15')}</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>{t('volunteertaskdetail.s_16')}</Text>
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
  const isDeclinedTask =
    taskStatus === 'archived' &&
    !task.accepted &&
    !hasUploadedPhoto &&
    !isCompletedTask &&
    !isRevisionTask;
  const canUploadPhoto =
    Boolean(task.can_upload_photo || taskStatus === 'revision' || (task.accepted && !hasUploadedPhoto && taskStatus === 'in_progress')) &&
    !isArchivedTask &&
    !isNotOpenedYet &&
    !isExpired;
  const uploadButtonText = isRevisionTask ? t('volunteertaskdetail.s_17') : t('volunteertaskdetail.s_18');
  const organizerAvatar = normalizeImageUrl(task.creator_avatar);

  // Formatting dates and times
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(localeTag, { day: 'numeric', month: 'long', year: 'numeric' });
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
    const timeStr = dateObj.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (isToday) return t('volunteertaskdetail.s_77', { time: timeStr });
    return `${dateObj.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })}, ${timeStr}`;
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
        
        let daysWord = t('volunteertaskdetail.s_19');
        if (diffDaysStart % 10 === 1 && diffDaysStart % 100 !== 11) daysWord = t('volunteertaskdetail.s_20');
        else if ([2, 3, 4].includes(diffDaysStart % 10) && ![12, 13, 14].includes(diffDaysStart % 100)) daysWord = t('volunteertaskdetail.s_21');
        
        return t('volunteertaskdetail.s_69', { count: diffDaysStart, unit: daysWord });
      } else if (today.getTime() === startDateOnly.getTime() && nowStrict < startDate) {
        return t('volunteertaskdetail.s_70', { time: formatTimeInfo(task.start_time) });
      }
    }

    const diffTime = endDate.getTime() - today.getTime();
    if (diffTime < 0) return t('volunteertaskdetail.s_22');
    
    // Если сегодня последний день
    if (diffTime === 0) return t('volunteertaskdetail.s_23');

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    let daysWord = t('volunteertaskdetail.s_24');
    if (diffDays % 10 === 1 && diffDays % 100 !== 11) daysWord = t('volunteertaskdetail.s_25');
    else if ([2, 3, 4].includes(diffDays % 10) && ![12, 13, 14].includes(diffDays % 100)) daysWord = t('volunteertaskdetail.s_26');
    
    return t('volunteertaskdetail.s_71', { count: diffDays, unit: daysWord });
  };

  const getEstimatedTime = () => {
    if (task.start_time && task.end_time) {
      const [startH, startM] = task.start_time.split(':').map(Number);
      const [endH, endM] = task.end_time.split(':').map(Number);
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff < 0) diff += 24 * 60; // Cross midnight
      const hours = Math.round(diff / 60);

      let hoursWord = t('volunteertaskdetail.s_27');
      if (hours === 1) hoursWord = t('volunteertaskdetail.s_28');
      else if ([2, 3, 4].includes(hours)) hoursWord = t('volunteertaskdetail.s_29');

      return `${hours} ${hoursWord}`;
    }
    return t('volunteertaskdetail.s_30');
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
        <Text style={styles.appBarTitle}>{t('volunteertaskdetail.s_31')}</Text>
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
            <Text style={styles.verifiedText}>{t('volunteertaskdetail.s_32')}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>
            {task.title 
              ? (task.title.startsWith(t('volunteertaskdetail.s_33')) ? task.title : `${t('volunteertaskdetail.s_33')} ${task.title}`)
              : t('volunteertaskdetail.s_34')}
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
                <Text style={styles.deadlineLabel}>{t('volunteertaskdetail.s_35')}</Text>
              </View>
              <View style={styles.daysLeftPill}>
                <Text style={styles.daysLeftText}>{getDaysLeft()}</Text>
              </View>
            </View>
            <View style={styles.deadlineBottomRow}>
              <View>
                <Text style={styles.deadlineDate}>{formatDate(task.end_date)}</Text>
                <Text style={styles.deadlineTime}>
                  {task.start_time ? t('volunteertaskdetail.s_78', { time: formatTimeInfo(task.start_time) }) : ''}
                  {task.end_time ? t('volunteertaskdetail.s_79', { time: formatTimeInfo(task.end_time) }) : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 12 }}>
                <Text style={[styles.estimatedTimeLabel, { textAlign: 'right', fontSize: 10, lineHeight: 12 }]} numberOfLines={2}>{t('volunteertaskdetail.s_36')}</Text>
                <Text style={styles.estimatedTimeValue}>{getEstimatedTime()}</Text>
              </View>
            </View>
          </View>

          {/* Task Info (Location) */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={16} color={appColors.primary} />
              <Text style={styles.infoText} numberOfLines={1}>{task.location || t('volunteertaskdetail.s_37')}</Text>
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
              <Text style={styles.organizerLabel}>{t('volunteertaskdetail.s_38')}</Text>
              <Text style={styles.organizerName}>{task.creator_name || t('volunteertaskdetail.s_39')}</Text>
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={handleOpenTaskChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-outline" size={20} color={appColors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Activity Timeline */}
          <Text style={styles.timelineHeading}>{t('volunteertaskdetail.s_40')}</Text>
          <View style={styles.timeline}>

            {/* 1. Task Created */}
            <Animated.View
              style={[styles.timelineNode, {
                opacity: nodeAnims[0].opacity,
                transform: [
                  { translateY: nodeAnims[0].translateY },
                  { scale: nodeAnims[0].scale },
                ],
              }]}
            >
              <View style={styles.timelineIndicatorColumn}>
                <Animated.View style={{ transform: [{ scale: nodeAnims[0].dotScale }] }}>
                  <PremiumDot color={appColors.primary} isLive={true} isCompleted={true}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </PremiumDot>
                </Animated.View>
                <AnimatedLine
                  color={appColors.primary}
                  isActive={true}
                  drawProgress={nodeAnims[0].lineProgress}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitleActive}>{t('volunteertaskdetail.s_41')}</Text>
                <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.created_at)}</Text>
              </View>
            </Animated.View>

            {/* 2. You accepted / declined */}
            <Animated.View
              style={[styles.timelineNode, {
                opacity: nodeAnims[1].opacity,
                transform: [
                  { translateY: nodeAnims[1].translateY },
                  { scale: nodeAnims[1].scale },
                ],
              }]}
            >
              <View style={styles.timelineIndicatorColumn}>
                <Animated.View style={{ transform: [{ scale: nodeAnims[1].dotScale }] }}>
                  <PremiumDot
                    color={
                      isDeclinedTask ? appColors.danger
                        : task.accepted ? appColors.primary
                        : appColors.surfaceMuted
                    }
                    isLive={false}
                    isCompleted={Boolean(task.accepted) && !isDeclinedTask}
                  >
                    <Ionicons
                      name={isDeclinedTask ? 'close' : 'checkmark'}
                      size={14}
                      color={(task.accepted || isDeclinedTask) ? appColors.white : appColors.textSoft}
                    />
                  </PremiumDot>
                </Animated.View>
                <AnimatedLine
                  color={!isDeclinedTask && task.has_photo_report ? appColors.primary : appColors.surfaceMuted}
                  isActive={!isDeclinedTask && Boolean(task.has_photo_report)}
                  drawProgress={nodeAnims[1].lineProgress}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={
                    isDeclinedTask ? styles.timelineTitleDeclined
                      : task.accepted ? styles.timelineTitleActive
                      : styles.timelineTitleInactive
                  }
                >
                  {isDeclinedTask
                    ? t('volunteertaskdetail.s_65')
                    : task.accepted
                      ? t('volunteertaskdetail.s_42')
                      : t('volunteertaskdetail.s_66')}
                </Text>
                {task.accepted_at && task.accepted && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.accepted_at)}</Text>
                )}
              </View>
            </Animated.View>

            {/* 3. Photo uploaded */}
            <Animated.View
              style={[styles.timelineNode, {
                opacity: nodeAnims[2].opacity,
                transform: [
                  { translateY: nodeAnims[2].translateY },
                  { scale: nodeAnims[2].scale },
                ],
              }]}
            >
              <View style={styles.timelineIndicatorColumn}>
                <Animated.View style={{ transform: [{ scale: nodeAnims[2].dotScale }] }}>
                  <PremiumDot
                    color={hasUploadedPhoto ? appColors.primary : appColors.surfaceMuted}
                    isLive={false}
                    isCompleted={hasUploadedPhoto}
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={hasUploadedPhoto ? appColors.white : appColors.textSoft}
                    />
                  </PremiumDot>
                </Animated.View>
                <AnimatedLine
                  color={(isUnderReviewTask || isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted}
                  isActive={isUnderReviewTask || isRevisionTask || isCompletedTask}
                  drawProgress={nodeAnims[2].lineProgress}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text style={hasUploadedPhoto ? styles.timelineTitleActive : styles.timelineTitleInactive}>
                  {t('volunteertaskdetail.s_44')}</Text>
                {task.photo_uploaded_at && (
                  <Text style={styles.timelineSubtitle}>{formatTimelineDate(task.photo_uploaded_at)}</Text>
                )}
              </View>
            </Animated.View>

            {/* 4. Under Review */}
            <Animated.View
              style={[styles.timelineNode, {
                opacity: nodeAnims[3].opacity,
                transform: [
                  { translateY: nodeAnims[3].translateY },
                  { scale: nodeAnims[3].scale },
                ],
              }]}
            >
              <View style={styles.timelineIndicatorColumn}>
                <Animated.View style={{ transform: [{ scale: nodeAnims[3].dotScale }] }}>
                  <PremiumDot
                    color={(isUnderReviewTask || isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted}
                    isLive={isUnderReviewTask}
                    isCompleted={isRevisionTask || isCompletedTask}
                  >
                    {(isUnderReviewTask || isRevisionTask || isCompletedTask)
                      ? <Ionicons name="checkmark" size={14} color="#FFF" />
                      : <Ionicons name="time" size={14} color={appColors.textSoft} />
                    }
                  </PremiumDot>
                </Animated.View>
                <AnimatedLine
                  color={(isRevisionTask || isCompletedTask) ? appColors.primary : appColors.surfaceMuted}
                  isActive={isRevisionTask || isCompletedTask}
                  drawProgress={nodeAnims[3].lineProgress}
                />
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={(isUnderReviewTask || isRevisionTask || isCompletedTask) ? styles.timelineTitleActive : styles.timelineTitleInactive}
                >
                  {t('volunteertaskdetail.s_45')}</Text>
                {isUnderReviewTask && <Text style={styles.timelineSubtitle}>{t('volunteertaskdetail.s_46')}</Text>}
                {isRevisionTask && <Text style={styles.timelineSubtitle}>{t('volunteertaskdetail.s_47')}</Text>}
                {isCompletedTask && <Text style={styles.timelineSubtitle}>{t('volunteertaskdetail.s_48')}</Text>}
              </View>
            </Animated.View>

            {/* 5. Review Result */}
            <Animated.View
              style={[styles.timelineNode, {
                opacity: nodeAnims[4].opacity,
                transform: [
                  { translateY: nodeAnims[4].translateY },
                  { scale: nodeAnims[4].scale },
                ],
              }]}
            >
              <View style={styles.timelineIndicatorColumn}>
                <Animated.View style={{ transform: [{ scale: nodeAnims[4].dotScale }] }}>
                  <PremiumDot
                    color={
                      isCompletedTask ? '#F0B429'
                        : isRevisionTask ? appColors.warning
                        : appColors.surfaceMuted
                    }
                    isLive={false}
                    isCompleted={isCompletedTask || isRevisionTask}
                  >
                    {isCompletedTask
                      ? <Ionicons name="star" size={12} color="#FFF" />
                      : isRevisionTask
                        ? <Ionicons name="refresh" size={13} color="#FFF" />
                        : <Ionicons name="star-outline" size={12} color={appColors.textSoft} />
                    }
                  </PremiumDot>
                </Animated.View>
              </View>
              <View style={styles.timelineContent}>
                <Text
                  style={[
                    (isCompletedTask || isRevisionTask) ? styles.timelineTitleActive : styles.timelineTitleInactive,
                    isCompletedTask ? { color: '#F0B429' } : {},
                  ]}
                >
                  {isCompletedTask
                    ? t('volunteertaskdetail.s_68', { rating: task.rating || 5 })
                    : isRevisionTask ? t('volunteertaskdetail.s_49')
                    : t('volunteertaskdetail.s_50')}
                </Text>
                {isRevisionTask ? (
                  <Text style={[styles.timelineSubtitle, { color: '#D97706', marginTop: 2 }]} numberOfLines={2}>
                    {t('volunteertaskdetail.s_51')}{task.rejection_reason || t('volunteertaskdetail.s_52')}
                  </Text>
                ) : isCompletedTask ? (
                  renderStars(task.rating || 5)
                ) : null}
              </View>
            </Animated.View>

          </View>

          {hasUploadedPhoto && (
            <>
              <View style={styles.divider} />

              <TouchableOpacity style={styles.reportDetailsCard} onPress={handleOpenReportDetails} activeOpacity={0.85}>
                <View style={styles.reportDetailsIcon}>
                  <Ionicons name="document-text-outline" size={22} color={appColors.primary} />
                </View>

                <View style={styles.reportDetailsContent}>
                  <Text style={styles.reportDetailsTitle}>{t('volunteertaskdetail.s_53')}</Text>
                  <Text style={styles.reportDetailsSubtitle}>
                    {isCompletedTask
                      ? t('volunteertaskdetail.s_54')
                      : isRevisionTask
                        ? t('volunteertaskdetail.s_55')
                        : t('volunteertaskdetail.s_56')}
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
              {t('volunteertaskdetail.s_57')}{startDate ? formatTimelineDate(startDate.toISOString()) : ''}
            </Text>
          </TouchableOpacity>
        ) : isExpired && !isCompletedTask ? (
          <TouchableOpacity style={[styles.primaryButtonLarge, { backgroundColor: appColors.textSoft }]} disabled>
            <Ionicons name="close-circle-outline" size={22} color={appColors.white} />
            <Text style={styles.primaryButtonText}>{t('volunteertaskdetail.s_58')}</Text>
          </TouchableOpacity>
        ) : isPending ? (
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleDeclineTask}>
              <Text style={styles.secondaryButtonText}>{t('volunteertaskdetail.s_58')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAcceptTask}>
              <Text style={styles.primaryButtonText}>{t('volunteertaskdetail.s_59')}</Text>
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
            <Text style={styles.completedBadgeText}>{t('volunteertaskdetail.s_60')}</Text>
          </View>
        ) : isUnderReviewTask ? (
          <View style={styles.reviewBadge}>
            <Ionicons name="time" size={24} color={appColors.warning} />
            <Text style={styles.reviewBadgeText}>{t('volunteertaskdetail.s_61')}</Text>
          </View>
        ) : isDeclinedTask ? (
          <View style={[styles.completedBadge, { backgroundColor: appColors.dangerSurface }]}>
            <Ionicons name="close-circle-outline" size={24} color={appColors.danger} />
            <Text style={[styles.completedBadgeText, { color: appColors.danger }]}>{t('volunteertaskdetail.s_67')}</Text>
          </View>
        ) : isArchivedTask ? (
          <View style={[styles.completedBadge, { backgroundColor: appColors.surfaceSoft }]}>
            <Ionicons name="archive-outline" size={24} color={appColors.textMuted} />
            <Text style={[styles.completedBadgeText, { color: appColors.textMuted }]}>{t('volunteertaskdetail.s_62')}</Text>
          </View>
        ) : hasUploadedPhoto ? (
          <View style={styles.reviewBadge}>
            <Ionicons name="image-outline" size={24} color={appColors.warning} />
            <Text style={styles.reviewBadgeText}>{t('volunteertaskdetail.s_63')}</Text>
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
    width: 28,
    marginRight: 14,
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
  timelineTitleDeclined: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.danger,
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
