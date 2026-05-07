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
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import {
  isDevNotificationModeEnabled,
  sendDebugNotification,
  setDevNotificationModeEnabled,
  syncVolunteerLocalNotifications,
} from '../../utils/volunteerNotifications';
import {
  type NextBestActionCardData,
} from '../../components/profile/NextBestActionCard';
import { ProfileInsightDeck } from '../../components/profile/ProfileInsightDeck';
import { setLanguage } from '../../locales/i18n';
import { useTranslation } from "../../locales/i18n";

const { width } = Dimensions.get('window');

interface VolunteerProfileScreenProps {
  navigation: any;
}

type MetricInfoKey = 'points' | 'trust_factor' | 'photo_rating';

const getMetricInfoContent = (t: (key: string) => string): Record<
  MetricInfoKey,
  {
    title: string;
    description: string;
    facts: string[];
    tip?: string;
  }
> => ({
  points: {
    title: t('profile.s_0'),
    description: t('profile.s_1'),
    facts: [
      t('profile.s_2'),
      t('profile.s_3'),
      t('profile.s_4'),
    ],
    tip: t('profile.s_5'),
  },
  trust_factor: {
    title: t('profile.s_6'),
    description: t('profile.s_7'),
    facts: [
      t('profile.s_8'),
      t('profile.s_9'),
      t('profile.s_10'),
    ],
    tip: t('profile.s_11'),
  },
  photo_rating: {
    title: t('profile.s_12'),
    description: t('profile.s_13'),
    facts: [
      t('profile.s_14'),
      t('profile.s_15'),
      t('profile.s_16'),
    ],
    tip: t('profile.s_17'),
  },
});

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

const normalizeTasksPayload = (payload: any, t: (key: string) => string): Task[] => {
  const tasksData = Array.isArray(payload) ? payload : payload?.tasks || [];

  return tasksData.map((item: any) => ({
    id: item.id,
    title: item.title || item.text || t('profile.s_18'),
    description: item.description || item.text || '',
    project_id: item.project_id,
    project_title: item.project_title,
    location: item.location || item.project_city || item.city || t('profile.s_19'),
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
  const { t, language } = useTranslation();
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
  const [devNotificationMode, setDevNotificationMode] = useState(false);
  const [isSendingDebugNotification, setIsSendingDebugNotification] = useState(false);
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false);
  const metricInfoContent = useMemo(() => getMetricInfoContent(t), [t]);

  const formatCountLabel = useCallback(
    (
      count: number,
      kind:
        | 'joinedProjects'
        | 'availableProjects'
        | 'activeProjects'
        | 'activeTasks'
        | 'reviewReports'
        | 'photoQueue'
    ) => {
      switch (language) {
        case 'en':
          return {
            joinedProjects: `${count} joined projects`,
            availableProjects: `${count} projects available now`,
            activeProjects: `${count} active projects`,
            activeTasks: `${count} active tasks`,
            reviewReports: `${count} report(s) awaiting decision`,
            photoQueue: `Photo report queue: ${count}`,
          }[kind];
        case 'kk':
          return {
            joinedProjects: `Қатысуда ${count} жоба`,
            availableProjects: `Қазір ${count} жоба қолжетімді`,
            activeProjects: `${count} белсенді жоба`,
            activeTasks: `${count} белсенді тапсырма`,
            reviewReports: `${count} есеп шешім күтіп тұр`,
            photoQueue: `Фотоесеп кезегі: ${count}`,
          }[kind];
        case 'ru':
        default:
          return {
            joinedProjects: `${count} проектов в участии`,
            availableProjects: `${count} проектов доступны сейчас`,
            activeProjects: `${count} активных проектов`,
            activeTasks: `${count} активных задач`,
            reviewReports: `${count} отчет(ов) ждут решения`,
            photoQueue: `На очереди фотоотчетов: ${count}`,
          }[kind];
      }
    },
    [language]
  );

  const formatDeadlineLabel = useCallback(
    (value: string) => {
      switch (language) {
        case 'en':
          return `Deadline: ${value}`;
        case 'kk':
          return `Мерзімі: ${value}`;
        case 'ru':
        default:
          return `Дедлайн: ${value}`;
      }
    },
    [language]
  );

  const formatMixedTaskStateLabel = useCallback(
    (activeCount: number, reviewCount: number) => {
      switch (language) {
        case 'en':
          return `${activeCount} in progress, ${reviewCount} under review`;
        case 'kk':
          return `${activeCount} жұмыста, ${reviewCount} тексеруде`;
        case 'ru':
        default:
          return `${activeCount} уже в работе, ${reviewCount} на проверке`;
      }
    },
    [language]
  );

  const formatTrustFactorLabel = useCallback(
    (value: number) => {
      switch (language) {
        case 'en':
          return `Trust Factor: ${value}/30`;
        case 'kk':
          return `Trust Factor: ${value}/30`;
        case 'ru':
        default:
          return `Trust Factor: ${value}/30`;
      }
    },
    [language]
  );

  const formatPhotoRatingLabel = useCallback(
    (value: number) => {
      switch (language) {
        case 'en':
          return `Photo rating: ${value.toFixed(1)}/5.0`;
        case 'kk':
          return `Фото рейтингі: ${value.toFixed(1)}/5.0`;
        case 'ru':
        default:
          return `Фото-рейтинг: ${value.toFixed(1)}/5.0`;
      }
    },
    [language]
  );

  const formatPointsToNextLevelTitle = useCallback(
    (value: number) => {
      switch (language) {
        case 'en':
          return `${value} points to the next level`;
        case 'kk':
          return `Келесі деңгейге дейін ${value} ұпай`;
        case 'ru':
        default:
          return `До следующего уровня ${value} баллов`;
      }
    },
    [language]
  );

  const formatFeatureInDevelopmentMessage = useCallback(
    (featureName: string) => {
      switch (language) {
        case 'en':
          return `The feature "${featureName}" is in development and will be available soon.`;
        case 'kk':
          return `"${featureName}" функциясы әзірленіп жатыр және жақында қолжетімді болады.`;
        case 'ru':
        default:
          return `Функция «${featureName}» находится в разработке и будет доступна скоро.`;
      }
    },
    [language]
  );

  const formatFocusReportDescription = useCallback(
    (taskTitle: string) => {
      switch (language) {
        case 'en':
          return `The most useful step for today is to finish "${taskTitle}" and send a photo report so moderation is not delayed.`;
        case 'kk':
          return `Бүгінгі ең пайдалы қадам — "${taskTitle}" тапсырмасын аяқтап, тексеру кешікпеуі үшін фотоесеп жіберу.`;
        case 'ru':
        default:
          return `Самый полезный шаг на сегодня — завершить задачу «${taskTitle}» и отправить фотоотчет, чтобы не задерживать проверку.`;
      }
    },
    [language]
  );

  const formatChecklistProgress = useCallback(
    (completedCount: number, totalCount: number) => {
      switch (language) {
        case 'en':
          return `Done ${completedCount}/${totalCount}`;
        case 'kk':
          return `Дайын ${completedCount}/${totalCount}`;
        case 'ru':
        default:
          return `Готово ${completedCount}/${totalCount}`;
      }
    },
    [language]
  );

  const formatMissingFieldsLabel = useCallback(
    (fields: string[]) => {
      switch (language) {
        case 'en':
          return `Missing: ${fields.join(', ')}`;
        case 'kk':
          return `Жетіспейді: ${fields.join(', ')}`;
        case 'ru':
        default:
          return `Не хватает: ${fields.join(', ')}`;
      }
    },
    [language]
  );

  const formatPhotoActionDescription = useCallback(
    (taskTitle: string, isRevision: boolean) => {
      if (language === 'en') {
        return isRevision
          ? `The task "${taskTitle}" needs an updated report. Fix it so progress does not stop.`
          : `The task "${taskTitle}" is ready for confirmation. You only need to upload result photos.`;
      }

      if (language === 'kk') {
        return isRevision
          ? `"${taskTitle}" тапсырмасы бойынша жаңартылған есеп керек. Ілгерілеу тоқтамауы үшін оны түзетіңіз.`
          : `"${taskTitle}" тапсырмасы растауға дайын. Нәтиже фотоларын ғана жүктеу қалды.`;
      }

      return isRevision
        ? `По задаче «${taskTitle}» нужен обновлённый отчёт. Исправьте его, чтобы движение не остановилось.`
        : `Задача «${taskTitle}» уже готова к подтверждению. Осталось загрузить фотографии результата.`;
    },
    [language]
  );

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
        setTasksContext(normalizeTasksPayload(tasksResult.value.data, t));
      } else {
        console.error('Error fetching tasks for profile action card:', tasksResult.reason);
        setTasksContext([]);
      }
    } finally {
      setIsActionContextLoading(false);
    }
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.s_20'), t('profile.s_21'));
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
      Alert.alert(t('profile.s_22'), t('profile.s_23'));
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
        Alert.alert(t('profile.s_24'), t('profile.s_25'));
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
      Alert.alert(t('profile.s_26'), t('profile.s_27'));
    } catch (error: unknown) {
      Alert.alert(t('profile.s_28'), getAxiosErrorMessage(error, t('profile.s_29')));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.s_30'), t('profile.s_31'), [
      { text: t('profile.s_32'), style: 'cancel' },
      { text: t('profile.s_33'), style: 'destructive', onPress: async () => await logout() },
    ]);
  };

  const openMetricInfo = useCallback((metric: MetricInfoKey) => {
    setActiveMetricInfo(metric);
  }, []);

  const closeMetricInfo = useCallback(() => {
    setActiveMetricInfo(null);
  }, []);

  const showInDevelopmentAlert = (featureName: string) => {
    Alert.alert(t('profile.s_34'), formatFeatureInDevelopmentMessage(featureName));
  };

  const reloadApp = useCallback(() => {
    if (__DEV__ && typeof DevSettings.reload === 'function') {
      setTimeout(() => DevSettings.reload(), 180);
      return;
    }

    Alert.alert(t('profile.s_35'), t('profile.s_36'));
  }, []);

  const handleThemeToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await toggleTheme(enabled);
        reloadApp();
      } catch (error) {
        Alert.alert(t('profile.s_37'), t('profile.s_38'));
      }
    },
    [reloadApp, toggleTheme]
  );

  const loadNotificationDebugSettings = useCallback(async () => {
    if (!__DEV__) {
      return;
    }

    try {
      const enabled = await isDevNotificationModeEnabled();
      setDevNotificationMode(enabled);
    } catch (error) {
      console.warn('[LOCAL NOTIF] Failed to load debug mode', error);
    }
  }, []);

  const handleDevNotificationModeToggle = useCallback(
    async (enabled: boolean) => {
      try {
        await setDevNotificationModeEnabled(enabled);
        setDevNotificationMode(enabled);
        await syncVolunteerLocalNotifications(tasksContext, projectsContext);
        Alert.alert(
          t('profile.s_39'),
          enabled
            ? t('profile.s_40')
            : t('profile.s_41')
        );
      } catch (error) {
        Alert.alert(t('profile.s_42'), t('profile.s_43'));
      }
    },
    [projectsContext, tasksContext]
  );

  const handleSendDebugNotification = useCallback(async () => {
    try {
      setIsSendingDebugNotification(true);
      const success = await sendDebugNotification();
      if (!success) {
        Alert.alert(t('profile.s_44'), t('profile.s_45'));
        return;
      }

      Alert.alert(t('profile.s_46'), t('profile.s_47'));
    } catch (error) {
      Alert.alert(t('profile.s_48'), t('profile.s_49'));
    } finally {
      setIsSendingDebugNotification(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      void loadNotificationDebugSettings();
    }, [fetchProfile, loadNotificationDebugSettings])
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
        setIsLanguageModalVisible(true);
        break;

      case 'about':
        navigation.navigate('AboutApp' as never);
        break;
      case 'help':
        navigation.navigate('VolunteerHelp' as never);
        break;
      case 'link_telegram':
        showInDevelopmentAlert(t('profile.s_55'));
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
  const metricInfo = activeMetricInfo ? metricInfoContent[activeMetricInfo] : null;
  const profileChecklist = useMemo(
    () => [
      { label: t('profile.s_56'), completed: Boolean(profileData?.full_name?.trim()) },
      { label: t('profile.s_57'), completed: Boolean(profileData?.phone_number?.trim()) },
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
  const activeJoinedProjectIds = useMemo(
    () => new Set(joinedProjects.map((project) => project.id)),
    [joinedProjects]
  );
  const sortedTasks = useMemo(
    () =>
      [...tasksContext]
        .filter((task) => activeJoinedProjectIds.has(task.project_id))
        .sort((left, right) => getTaskSortTime(left) - getTaskSortTime(right)),
    [activeJoinedProjectIds, tasksContext]
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
  const openTask = useMemo(
    () =>
      sortedTasks.find(
        (task) =>
          !isTaskExpired(task) &&
          !task.accepted &&
          (task.status === 'pending' || task.status === 'open')
      ),
    [sortedTasks]
  );
  const reviewTaskCount = useMemo(
    () => sortedTasks.filter((task) => isReviewTask(task)).length,
    [sortedTasks]
  );
  const reportTaskCount = useMemo(
    () => sortedTasks.filter((task) => isActionablePhotoTask(task)).length,
    [sortedTasks]
  );
  const activeTaskCount = useMemo(
    () => sortedTasks.filter((task) => isActiveTask(task)).length,
    [sortedTasks]
  );
  const nextBestAction = useMemo<NextBestActionCardData>(() => {
    if (!isProfileComplete) {
      return {
        id: 'complete-profile',
        eyebrow: t('profile.s_58'),
        badge: t('profile.s_59'),
        title: t('profile.s_60'),
        description:
          t('profile.s_61'),
        icon: 'person-circle-outline',
        accentColor: appColors.info,
        accentSurface: appColors.surfaceSoft,
        ctaLabel: t('profile.s_62'),
        ctaIcon: 'create-outline',
        highlights: [
          formatChecklistProgress(profileChecklist.filter((item) => item.completed).length, profileChecklist.length),
          formatMissingFieldsLabel(missingProfileFields),
        ],
        onPress: () => navigation.navigate('EditVolunteerProfile' as never),
      };
    }

    if (!joinedProjects.length) {
      return {
        id: 'join-first-project',
        eyebrow: t('profile.s_63'),
        badge: t('profile.s_64'),
        title: t('profile.s_65'),
        description:
          t('profile.s_66'),
        icon: 'compass-outline',
        accentColor: appColors.primary,
        accentSurface: appColors.primarySurface,
        ctaLabel: t('profile.s_67'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_68'),
        highlights: [
          formatCountLabel(availableProjects.length, 'availableProjects'),
          t('profile.s_69'),
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
        eyebrow: t('profile.s_70'),
        badge: isRevision ? t('profile.s_71') : t('profile.s_72'),
        title: isRevision ? t('profile.s_73') : t('profile.s_74'),
        description: formatPhotoActionDescription(reportTask.title, isRevision),
        icon: isRevision ? 'refresh-circle-outline' : 'camera-outline',
        accentColor: appColors.warning,
        accentSurface: appColors.warningSurface,
        ctaLabel: isRevision ? t('profile.s_75') : t('profile.s_76'),
        ctaIcon: 'cloud-upload-outline',
        secondaryLabel: t('profile.s_77'),
        highlights: [
          reportTask.project_title || t('profile.s_78'),
          dueDateLabel ? formatDeadlineLabel(dueDateLabel) : t('profile.s_79'),
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
        eyebrow: t('profile.s_80'),
        badge: t('profile.s_81'),
        title: t('profile.s_82'),
        description:
          t('profile.s_83'),
        icon: 'hourglass-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurfaceStrong,
        ctaLabel: t('profile.s_84'),
        ctaIcon: 'document-text-outline',
        secondaryLabel: t('profile.s_85'),
        highlights: [
          reviewTask.project_title || t('profile.s_86'),
          t('profile.s_87'),
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
        eyebrow: t('profile.s_88'),
        badge: t('profile.s_89'),
        title: t('profile.s_90'),
        description:
          t('profile.s_91'),
        icon: 'checkbox-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurface,
        ctaLabel: t('profile.s_92'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_93'),
        highlights: [
          activeTask.project_title || t('profile.s_94'),
          dueDateLabel ? formatDeadlineLabel(dueDateLabel) : t('profile.s_95'),
        ],
        onPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: activeTask.id } as never),
        onSecondaryPress: () => navigation.navigate('CalendarTab' as never),
      };
    }

    if ((profileData?.total_photos || 0) === 0) {
      return {
        id: 'choose-first-project-task',
        eyebrow: t('profile.s_96'),
        badge: t('profile.s_97'),
        title: t('profile.s_98'),
        description:
          t('profile.s_99'),
        icon: 'layers-outline',
        accentColor: appColors.primary,
        accentSurface: appColors.primarySurface,
        ctaLabel: t('profile.s_100'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_101'),
        highlights: [
          formatCountLabel(joinedProjects.length, 'joinedProjects'),
          t('profile.s_102'),
        ],
        onPress: () => navigation.navigate('VolunteerMyProjects' as never),
        onSecondaryPress: () => navigation.navigate('VolunteerProjects' as never),
      };
    }

    return {
      id: 'keep-momentum',
      eyebrow: t('profile.s_103'),
      badge: t('profile.s_104'),
      title: t('profile.s_105'),
      description:
        t('profile.s_106'),
      icon: 'sparkles-outline',
      accentColor: appColors.primary,
      accentSurface: appColors.primarySurface,
      ctaLabel: t('profile.s_107'),
      ctaIcon: 'calendar-outline',
      secondaryLabel: t('profile.s_108'),
      highlights: [
        formatCountLabel(joinedProjects.length, 'activeProjects'),
        formatCountLabel(profileData?.active_tasks ?? profileData?.tasks_completed ?? 0, 'activeTasks'),
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
    profileData?.active_tasks,
    profileData?.tasks_completed,
    profileData?.total_photos,
    reportTask,
    reviewTask,
    formatChecklistProgress,
    formatCountLabel,
    formatDeadlineLabel,
    formatMissingFieldsLabel,
    formatPhotoActionDescription,
  ]);
  const focusTodayAction = useMemo<NextBestActionCardData>(() => {
    if (reportTask) {
      return {
        id: 'focus-report-task',
        eyebrow: t('profile.s_109'),
        badge: t('profile.s_110'),
        title: t('profile.s_111'),
        description: formatFocusReportDescription(reportTask.title),
        icon: 'flash-outline',
        accentColor: appColors.warning,
        accentSurface: appColors.warningSurface,
        ctaLabel: t('profile.s_112'),
        ctaIcon: 'camera-outline',
        secondaryLabel: t('profile.s_113'),
        highlights: [
          reportTask.project_title || t('profile.s_114'),
          formatCountLabel(reportTaskCount, 'photoQueue'),
        ],
        onPress: () =>
          navigation.navigate('SubmitPhotoReport' as never, { taskId: reportTask.id } as never),
        onSecondaryPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: reportTask.id } as never),
      };
    }

    if (reviewTask) {
      return {
        id: 'focus-review-task',
        eyebrow: t('profile.s_115'),
        badge: t('profile.s_116'),
        title: t('profile.s_117'),
        description: t('profile.s_118'),
        icon: 'time-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurfaceStrong,
        ctaLabel: t('profile.s_119'),
        ctaIcon: 'document-text-outline',
        secondaryLabel: t('profile.s_120'),
        highlights: [
          reviewTask.project_title || t('profile.s_121'),
          formatCountLabel(reviewTaskCount, 'reviewReports'),
        ],
        onPress: () =>
          navigation.navigate('PhotoReportDetail' as never, { taskId: reviewTask.id } as never),
        onSecondaryPress: () => navigation.navigate('TasksTab' as never),
      };
    }

    if (activeTask) {
      const dueDateLabel = formatActionDate(activeTask.end_date || activeTask.start_date);
      return {
        id: 'focus-active-task',
        eyebrow: t('profile.s_122'),
        badge: t('profile.s_123'),
        title: t('profile.s_124'),
        description: t('profile.s_125'),
        icon: 'checkmark-circle-outline',
        accentColor: appColors.primaryDark,
        accentSurface: appColors.primarySurface,
        ctaLabel: t('profile.s_126'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_127'),
        highlights: [
          activeTask.project_title || t('profile.s_128'),
          dueDateLabel ? formatDeadlineLabel(dueDateLabel) : formatCountLabel(activeTaskCount, 'activeTasks'),
        ],
        onPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: activeTask.id } as never),
        onSecondaryPress: () => navigation.navigate('CalendarTab' as never),
      };
    }

    if (openTask) {
      return {
        id: 'focus-open-task',
        eyebrow: t('profile.s_129'),
        badge: t('profile.s_130'),
        title: t('profile.s_131'),
        description: t('profile.s_132'),
        icon: 'play-circle-outline',
        accentColor: appColors.info,
        accentSurface: appColors.surfaceSoft,
        ctaLabel: t('profile.s_133'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_134'),
        highlights: [
          openTask.project_title || t('profile.s_135'),
          formatMixedTaskStateLabel(activeTaskCount, reviewTaskCount),
        ],
        onPress: () =>
          navigation.navigate('VolunteerTaskDetail' as never, { taskId: openTask.id } as never),
        onSecondaryPress: () => navigation.navigate('TasksTab' as never),
      };
    }

    return {
      id: 'focus-rest-state',
      eyebrow: t('profile.s_136'),
      badge: t('profile.s_137'),
      title: t('profile.s_138'),
      description: t('profile.s_139'),
      icon: 'sunny-outline',
      accentColor: appColors.primary,
      accentSurface: appColors.primarySurface,
      ctaLabel: t('profile.s_140'),
      ctaIcon: 'calendar-outline',
      secondaryLabel: t('profile.s_141'),
      highlights: [
        formatCountLabel(joinedProjects.length, 'activeProjects'),
        formatCountLabel(profileData?.active_tasks ?? profileData?.tasks_completed ?? 0, 'activeTasks'),
      ],
      onPress: () => navigation.navigate('CalendarTab' as never),
      onSecondaryPress: () => navigation.navigate('VolunteerProjects' as never),
    };
  }, [
    activeTask,
    activeTaskCount,
    joinedProjects.length,
    navigation,
    openTask,
    profileData?.active_tasks,
    profileData?.tasks_completed,
    reportTask,
    reportTaskCount,
    reviewTask,
    reviewTaskCount,
    formatCountLabel,
    formatDeadlineLabel,
    formatFocusReportDescription,
    formatMixedTaskStateLabel,
  ]);
  const growthAction = useMemo<NextBestActionCardData>(() => {
    const trustFactor = profileData?.trust_factor ?? 0;
    const averageRating = profileData?.average_rating ?? 0;
    const activeTasks = profileData?.active_tasks ?? profileData?.tasks_completed ?? 0;

    if (pointsToNext > 0) {
      return {
        id: 'growth-next-level',
        eyebrow: t('profile.s_142'),
        badge: t('profile.s_143'),
        title: formatPointsToNextLevelTitle(pointsToNext),
        description: t('profile.s_144'),
        icon: 'trending-up-outline',
        accentColor: appColors.primary,
        accentSurface: appColors.primarySurface,
        ctaLabel: t('profile.s_145'),
        ctaIcon: 'analytics-outline',
        secondaryLabel: t('profile.s_146'),
        highlights: [
          formatTrustFactorLabel(trustFactor),
          formatPhotoRatingLabel(averageRating),
        ],
        onPress: () => navigation.navigate('VolunteerAchievements' as never),
        onSecondaryPress: () => navigation.navigate('CalendarTab' as never),
      };
    }

    return {
      id: 'growth-consistency',
      eyebrow: t('profile.s_147'),
      badge: t('profile.s_148'),
      title: t('profile.s_149'),
      description: t('profile.s_150'),
      icon: 'shield-checkmark-outline',
      accentColor: appColors.primaryDark,
      accentSurface: appColors.primarySurfaceStrong,
      ctaLabel: t('profile.s_151'),
      ctaIcon: 'stats-chart-outline',
      secondaryLabel: t('profile.s_152'),
      highlights: [
        formatCountLabel(activeTasks, 'activeTasks'),
        formatTrustFactorLabel(trustFactor),
      ],
      onPress: () => navigation.navigate('VolunteerAchievements' as never),
      onSecondaryPress: () => navigation.navigate('TasksTab' as never),
    };
  }, [
    navigation,
    pointsToNext,
    profileData?.average_rating,
    profileData?.active_tasks,
    profileData?.tasks_completed,
    profileData?.trust_factor,
    formatCountLabel,
    formatPhotoRatingLabel,
    formatPointsToNextLevelTitle,
    formatTrustFactorLabel,
  ]);
  const helpfulTipAction = useMemo<NextBestActionCardData>(() => {
    if ((profileData?.trust_factor ?? 0) <= 10) {
      return {
        id: 'tip-trust-factor',
        eyebrow: t('profile.s_153'),
        badge: t('profile.s_188'),
        title: t('profile.s_154'),
        description: t('profile.s_155'),
        icon: 'shield-half-outline',
        accentColor: appColors.danger,
        accentSurface: appColors.dangerSurface,
        ctaLabel: t('profile.s_156'),
        ctaIcon: 'information-circle-outline',
        secondaryLabel: t('profile.s_157'),
        highlights: [
          t('profile.s_158'),
          t('profile.s_159'),
        ],
        onPress: () => openMetricInfo('trust_factor'),
        onSecondaryPress: () => navigation.navigate('VolunteerProjects' as never),
      };
    }

    if (reportTask || reviewTask) {
      return {
        id: 'tip-photo-quality',
        eyebrow: t('profile.s_160'),
        badge: t('profile.s_161'),
        title: t('profile.s_162'),
        description: t('profile.s_163'),
        icon: 'camera-reverse-outline',
        accentColor: appColors.warning,
        accentSurface: appColors.warningSurface,
        ctaLabel: t('profile.s_164'),
        ctaIcon: 'images-outline',
        secondaryLabel: t('profile.s_165'),
        highlights: [
          t('profile.s_166'),
          t('profile.s_167'),
        ],
        onPress: () => navigation.navigate('TasksTab' as never),
        onSecondaryPress: () => navigation.navigate('VolunteerAchievements' as never),
      };
    }

    if (availableProjects.length > 0) {
      return {
        id: 'tip-new-projects',
        eyebrow: t('profile.s_168'),
        badge: t('profile.s_169'),
        title: t('profile.s_170'),
        description: t('profile.s_171'),
        icon: 'compass-outline',
        accentColor: appColors.info,
        accentSurface: appColors.surfaceSoft,
        ctaLabel: t('profile.s_172'),
        ctaIcon: 'arrow-forward',
        secondaryLabel: t('profile.s_173'),
        highlights: [
          formatCountLabel(availableProjects.length, 'availableProjects'),
          t('profile.s_174'),
        ],
        onPress: () => navigation.navigate('VolunteerProjects' as never),
        onSecondaryPress: () => navigation.navigate('HomeTab' as never),
      };
    }

    return {
      id: 'tip-keep-balance',
      eyebrow: t('profile.s_175'),
      badge: t('profile.s_176'),
      title: t('profile.s_177'),
      description: t('profile.s_178'),
      icon: 'bulb-outline',
      accentColor: appColors.primaryDark,
      accentSurface: appColors.primarySurface,
      ctaLabel: t('profile.s_179'),
      ctaIcon: 'help-circle-outline',
      secondaryLabel: t('profile.s_180'),
      highlights: [
        t('profile.s_181'),
        t('profile.s_182'),
      ],
      onPress: () => navigation.navigate('VolunteerHelp' as never),
      onSecondaryPress: () => navigation.navigate('CalendarTab' as never),
    };
  }, [
    availableProjects.length,
    navigation,
    openMetricInfo,
    profileData?.trust_factor,
    reportTask,
    reviewTask,
    formatCountLabel,
  ]);
  const profileInsightCards = useMemo(
    () => [nextBestAction, focusTodayAction, growthAction, helpfulTipAction],
    [focusTodayAction, growthAction, helpfulTipAction, nextBestAction]
  );
  const currentLanguageCode = useMemo(() => {
    switch (language) {
      case 'kk':
        return 'KZ';
      case 'en':
        return 'EN';
      case 'ru':
      default:
        return 'RU';
    }
  }, [language]);

  const handleLanguageSelect = useCallback(
    async (nextLanguage: 'ru' | 'kk' | 'en') => {
      setIsLanguageModalVisible(false);
      await setLanguage(nextLanguage);
      reloadApp();
    },
    [reloadApp]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
      >

        {/* Header Section with Gradient */}
        <LinearGradient
          colors={[appColors.primary, appColors.primaryDark]}
          style={[styles.headerBackground, { paddingTop: 16 }]}
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

            <Text style={styles.userName}>{profileData?.full_name || t('profile.s_183')}</Text>
            <Text style={styles.userEmail}>{profileData?.email || 'email@example.com'}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{t('profile.s_184')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.mainContent}>
          {/* Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsHeader}>
              <View style={styles.metricLabelRow}>
                <Text style={styles.pointsLabel}>{t('profile.s_185')}</Text>
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
              <Text style={styles.progressText}>{t('profile.s_186')}</Text>
              <Text style={styles.toNextText}>{pointsToNext} {t('profile.s_187')}</Text>
            </View>
          </View>

          {/* Stats Grid 1 (TF & Rating) */}
          <View style={styles.statsGridRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name="shield" size={24} color={appColors.primary} />
              </View>
              <View style={styles.statCardLabelRow}>
                <Text style={styles.statCardLabel}>{t('profile.s_188')}</Text>
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
                <Text style={styles.statCardLabel}>{t('profile.s_189')}</Text>
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
              <Text style={styles.statTabText}>{joinedProjects.length} {t('profile.s_190')}</Text>
            </View>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="checkbox" size={18} color={appColors.primary} />
              </View>
              <Text style={styles.statTabText}>{profileData?.active_tasks ?? profileData?.tasks_completed ?? 0} {t('profile.s_191')}</Text>
            </View>
          </View>
          
          <View style={styles.bottomStatsSingleRow}>
            <View style={styles.statTab}>
              <View style={styles.tabIconBg}>
                <Ionicons name="camera" size={18} color={appColors.primary} />
              </View>
              <Text style={styles.statTabText}>{profileData?.total_photos || 0} {t('profile.s_192')}</Text>
            </View>
          </View>

          <Text style={styles.menuSectionTitle}>{t('profile.s_193')}</Text>
          <ProfileInsightDeck actions={profileInsightCards} loading={isActionContextLoading} />

          {/* Account Settings Section */}
          <Text style={styles.menuSectionTitle}>{t('profile.s_194')}</Text>
          
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('edit_profile')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_195')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('change_password')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="lock-closed-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_196')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('stats')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="analytics-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_197')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('notifications')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_198')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => onMenuItemPress('language')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="globe-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_199')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.menuValueText}>{currentLanguageCode}</Text>
                <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="moon-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_201')}</Text>
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
                <Text style={styles.menuItemText}>{t('profile.s_202')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => onMenuItemPress('help')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="help-circle-outline" size={22} color={appColors.textMuted} />
                <Text style={styles.menuItemText}>{t('profile.s_203')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={appColors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={appColors.danger} />
            <Text style={styles.logoutText}>{t('profile.s_204')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal
        visible={isLanguageModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsLanguageModalVisible(false)}
      >
        <View style={styles.metricModalOverlay}>
          <View style={styles.languageModalContent}>
            <View style={styles.languageModalHeader}>
              <Text style={styles.languageModalTitle}>{t('profile.s_39')}</Text>
              <Text style={styles.languageModalSubtitle}>{t('profile.s_41')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.languageOption, language === 'ru' && styles.languageOptionActive]}
              onPress={() => void handleLanguageSelect('ru')}
            >
              <Text style={styles.languageOptionCode}>RU</Text>
              <Text style={styles.languageOptionLabel}>Русский</Text>
              {language === 'ru' ? <Ionicons name="checkmark" size={18} color={appColors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageOption, language === 'kk' && styles.languageOptionActive]}
              onPress={() => void handleLanguageSelect('kk')}
            >
              <Text style={styles.languageOptionCode}>KZ</Text>
              <Text style={styles.languageOptionLabel}>Қазақша</Text>
              {language === 'kk' ? <Ionicons name="checkmark" size={18} color={appColors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
              onPress={() => void handleLanguageSelect('en')}
            >
              <Text style={styles.languageOptionCode}>EN</Text>
              <Text style={styles.languageOptionLabel}>English</Text>
              {language === 'en' ? <Ionicons name="checkmark" size={18} color={appColors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.languageModalCancel}
              onPress={() => setIsLanguageModalVisible(false)}
            >
              <Text style={styles.languageModalCancelText}>{t('login.s_5')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.metricModalButtonText}>{t('profile.s_205')}</Text>
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    marginRight: 12,
  },
  pointsLabel: {
    flexShrink: 1,
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
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.textSoft,
    flexShrink: 1,
  },
  toNextText: {
    fontSize: 12,
    color: appColors.textSoft,
    fontWeight: '500',
    flexShrink: 1,
  },
  statsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: appColors.surface,
    width: (width - 56) / 2,
    minWidth: 0,
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
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
    width: '100%',
    paddingHorizontal: 2,
  },
  statCardLabel: {
    flexShrink: 1,
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
    minWidth: 0,
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
    maxWidth: width < 390 ? width - 24 : Math.min(520, width - 32),
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
    minWidth: 0,
    alignSelf: 'stretch',
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
    minWidth: 0,
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
    minWidth: 0,
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
    flex: 1,
    flexShrink: 1,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 12,
  },
  menuItemText: {
    flex: 1,
    flexShrink: 1,
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
  devNotificationsCard: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  devNotificationsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  devNotificationsIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  devNotificationsTextWrap: {
    flex: 1,
  },
  devNotificationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 4,
  },
  devNotificationsSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: appColors.textMuted,
  },
  devNotificationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: appColors.surfaceSoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  devNotificationsModeText: {
    flex: 1,
    paddingRight: 12,
  },
  devNotificationsModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.textSecondary,
    marginBottom: 3,
  },
  devNotificationsModeHint: {
    fontSize: 12,
    lineHeight: 17,
    color: appColors.textMuted,
  },
  devNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  devNotificationsButtonText: {
    color: appColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  languageModalContent: {
    width: '88%',
    maxWidth: 360,
    alignSelf: 'center',
    marginTop: '40%',
    backgroundColor: appColors.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  languageModalHeader: {
    marginBottom: 14,
  },
  languageModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: appColors.text,
    marginBottom: 6,
  },
  languageModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: appColors.textMuted,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  languageOptionActive: {
    borderWidth: 1.5,
    borderColor: appColors.primary,
    backgroundColor: appColors.primarySurface,
  },
  languageOptionCode: {
    width: 40,
    fontSize: 15,
    fontWeight: '800',
    color: appColors.primary,
  },
  languageOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: appColors.textSecondary,
  },
  languageModalCancel: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  languageModalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.textMuted,
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
