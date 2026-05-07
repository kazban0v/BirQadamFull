import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  Switch,
  Platform,
  DevSettings,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { volunteerAPI } from '../../services/api';
import type { Project, Task, User } from '../../types';
import { LearningProgressStorage } from '../../utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { appColors } from '../../theme';
import { normalizeImageUrl } from '../../utils/network';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import {
  NextBestActionCard,
  type NextBestActionCardData,
} from '../../components/profile/NextBestActionCard';
import { setLanguage } from '../../locales/i18n';

const { width } = Dimensions.get('window');

interface VolunteerProfileScreenProps {
  navigation: any;
}

type MetricInfoKey = 'points' | 'trust_factor' | 'photo_rating';

const METRIC_INFO_CONTENT: Record<
  MetricInfoKey,
  {
    title: string;
    description: string;
    facts: string[];
    tip?: string;
  }
> = {
  points: {
    title: 'Как работают баллы?',
    description: 'Баллы показывают ваш общий прогресс и активность в приложении.',
    facts: [
      'Баллы растут по мере выполнения задач и участия в проектах.',
      'По количеству баллов видно, как вы продвигаетесь по уровню.',
      'Баллы помогают отслеживать общий путь волонтёра внутри приложения.',
    ],
    tip: 'Чем стабильнее участие в задачах и проектах, тем быстрее растёт ваш прогресс.',
  },
  trust_factor: {
    title: 'Как работает фактор доверия?',
    description: 'Фактор доверия показывает, насколько вы надёжны как волонтёр.',
    facts: [
      'После хороших оценок фотоотчётов фактор доверия растёт.',
      'При отклонении отчёта или возврате на доработку он может снижаться.',
      'Высокий фактор доверия помогает поддерживать сильную репутацию в системе.',
    ],
    tip: 'Качественные фотоотчёты и аккуратное завершение задач помогают повышать фактор доверия.',
  },
  photo_rating: {
    title: 'Как работает фото-рейтинг?',
    description: 'Фото-рейтинг — это средняя оценка ваших фотоотчётов от организаторов.',
    facts: [
      'Организатор оценивает фотоотчёт после проверки результата задачи.',
      'Чем выше оценка фотоотчётов, тем лучше это влияет на фактор доверия.',
      'Понятные и качественные фотографии обычно получают более высокий рейтинг.',
    ],
    tip: 'Старайтесь загружать чёткие фото, где хорошо видно итог выполненной работы.',
  },
};

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

const getAvatarExtension = (asset: ImagePicker.ImagePickerAsset) => {
  const fromName = asset.fileName?.split('.').pop();
  if (fromName) {
    return fromName.toLowerCase();
  }

  const fromUri = asset.uri.split('.').pop();
  if (fromUri) {
    return fromUri.toLowerCase();
  }

  if (asset.mimeType === 'image/png') {
    return 'png';
  }

  return 'jpg';
};

const getAvatarMimeType = (asset: ImagePicker.ImagePickerAsset) => asset.mimeType || 'image/jpeg';

const getAvatarFileName = (asset: ImagePicker.ImagePickerAsset) =>
  asset.fileName || `avatar-${Date.now()}.${getAvatarExtension(asset)}`;

const normalizeProjectsPayload = (payload: any): Project[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload?.projects) ? payload.projects : [];
};

const normalizeTasksPayload = (payload: any): Task[] => {
  const tasksData = Array.isArray(payload) ? payload : payload?.tasks || [];

  return tasksData.map((item: any) => ({
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
};

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

const isTaskExpired = (task: Pick<Task, 'status' | 'end_date' | 'end_time' | 'is_expired'>) => {
  if (task.status === 'expired' || task.is_expired) {
    return true;
  }

  const deadline = parseTaskDeadline(task.end_date, task.end_time);
  return Boolean(deadline && Date.now() > deadline.getTime());
};

const formatActionDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
};

const getTaskSortTime = (task: Task) => {
  const rawValue = task.end_date || task.start_date || task.created_at;
  if (!rawValue) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parsed = new Date(rawValue).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const isActionablePhotoTask = (task: Task) =>
  Boolean(
    !isTaskExpired(task) &&
      (
        task.status === 'revision' ||
        task.photo_status === 'rejected' ||
        task.can_upload_photo ||
        (task.accepted && task.status === 'in_progress' && !task.has_photo_report)
      )
  );

const isReviewTask = (task: Task) =>
  Boolean(task.has_photo_report && (task.status === 'under_review' || task.photo_status === 'pending'));

const isActiveTask = (task: Task) =>
  Boolean(
    !isTaskExpired(task) &&
      (task.accepted || task.status === 'in_progress' || task.status === 'active') &&
      !['completed', 'under_review', 'archived', 'failed', 'closed', 'revision', 'expired'].includes(task.status)
  );

export const VolunteerProfileScreen: React.FC<VolunteerProfileScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile } = useAuthStore();
  const { isDarkTheme, toggleTheme } = useThemeStore();
  const [profileData, setProfileData] = useState<User | null>(user);
  const [projectsContext, setProjectsContext] = useState<Project[]>([]);
  const [tasksContext, setTasksContext] = useState<Task[]>([]);
  const [isActionContextLoading, setIsActionContextLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarCacheKey, setAvatarCacheKey] = useState(0);
  const [activeMetricInfo, setActiveMetricInfo] = useState<MetricInfoKey | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsActionContextLoading(true);

    try {
      const [profileResult, projectsResult, tasksResult] = await Promise.allSettled([
        volunteerAPI.getProfile(),
        volunteerAPI.getProjects(),
        volunteerAPI.getTasks(),
      ]);

      if (profileResult.status === 'fulfilled') {
        setProfileData(profileResult.value.data);
      } else {
        console.error('Error fetching profile:', profileResult.reason);
      }

      if (projectsResult.status === 'fulfilled') {
        setProjectsContext(normalizeProjectsPayload(projectsResult.value.data));
      } else {
        console.error('Error fetching projects for profile action card:', projectsResult.reason);
        setProjectsContext([]);
      }

      if (tasksResult.status === 'fulfilled') {
        setTasksContext(normalizeTasksPayload(tasksResult.value.data));
      } else {
        console.error('Error fetching tasks for profile action card:', tasksResult.reason);
        setTasksContext([]);
      }
    } finally {
      setIsActionContextLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее, чтобы выбрать новую аватарку.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const selectedImage = result.assets[0];
    if (selectedImage.fileSize && selectedImage.fileSize > MAX_AVATAR_SIZE_BYTES) {
      Alert.alert('Файл слишком большой', 'Размер аватарки не должен превышать 2 МБ.');
      return;
    }

    const formData = new FormData();
    const fileName = getAvatarFileName(selectedImage);
    const mimeType = getAvatarMimeType(selectedImage);

    if (Platform.OS === 'web') {
      // На вебе нужно получить Blob из URI и создать File
      try {
        const response = await fetch(selectedImage.uri);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: mimeType });
        formData.append('avatar', file);
      } catch (e) {
        Alert.alert('Ошибка', 'Не удалось обработать изображение.');
        return;
      }
    } else {
      // На нативных платформах используем стандартный формат RN
      formData.append('avatar', {
        uri: selectedImage.uri,
        name: fileName,
        type: mimeType,
      } as any);
    }

    setIsUploadingAvatar(true);
    try {
      await updateProfile(formData);
      await fetchProfile();
      setAvatarCacheKey(Date.now());
      Alert.alert('Успешно', 'Аватар профиля обновлён.');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось загрузить аватарку.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => await logout() },
    ]);
  };

  const openMetricInfo = useCallback((metric: MetricInfoKey) => {
    setActiveMetricInfo(metric);
  }, []);

  const closeMetricInfo = useCallback(() => {
    setActiveMetricInfo(null);
  }, []);

  const showInDevelopmentAlert = (featureName: string) => {
    Alert.alert('В разработке', `Функция «${featureName}» находится в разработке и будет доступна скоро.`);
  };

  const reloadApp = useCallback(() => {
    if (__DEV__ && typeof DevSettings.reload === 'function') {
      setTimeout(() => DevSettings.reload(), 180);
      return;
    }

    Alert.alert('Готово', 'Изменения применятся после перезапуска приложения.');
  }, []);

  const handleThemeToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await toggleTheme(enabled);
        reloadApp();
      } catch (error) {
        Alert.alert('Ошибка', 'Не удалось сохранить тему. Попробуйте ещё раз.');
      }
    },
    [reloadApp, toggleTheme]
  );



  const onMenuItemPress = (id: string) => {
    switch (id) {
      case 'edit_profile':
        navigation.navigate('EditVolunteerProfile' as never);
        break;
      case 'change_password':
        navigation.navigate('ChangePassword' as never);
        break;
      case 'stats':
        navigation.navigate('VolunteerAchievements' as never);
        break;
      case 'notifications':
        navigation.navigate('VolunteerNotifications' as never);
        break;
      case 'language':
        Alert.alert(
          'Выбор языка',
          'Выберите язык приложения',
          [
            { text: 'Русский', onPress: async () => { await setLanguage('ru'); reloadApp(); } },
            { text: 'Қазақша', onPress: async () => { await setLanguage('kk'); reloadApp(); } },
            { text: 'English', onPress: async () => { await setLanguage('en'); reloadApp(); } },
            { text: 'Отмена', style: 'cancel' }
          ]
        );
        break;

      case 'about':
        navigation.navigate('AboutApp' as never);
        break;
      case 'help':
        navigation.navigate('VolunteerHelp' as never);
        break;
      case 'link_telegram':
        showInDevelopmentAlert('Подключение Telegram');
        break;
      default:
        console.log('Menu item pressed:', id);
    }
  };

  // Расчет прогресса уровня
  const currentPoints = profileData?.rating || 0;
  const maxRating = 750;
  const levelThreshold = 100;
  const rawNextTarget = (Math.floor(currentPoints / levelThreshold) + 1) * levelThreshold;
  const nextTarget = Math.min(rawNextTarget, maxRating);
  const previousTarget = nextTarget - levelThreshold;
  const span = nextTarget - previousTarget;
  const pointsInCurrentLevel = currentPoints - previousTarget;
  const progress = Math.min((pointsInCurrentLevel / span) * 100, 100);
  const pointsToNext = Math.max(nextTarget - currentPoints, 0);
  const normalizedAvatarUri = normalizeImageUrl(profileData?.avatar);
  const avatarUri = normalizedAvatarUri
    ? `${normalizedAvatarUri}${normalizedAvatarUri.includes('?') ? '&' : '?'}t=${avatarCacheKey}`
    : null;
  const metricInfo = activeMetricInfo ? METRIC_INFO_CONTENT[activeMetricInfo] : null;
  const profileChecklist = useMemo(
    () => [
      { label: 'имя', completed: Boolean(profileData?.full_name?.trim()) },
      { label: 'телефон', completed: Boolean(profileData?.phone_number?.trim()) },
      { label: 'email', completed: Boolean(profileData?.email?.trim()) },
    ],
    [profileData?.email, profileData?.full_name, profileData?.phone_number]
  );
  const missingProfileFields = useMemo(
    () => profileChecklist.filter((item) => !item.completed).map((item) => item.label),
    [profileChecklist]
  );
  const isProfileComplete = missingProfileFields.length === 0;
  const joinedProjects = useMemo(
    () => projectsContext.filter((project) => project.joined && isProjectCurrentlyActive(project)),
    [projectsContext]
  );
  const availableProjects = useMemo(
    () => projectsContext.filter((project) => !project.joined && isProjectCurrentlyActive(project)),
    [projectsContext]
  );
  const sortedTasks = useMemo(
    () => [...tasksContext].sort((left, right) => getTaskSortTime(left) - getTaskSortTime(right)),
    [tasksContext]
  );
  const reportTask = useMemo(
    () => sortedTasks.find((task) => isActionablePhotoTask(task)),
    [sortedTasks]
  );
  const reviewTask = useMemo(
    () =>
      sortedTasks.find(
        (task) => task.id !== reportTask?.id && isReviewTask(task)
      ),
    [reportTask?.id, sortedTasks]
  );
  const activeTask = useMemo(
    () =>
      sortedTasks.find(
        (task) =>
          task.id !== reportTask?.id &&
          task.id !== reviewTask?.id &&
          isActiveTask(task)
      ),
    [reportTask?.id, reviewTask?.id, sortedTasks]
  );
  const nextBestAction = useMemo<NextBestActionCardData>(() => {
    if (!isProfileComplete) {
      return {
        id: 'complete-profile',
        badge: 'Профиль',
        title: 'Дополните профиль',
        description:
          'Заполненный профиль помогает организаторам быстрее доверять вам и связываться по важным деталям проекта.',
        icon: 'person-circle-outline',
        accentColor: appColors.info,
        accentSurface: appColors.surfaceSoft,
        ctaLabel: 'Редактировать',
        ctaIcon: 'create-outline',
        highlights: [
          `Готово ${profileChecklist.filter((item) => item.completed).length}/${profileChecklist.length}`,
          `Не хватает: ${missingProfileFields.join(', ')}`,
        ],
        onPress: () => navigation.navigate('EditVolunteerProfile' as never),
      };
    }

    if (!joinedProjects.length) {
      return {
        id: 'join-first-project',
        badge: 'Проекты',
        title: 'Найдите первый проект',
        description:
          'После вступления в проект у вас откроются реальные задачи, календарь и следующая ступень прогресса.',
        icon: 'compass-outline',
        accentColor: appColors.primary,
        accentSurface: appColors.primarySurface,
        ctaLabel: 'Открыть проекты',
        ctaIcon: 'arrow-forward',
        secondaryLabel: 'На главную',
        highlights: [
          `${availableProjects.length} доступных проектов`,
          'Подберите направление по интересам',
        ],
        onPress: () => navigation.navigate('VolunteerProjects' as never),
        onSecondaryPress: () => navigation.navigate('HomeTab' as never),
      };
    }

    if (reportTask) {
      const isRevision = reportTask.status === 'revision' || reportTask.photo_status === 'rejected';
      const dueDateLabel = formatActionDate(reportTask.end_date || reportTask.start_date);

      return {
        id: 'submit-photo-report',
        badge: isRevision ? 'Доработка' : 'Фотоотчёт',
        title: isRevision ? 'Исправьте фотоотчёт' : 'Отправьте фотоотчёт',
        description: isRevision
          ? `По задаче «${reportTask.title}» нужен обновлённый отчёт. Исправьте его, чтобы движение не остановилось.`
          : `Задача «${reportTask.title}» уже готова к подтверждению. Осталось загрузить фотографии результата.`,
        icon: isRevision ? 'refresh-circle-outline' : 'camera-outline',
        accentColor: appColors.warning,
        accentSurface: appColors.warningSurface,
        ctaLabel: isRevision ? 'Исправить отчёт' : 'Загрузить фото',
        ctaIcon: 'cloud-upload-outline',
        secondaryLabel: 'К задаче',
        highlights: [
          reportTask.project_title || 'Текущая задача',
          dueDateLabel ? `Срок: ${dueDateLabel}` : 'Фото ускорит проверку',
        ],
        onPress: () =>
          navigation.navigate('SubmitPhotoReport' as never, { taskId: reportTask.id } as never),
        onSecondaryPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: reportTask.id } as never),
      };
    }

    if (reviewTask) {
      return {
        id: 'check-review-status',
        badge: 'Проверка',
        title: 'Посмотрите статус фотоотчёта',
        description:
          'Отчёт уже отправлен и ждёт решения организатора. В этой карточке можно быстро проверить результат и комментарии.',
        icon: 'hourglass-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurfaceStrong,
        ctaLabel: 'Открыть отчёт',
        ctaIcon: 'document-text-outline',
        secondaryLabel: 'Задачи',
        highlights: [
          reviewTask.project_title || 'Текущий проект',
          'Статус обновится после проверки',
        ],
        onPress: () =>
          navigation.navigate('PhotoReportDetail' as never, { taskId: reviewTask.id } as never),
        onSecondaryPress: () => navigation.navigate('TasksTab' as never),
      };
    }

    if (activeTask) {
      const dueDateLabel = formatActionDate(activeTask.end_date || activeTask.start_date);

      return {
        id: 'open-active-task',
        badge: 'Задача',
        title: 'Продолжайте текущую задачу',
        description:
          'У вас уже есть активная задача. Лучше вернуться в неё сейчас, чтобы не потерять темп и не пропустить дедлайн.',
        icon: 'checkbox-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurface,
        ctaLabel: 'Открыть задачу',
        ctaIcon: 'arrow-forward',
        secondaryLabel: 'Календарь',
        highlights: [
          activeTask.project_title || 'Активный проект',
          dueDateLabel ? `Дедлайн: ${dueDateLabel}` : 'Задача уже в работе',
        ],
        onPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: activeTask.id } as never),
        onSecondaryPress: () => navigation.navigate('CalendarTab' as never),
      };
    }

    if ((profileData?.total_photos || 0) === 0) {
      return {
        id: 'choose-first-project-task',
        badge: 'Старт',
        title: 'Выберите первую активность',
        description:
          'Проекты уже подключены. Теперь откройте их и найдите задачу, которая станет вашим первым завершённым шагом.',
        icon: 'layers-outline',
        accentColor: appColors.primary,
        accentSurface: appColors.primarySurface,
        ctaLabel: 'Мои проекты',
        ctaIcon: 'arrow-forward',
        secondaryLabel: 'Каталог',
        highlights: [
          `${joinedProjects.length} проектов в участии`,
          'Следующий этап откроется после первого отчёта',
        ],
        onPress: () => navigation.navigate('VolunteerMyProjects' as never),
        onSecondaryPress: () => navigation.navigate('VolunteerProjects' as never),
      };
    }

    return {
      id: 'keep-momentum',
      badge: 'Ритм',
      title: 'Сейчас всё под контролем',
      description:
        'Стартовые шаги уже пройдены. Дальше профиль сам будет подсказывать, где сегодня важнее всего появиться: в календаре, проектах или задачах.',
      icon: 'sparkles-outline',
      accentColor: appColors.primary,
      accentSurface: appColors.primarySurface,
      ctaLabel: 'Открыть календарь',
      ctaIcon: 'calendar-outline',
      secondaryLabel: 'Мои проекты',
      highlights: [
        `${joinedProjects.length} активных проектов`,
        `${profileData?.tasks_completed || 0} завершённых задач`,
      ],
      onPress: () => navigation.navigate('CalendarTab' as never),
      onSecondaryPress: () => navigation.navigate('VolunteerMyProjects' as never),
    };
  }, [
    activeTask,
    availableProjects.length,
    isProfileComplete,
    joinedProjects.length,
    missingProfileFields,
    navigation,
    profileChecklist,
    profileData?.tasks_completed,
    profileData?.total_photos,
    reportTask,
    reviewTask,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
      >

        {/* Header Section with Gradient */}
        <LinearGradient
          colors={[appColors.primary, appColors.primaryDark]}
          style={[styles.headerBackground, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color={appColors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onMenuItemPress('help')}
            >
              <Ionicons name="help-circle-outline" size={26} color={appColors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                {profileData?.avatar ? (
                  <Image
                    key={avatarUri || normalizedAvatarUri || 'profile-avatar'}
                    source={{ uri: avatarUri || normalizedAvatarUri || profileData.avatar, cache: 'reload' }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.placeholderAvatar}>
                    <Ionicons name="person" size={50} color={appColors.white} />
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.editButton} onPress={pickImage} disabled={isUploadingAvatar}>
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color={appColors.primary} />
                ) : (
                  <Ionicons name="pencil" size={16} color={appColors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{profileData?.full_name || 'Волонтер'}</Text>
            <Text style={styles.userEmail}>{profileData?.email || 'email@example.com'}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>ВОЛОНТЕР</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsHeader}>
              <View style={styles.metricLabelRow}>
                <Text style={styles.pointsLabel}>БАЛЛЫ</Text>
                <TouchableOpacity
                  style={styles.metricInfoButton}
                  onPress={() => openMetricInfo('points')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="information-circle-outline" size={16} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.pointsValue}>{currentPoints}</Text>
            </View>
            
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
            
            <View style={styles.pointsFooter}>
              <Text style={styles.progressText}>Прогресс уровня</Text>
              <Text style={styles.toNextText}>{pointsToNext} баллов до след. уровня</Text>
            </View>
          </View>

          {/* Stats Grid 1 (TF & Rating) */}
          <View style={styles.statsGridRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="shield" size={24} color={appColors.primary} />
              </View>
              <View style={styles.statCardLabelRow}>
                <Text style={styles.statCardLabel}>ФАКТОР ДОВЕРИЯ</Text>
                <TouchableOpacity
                  style={styles.metricInfoButton}
                  onPress={() => openMetricInfo('trust_factor')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="information-circle-outline" size={16} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.statCardValue}>{profileData?.trust_factor ?? 20}/30</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="star" size={24} color={appColors.warning} />
              </View>
              <View style={styles.statCardLabelRow}>
                <Text style={styles.statCardLabel}>ФОТО-РЕЙТИНГ</Text>
                <TouchableOpacity
                  style={styles.metricInfoButton}
                  onPress={() => openMetricInfo('photo_rating')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="information-circle-outline" size={16} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.statCardValue}>{profileData?.average_rating?.toFixed(1) || '5.0'}/5.0</Text>
            </View>
          </View>

          {/* Stats Tabs Row 2 */}
          <View style={styles.bottomStatsRow}>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="leaf" size={18} color={appColors.primary} />
              </View>
              <Text style={styles.statTabText}>{joinedProjects.length} Проектов</Text>
            </View>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="checkbox" size={18} color={appColors.primary} />
              </View>
              <Text style={styles.statTabText}>{profileData?.tasks_completed || 0} Всего задач </Text>
            </View>
          </View>
          
          <View style={styles.bottomStatsSingleRow}>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="camera" size={18} color={appColors.primary} />
              </View>
              <Text style={styles.statTabText}>{profileData?.total_photos || 0} Фото</Text>
            </View>
          </View>

          <NextBestActionCard action={nextBestAction} loading={isActionContextLoading} />

          {/* Account Settings Section */}
          <Text style={styles.menuSectionTitle}>НАСТРОЙКИ АККАУНТА</Text>
          
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('edit_profile')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Редактировать профиль</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('change_password')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="lock-closed-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Изменить пароль</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('stats')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="analytics-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Моя статистика</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('notifications')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Уведомления</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('language')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="globe-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Язык</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuValueText}>Русский</Text>
                <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="moon-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Темная тема</Text>
              </View>
              <Switch 
                value={isDarkTheme} 
                onValueChange={handleThemeToggle}
                trackColor={{ false: appColors.borderSoft, true: appColors.primary }}
                thumbColor={appColors.white}
              />
            </View>


            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('about')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="information-circle-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>О приложении</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => onMenuItemPress('help')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="help-circle-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>Помощь и поддержка</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={appColors.danger} />
            <Text style={styles.logoutText}>Выйти</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal
        visible={Boolean(metricInfo)}
        animationType="fade"
        transparent={true}
        onRequestClose={closeMetricInfo}
      >
        <View style={styles.metricModalOverlay}>
          <View style={styles.metricModalContent}>
            <View style={styles.metricModalHeader}>
              <View style={styles.metricModalIconContainer}>
                <Ionicons name="information-circle" size={28} color={appColors.primary} />
              </View>
              <TouchableOpacity style={styles.metricModalCloseButton} onPress={closeMetricInfo}>
                <Ionicons name="close" size={22} color={appColors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.metricModalTitle}>{metricInfo?.title}</Text>
            </View>

            <ScrollView
              style={styles.metricModalScroll}
              contentContainerStyle={styles.metricModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.metricModalDescription}>{metricInfo?.description}</Text>

              <View style={styles.metricModalInfoBox}>
                {metricInfo?.facts.map((fact) => (
                  <View key={fact} style={styles.metricModalInfoRow}>
                    <Ionicons name="checkmark-circle" size={18} color={appColors.primary} />
                    <Text style={styles.metricModalInfoText}>{fact}</Text>
                  </View>
                ))}
              </View>

              {metricInfo?.tip ? (
                <View style={styles.metricModalTip}>
                  <Ionicons name="bulb-outline" size={18} color="#D97706" />
                  <Text style={styles.metricModalTipText}>{metricInfo.tip}</Text>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.metricModalButton} onPress={closeMetricInfo}>
              <Text style={styles.metricModalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerBackground: {
    paddingTop: 60,
    paddingBottom: 50,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
  },
  headerTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    position: 'absolute',
    top: 50,
    zIndex: 10,
  },
  iconButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    position: 'absolute',
    right: 0,
    top: 5,
    backgroundColor: appColors.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: appColors.white,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },
  roleBadge: {
    backgroundColor: appColors.surface,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  roleText: {
    color: appColors.primary,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  mainContent: {
    paddingHorizontal: 20,
    marginTop: -35,
  },
  pointsCard: {
    backgroundColor: appColors.surface,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: appColors.textSoft,
    letterSpacing: 1,
  },
  metricInfoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: appColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsValue: {
    fontSize: 42,
    fontWeight: '900',
    color: appColors.primary,
    lineHeight: 42,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: appColors.primary,
    borderRadius: 6,
  },
  pointsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.textSoft,
  },
  toNextText: {
    fontSize: 12,
    color: appColors.textSoft,
    fontWeight: '500',
  },
  statsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: appColors.surface,
    width: (width - 56) / 2,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  statIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: appColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: appColors.textSoft,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '900',
    color: appColors.text,
  },
  bottomStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomStatsSingleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 12,
    marginBottom: 16,
  },
  statTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    width: (width - 56) / 2,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#065F46',
  },
  metricModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: width < 390 ? 16 : 20,
  },
  metricModalContent: {
    width: '100%',
    maxWidth: width < 390 ? width - 32 : 420,
    maxHeight: width < 390 ? '82%' : '78%',
    backgroundColor: appColors.surface,
    borderRadius: width < 390 ? 24 : 28,
    padding: width < 390 ? 18 : 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  metricModalHeader: {
    alignItems: 'center',
    marginBottom: 18,
    position: 'relative',
  },
  metricModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: appColors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricModalCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricModalTitle: {
    fontSize: width < 390 ? 20 : 22,
    fontWeight: '800',
    color: appColors.text,
    textAlign: 'center',
    paddingHorizontal: width < 390 ? 40 : 24,
  },
  metricModalScroll: {
    maxHeight: 360,
  },
  metricModalScrollContent: {
    paddingBottom: 8,
  },
  metricModalDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.textSoft,
    marginBottom: 16,
  },
  metricModalInfoBox: {
    backgroundColor: appColors.background,
    borderRadius: 18,
    padding: 16,
  },
  metricModalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricModalInfoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: width < 390 ? 13 : 14,
    lineHeight: width < 390 ? 19 : 20,
    color: appColors.textSecondary,
  },
  metricModalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  metricModalTipText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#9A3412',
  },
  metricModalButton: {
    marginTop: 20,
    backgroundColor: appColors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricModalButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: appColors.white,
  },
  tabIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: appColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: appColors.textSoft,
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  menuContainer: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: appColors.borderSoft,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '600',
    color: appColors.textSecondary,
  },
  menuValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: appColors.primary,
    marginRight: 8,
  },
  switchStub: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    paddingHorizontal: 2,
    alignItems: 'flex-end',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  logoutText: {
    marginLeft: 12,
    color: appColors.danger,
    fontWeight: '700',
    fontSize: 17,
  },
});
