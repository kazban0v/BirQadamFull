import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
  LayoutRectangle,
  FlatList,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { volunteerAPI } from '../../services/api';
import type { DashboardStats, Project } from '../../types';
import { useDashboard } from '../../hooks/useDashboard';
import { useFavorites } from '../../hooks/useFavorites';
import { Header } from '../../components/dashboard/Header';
import { TrustFactorCard } from '../../components/dashboard/TrustFactorCard';
import { StatsGrid } from '../../components/dashboard/StatsGrid';
import { SearchBar } from '../../components/dashboard/SearchBar';
import { ProjectCard } from '../../components/dashboard/ProjectCard';
import { ProjectCardGrid } from '../../components/dashboard/ProjectCardGrid';
import { ProjectCoverPlaceholder } from '../../components/dashboard/ProjectCoverPlaceholder';
import { TutorialOverlay, type TutorialStep } from '../../components/dashboard/TutorialOverlay';
import { SkeletonHeader } from '../../components/dashboard/Skeleton/SkeletonHeader';
import { SkeletonProjectCard } from '../../components/dashboard/Skeleton/SkeletonProjectCard';
import { LeaveProjectReasonModal } from '../../components/projects/LeaveProjectReasonModal';
import { useTutorial } from '../../hooks/useTutorial';
import { getVolunteerTypeLabel, getVolunteerTypeColor, normalizeImageUrl, getSortLabel } from '../../utils/projectUtils';
import { formatFilteredProjectsCount } from '../../utils/formatFilteredProjectsCount';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { useAuthStore } from '../../store/authStore';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

interface VolunteerDashboardScreenProps {
  navigation: any;
}

export const VolunteerDashboardScreen: React.FC<VolunteerDashboardScreenProps> = ({
  navigation,
}) => {
  const { t, language } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isCompactTrustFactorModal = screenWidth <= 400;
  const isNarrowTrustFactorModal = screenWidth <= 390;
  const hasLoadedDashboardRef = useRef(false);
  const currentUser = useAuthStore((state) => state.user);

  // Используем hooks для данных
  const { loading, refreshing, data, loadDashboard } = useDashboard();
  const { favoriteProjects, toggleFavorite } = useFavorites();

  // Объединяем profile данные
  const profile = useMemo(() => ({
    trustFactor: data?.profile.trustFactor ?? 0,
    averageRating: data?.profile.averageRating ?? 0,
    userName: data?.profile.userName || t('dashboard.s_0'),
  }), [data?.profile]);

  const headerUserName = currentUser?.full_name || profile.userName;
  const headerAvatarUri = useMemo(() => {
    const normalizedAvatarUri = normalizeImageUrl(currentUser?.avatar);
    if (!normalizedAvatarUri) {
      return null;
    }

    return `${normalizedAvatarUri}${normalizedAvatarUri.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [currentUser]);

  const stats = useMemo((): DashboardStats => {
    // Принудительно приводим data к any, чтобы TS перестал искать summary в старом кэше
    const safeData = data as any;
    const backendData = safeData?.summary || safeData?.stats || {};

    return {
      total_tasks: backendData.total_tasks || 0,
      completed_tasks: backendData.completed_tasks || 0,
      total_hours: backendData.total_hours || 0,
      total_points: backendData.achievements_count || 0,
      achievements_count: backendData.achievements_count || 0,
      upcoming_tasks: backendData.upcoming_tasks || 0,
      active_projects: backendData.active_projects || 0,
    };
  }, [(data as any)?.summary, (data as any)?.stats]);

  const projects = useMemo(() => data?.projects || [], [data?.projects]);
  const [filter, setFilter] = useState<'all' | 'social' | 'environmental' | 'cultural'>('all');
  const activeTasks = useMemo(() => {
    const safeData = data as any;
    return safeData?.tasks || safeData?.upcoming_tasks || [];
  }, [data]);
  const nearestTask = activeTasks.length > 0 ? activeTasks[0] : null;
  const [showTrustFactorInfo, setShowTrustFactorInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'urgent' | 'alphabetical'>('newest');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Модальные окна присоединения/выхода
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');

  // Tutorial refs для элементов
  const headerRef = useRef<View>(null);
  const trustFactorRef = useRef<View>(null);
  const statsRef = useRef<View>(null);
  const searchRef = useRef<View>(null);

  // Шаги туториала
  const tutorialSteps: TutorialStep[] = useMemo(() => [
    {
      id: 'header',
      title: t('dashboard.s_1'),
      description: t('dashboard.s_2'),
      ref: headerRef,
      position: 'bottom' as const,
    },
    {
      id: 'trustFactor',
      title: 'Trust Factor',
      description: t('dashboard.s_3'),
      ref: trustFactorRef,
      position: 'bottom' as const,
    },
    {
      id: 'stats',
      title: t('dashboard.s_4'),
      description: t('dashboard.s_5'),
      ref: statsRef,
      position: 'bottom' as const,
    },
    {
      id: 'search',
      title: t('dashboard.s_6'),
      description: t('dashboard.s_7'),
      ref: searchRef,
      position: 'bottom' as const,
    },
  ], []);

  // Используем hook для туториала
  const {
    showTutorial,
    tutorialStep,
    highlightedElement,
    isProcessingNext,
    checkTutorialStatus,
    handleElementLayout,
    handleNextStep,
    prevTutorialStep,
    finishTutorial,
    skipTutorial,
  } = useTutorial(tutorialSteps, {
    storageKey: 'dashboardTutorialCompleted',
    autoStart: true,
    startDelay: 1500,
  });

  // Infinite scroll состояние
  const [displayedProjectsCount, setDisplayedProjectsCount] = useState<number>(10); // Начальное количество
  const [loadingMore, setLoadingMore] = useState(false);

  // Вычисляем количество проектов на страницу в зависимости от режима
  const ITEMS_PER_PAGE = viewMode === 'list' ? 5 : 6;

  // Сбрасываем счетчик при изменении режима отображения или фильтров
  useEffect(() => {
    setDisplayedProjectsCount(10);
  }, [viewMode, filter, selectedTags, searchQuery, dateFilter, sortBy]);

  // Состояние для отслеживания обновлений
  const [refreshUpdates, setRefreshUpdates] = useState<{
    projects: boolean;
    stats: boolean;
    trustFactor: boolean;
    recommendations: boolean;
  }>({
    projects: false,
    stats: false,
    trustFactor: false,
    recommendations: false,
  });

  // Анимации для toast уведомления
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-50)).current;

  // Анимации для обновленных элементов
  const statsCardAnimations = useRef({
    projects: new Animated.Value(1),
    tasks: new Animated.Value(1),
    achievements: new Animated.Value(1),
    trustFactor: new Animated.Value(1),
  }).current;

  // Shimmer анимация для скелетона
  const skeletonAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(skeletonAnim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [skeletonAnim]);

  // функции для запуска анимации обновление данных в приложение "Главная страница"

  // Открытие модального окна присоединения
  const handleJoinPress = useCallback((project: Project) => {
    if (profile.trustFactor <= 0) {
      Alert.alert(
        t('dashboard.s_8'),
        t('dashboard.s_9')
      );
      return;
    }

    setSelectedProject(project);
    setShowJoinModal(true);
  }, [profile.trustFactor]);

  // Открытие модального окна выхода
  const handleLeavePress = useCallback((project: Project) => {
    setSelectedProject(project);
    setLeaveReason('');
    setShowLeaveModal(true);
  }, []);

  // Присоединение к проекту
  const handleJoinProject = useCallback(async () => {
    if (!selectedProject) return;

    setIsJoining(true);
    try {
      await volunteerAPI.joinProject(selectedProject.id);
      await loadDashboard(true);
      setShowJoinModal(false);
      setSelectedProject(null);
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('dashboard.s_10'));
      const res = getAxiosErrorResponse(error);
      const tf = res?.data?.trust_factor;

      if (tf !== undefined) {
        Alert.alert(
          t('dashboard.s_11'),
          t('dashboard.s_89', { tf: String(tf), message: errorMessage })
        );
      } else {
        Alert.alert(t('dashboard.s_12'), errorMessage);
      }

      if (__DEV__) {
        console.error('Error joining project:', error);
      }
    } finally {
      setIsJoining(false);
    }
  }, [selectedProject, loadDashboard, t]);

  // Выход из проекта
  const handleLeaveProject = useCallback(async () => {
    if (!selectedProject) return;
    const trimmedReason = leaveReason.trim();

    if (!trimmedReason) {
      Alert.alert(t('dashboard.s_13'), t('dashboard.s_14'));
      return;
    }

    setIsLeaving(true);
    try {
      await volunteerAPI.leaveProject(selectedProject.id, trimmedReason);
      await loadDashboard(true);
      setShowLeaveModal(false);
      setLeaveReason('');
      setSelectedProject(null);
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('dashboard.s_15'));

      Alert.alert(t('dashboard.s_16'), errorMessage);

      if (__DEV__) {
        console.error('Error leaving project:', error);
      }
    } finally {
      setIsLeaving(false);
    }
  }, [leaveReason, selectedProject, loadDashboard]);



  // Функция для показа toast уведомления
  const showRefreshToast = (updates: typeof refreshUpdates) => {
    const updateMessages: string[] = [];

    if (updates.projects) {
      updateMessages.push(t('dashboard.s_17'));
    }
    if (updates.stats) {
      updateMessages.push(t('dashboard.s_18'));
    }
    if (updates.trustFactor) {
      updateMessages.push(t('dashboard.s_3'));
    }
    if (updates.recommendations) {
      updateMessages.push(t('dashboard.s_19'));
    }

    if (updateMessages.length === 0) {
      return; // Нет обновлений
    }

    const message = t('dashboard.s_88', { items: updateMessages.join(', ') });

    // Анимация появления toast
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Автоматически скрываем toast через 3 секунды
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRefreshUpdates({
          projects: false,
          stats: false,
          trustFactor: false,
          recommendations: false,
        });
      });
    }, 3000);
  };

  // Логика туториала вынесена в useTutorial hook

  useFocusEffect(
    useCallback(() => {
      void loadDashboard(hasLoadedDashboardRef.current).catch(() => undefined);
      hasLoadedDashboardRef.current = true;
    }, [loadDashboard])
  );

  // Проверяем туториал после того, как данные загружены и loading = false
  useEffect(() => {
    if (!loading && !showTutorial) {
      if (__DEV__) {
        console.log('Checking tutorial status after data loaded...');
      }
      // Небольшая задержка, чтобы элементы успели отрендериться
      const timer = setTimeout(() => {
        checkTutorialStatus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, showTutorial, checkTutorialStatus]);

  const onRefresh = useCallback(async () => {
    setDisplayedProjectsCount(10); // Сбрасываем счетчик при обновлении
    await loadDashboard(true);
  }, [loadDashboard]);

  // Функция для подгрузки дополнительных проектов
  const loadMoreProjects = async () => {
    // filteredProjects уже мемоизирован

    // Если уже показаны все проекты, не загружаем больше
    if (displayedProjectsCount >= filteredProjects.length) {
      return;
    }

    // Если загрузка уже идет, не запускаем повторно
    if (loadingMore) {
      return;
    }

    setLoadingMore(true);

    // Имитируем небольшую задержку для плавности
    await new Promise(resolve => setTimeout(resolve, 300));

    // Увеличиваем количество отображаемых проектов
    setDisplayedProjectsCount(prev => prev + ITEMS_PER_PAGE);

    setLoadingMore(false);
  };

  // Обработчик достижения конца списка
  const handleEndReached = () => {
    // filteredProjects уже мемоизирован
    if (displayedProjectsCount < filteredProjects.length && !loadingMore) {
      loadMoreProjects();
    }
  };

  // Получаем все уникальные теги из проектов
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    projects.forEach(project => {
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [projects]);

  // Расширенная фильтрация проектов с useMemo
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Фильтр по типу
    if (filter !== 'all') {
      filtered = filtered.filter(p => p.volunteer_type === filter);
    }

    // Фильтр по тегам
    if (selectedTags.length > 0) {
      filtered = filtered.filter(project => {
        if (!project.tags || !Array.isArray(project.tags)) return false;
        return selectedTags.some(tag => project.tags!.includes(tag));
      });
    }

    // Фильтр по поиску
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project =>
        project.title?.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query) ||
        project.city?.toLowerCase().includes(query)
      );
    }

    // Фильтр по дате
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(project => {
        if (!project.start_date) return false;
        const projectDate = new Date(project.start_date);

        if (dateFilter === 'today') {
          return projectDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return projectDate >= now && projectDate <= weekFromNow;
        } else if (dateFilter === 'month') {
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          return projectDate >= now && projectDate <= monthFromNow;
        }
        return true;
      });
    }

    // Применяем сортировку
    const sorted = [...filtered];
    switch (sortBy) {
      case 'popular':
        sorted.sort((a, b) => (b.active_members || 0) - (a.active_members || 0));
        break;
      case 'urgent':
        sorted.sort((a, b) => {
          if (!a.start_date) return 1;
          if (!b.start_date) return -1;
          return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        });
        break;
      case 'alphabetical':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
        break;
      case 'newest':
      default:
        // Уже отсортировано при загрузке
        break;
    }

    return sorted;
  }, [projects, filter, selectedTags, searchQuery, dateFilter, sortBy]);

  const filteredProjectsCountLabel = useMemo(
    () => formatFilteredProjectsCount(filteredProjects.length, language),
    [filteredProjects.length, language]
  );

  // Функция для получения избранных проектов
  const getFavoriteProjects = useMemo(() => {
    return filteredProjects.filter(p => favoriteProjects.includes(p.id));
  }, [filteredProjects, favoriteProjects]);

  // Получение рекомендаций на основе истории пользователя
  const recommendedProjects = useMemo(() => {
    // Проекты, в которых пользователь участвовал
    const joinedProjects = projects.filter(p => p.joined);

    // Если нет истории участия, возвращаем популярные проекты
    if (joinedProjects.length === 0) {
      return filteredProjects
        .filter(p => !p.joined)
        .sort((a, b) => (b.active_members || 0) - (a.active_members || 0))
        .slice(0, 6);
    }

    // Собираем предпочтения пользователя
    const preferredTypes: string[] = [];
    const preferredTags: string[] = [];
    const preferredCities: string[] = [];

    joinedProjects.forEach(project => {
      // Типы проектов
      if (project.volunteer_type && !preferredTypes.includes(project.volunteer_type)) {
        preferredTypes.push(project.volunteer_type);
      }

      // Теги
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach(tag => {
          if (!preferredTags.includes(tag)) {
            preferredTags.push(tag);
          }
        });
      }

      // Города
      if (project.city && !preferredCities.includes(project.city)) {
        preferredCities.push(project.city);
      }
    });

    // Также учитываем избранные проекты
    const favoriteProjectsData = projects.filter(p => favoriteProjects.includes(p.id));
    favoriteProjectsData.forEach(project => {
      if (project.volunteer_type && !preferredTypes.includes(project.volunteer_type)) {
        preferredTypes.push(project.volunteer_type);
      }
      if (project.tags && Array.isArray(project.tags)) {
        project.tags.forEach(tag => {
          if (!preferredTags.includes(tag)) {
            preferredTags.push(tag);
          }
        });
      }
    });

    // Ранжируем проекты по релевантности
    const scoredProjects = projects
      .filter(p => !p.joined) // Только проекты, в которых не участвуем
      .map(project => {
        let score = 0;

        // Совпадение типа проекта (+3 балла)
        if (project.volunteer_type && preferredTypes.includes(project.volunteer_type)) {
          score += 3;
        }

        // Совпадение тегов (+2 балла за каждый тег)
        if (project.tags && Array.isArray(project.tags)) {
          project.tags.forEach(tag => {
            if (preferredTags.includes(tag)) {
              score += 2;
            }
          });
        }

        // Совпадение города (+1 балл)
        if (project.city && preferredCities.includes(project.city)) {
          score += 1;
        }

        // Популярность (+0.5 балла за каждые 10 участников)
        score += (project.active_members || 0) / 20;

        return { project, score };
      })
      .filter(item => item.score > 0) // Только проекты с положительным score
      .sort((a, b) => b.score - a.score)
      .map(item => item.project)
      .slice(0, 6); // Максимум 6 рекомендаций

    // Если рекомендаций мало, добавляем популярные проекты
    if (scoredProjects.length < 6) {
      const popular = projects
        .filter(p => !p.joined && !scoredProjects.find(sp => sp.id === p.id))
        .sort((a, b) => (b.active_members || 0) - (a.active_members || 0))
        .slice(0, 6 - scoredProjects.length);
      return [...scoredProjects, ...popular];
    }

    return scoredProjects;
  }, [projects, favoriteProjects, filteredProjects]);

  // Количество проектов, в которых участвует пользователь
  const joinedProjectsCount = useMemo(() => {
    return stats.active_projects || 0;
  }, [stats.active_projects]);

  // Обработчики нажатий на карточки статистики
  const handleProjectsPress = useCallback(() => {
    navigation.navigate('VolunteerMyProjects');
  }, [navigation]);

  // Переход на экран достижений
  const handleAchievementsPress = useCallback(() => {
    navigation.navigate('VolunteerAchievements');
  }, [navigation]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setFilter('all');
    setSelectedTags([]);
    setSearchQuery('');
    setDateFilter('all');
    setSortBy('newest');
  }, []);

  const activeFiltersCount = useMemo(() =>
    (filter !== 'all' ? 1 : 0) +
    selectedTags.length +
    (searchQuery.trim() ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0),
    [filter, selectedTags, searchQuery, dateFilter]
  );

  // Skeleton компоненты теперь в отдельных файлах
  const skeletonOpacity = skeletonAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const SkeletonScreen = () => (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <Animated.View style={{ opacity: skeletonOpacity }}>
          <SkeletonHeader />
          {/* Skeleton Trust Factor placeholder */}
          <View style={styles.skeletonTrustFactorBlock} />
          {/* Skeleton Stats Row */}
          <View style={styles.skeletonStatsRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonStatCard} />
            ))}
          </View>
          <View style={{ marginHorizontal: 20, marginTop: 24 }}>
            {[1, 2, 3].map((i) => (
              <SkeletonProjectCard key={i} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );

  if (loading) {
    return <SkeletonScreen />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
            colors={[appColors.primary]}
            progressBackgroundColor={appColors.surface}
            progressViewOffset={Platform.OS === 'android' ? 20 : 0}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          // Проверяем, достигли ли мы конца списка
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 200; // Загружаем заранее, за 200px до конца
          const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

          if (isCloseToBottom) {
            handleEndReached();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Header */}
        <Header
          userName={headerUserName}
          avatarUrl={headerAvatarUri}
          onNotificationPress={() => navigation.navigate('VolunteerNotifications')}
          hasUnreadNotifications={(data?.unreadNotifications ?? 0) > 0}
          onLayout={(e) => showTutorial && tutorialStep === 0 && handleElementLayout('header', e)}
          innerRef={headerRef}
        />

        {/* Trust Factor Card */}
        <TrustFactorCard
          trustFactor={profile.trustFactor}
          averageRating={profile.averageRating}
          projectsCount={projects.length}
          onInfoPress={() => setShowTrustFactorInfo(true)}
          onStatsPress={() => navigation.navigate('ProfileTab')}
          scaleAnimation={statsCardAnimations.trustFactor}
          onLayout={(e) => showTutorial && tutorialStep === 1 && handleElementLayout('trustFactor', e)}
          innerRef={trustFactorRef}
        />

        {/* Stats Grid */}
        <StatsGrid
          stats={stats}
          joinedProjectsCount={joinedProjectsCount}
          onProjectsPress={handleProjectsPress}
          onTasksPress={() => navigation.navigate('TasksTab')}
          onAchievementsPress={handleAchievementsPress}
          animations={statsCardAnimations}
          onLayout={(e) => showTutorial && tutorialStep === 2 && handleElementLayout('stats', e)}
          innerRef={statsRef}
        />
        {/* Ближайшая задача (ПОЯВЛЯЕТСЯ ТОЛЬКО ЕСЛИ ЕСТЬ ЗАДАЧИ) */}
        {nearestTask && (
          <View style={styles.nearestTaskContainer}>
            <View style={styles.nearestTaskHeader}>
              <View style={styles.nearestTaskTitleRow}>
                <View style={styles.nearestTaskIconBadge}>
                  <Ionicons name="calendar-outline" size={16} color={appColors.warning} />
                </View>
                <Text style={styles.nearestTaskTitle}>{t('dashboard.s_20')}</Text>
              </View>
              <TouchableOpacity
                style={styles.nearestTaskViewAllButton}
                onPress={() => navigation.navigate('TasksTab')}
              >
                <Text style={styles.nearestTaskViewAll}>{t('dashboard.s_21')}</Text>
                <Ionicons name="chevron-forward" size={14} color={appColors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              key={nearestTask.id}
              style={styles.nearestTaskCard}
              onPress={() => navigation.navigate('VolunteerTaskDetail', { taskId: nearestTask.task_id || nearestTask.id })}
              activeOpacity={0.75}
            >
              <View style={styles.nearestTaskAccentBar} />
              <View style={styles.nearestTaskInfo}>
                <Text style={styles.nearestTaskName} numberOfLines={1}>
                  {nearestTask.text || nearestTask.title || t('dashboard.s_22')}
                </Text>
                <Text style={styles.nearestTaskProjectName} numberOfLines={1}>
                  {nearestTask.project_title || t('dashboard.s_23')}
                </Text>

                <View style={styles.nearestTaskMeta}>
                  <View style={styles.nearestTaskMetaItem}>
                    <Ionicons name="time-outline" size={13} color={appColors.warning} />
                    <Text style={styles.nearestTaskMetaText}>
                      {nearestTask.deadline_date
                        ? new Date(nearestTask.deadline_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                        : t('dashboard.s_24')}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.nearestTaskIconContainer}>
                <Ionicons name="chevron-forward" size={18} color={appColors.warning} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterPress={() => setShowFilters(true)}
          activeFiltersCount={activeFiltersCount}
          onLayout={(e) => showTutorial && tutorialStep === 3 && handleElementLayout('search', e)}
          innerRef={searchRef}
        />

        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <View style={styles.activeFiltersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
              {filter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{getVolunteerTypeLabel(filter)}</Text>
                  <TouchableOpacity onPress={() => setFilter('all')}>
                    <Ionicons name="close-circle" size={16} color={appColors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              {dateFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    {dateFilter === 'today' ? t('dashboard.s_25') : dateFilter === 'week' ? t('dashboard.s_26') : t('dashboard.s_27')}
                  </Text>
                  <TouchableOpacity onPress={() => setDateFilter('all')}>
                    <Ionicons name="close-circle" size={16} color={appColors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              {selectedTags.map(tag => (
                <View key={tag} style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>#{tag}</Text>
                  <TouchableOpacity onPress={() => toggleTag(tag)}>
                    <Ionicons name="close-circle" size={16} color={appColors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>{t('dashboard.s_28')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
              {t('dashboard.s_29')}</Text>
          </TouchableOpacity>

          {favoriteProjects.length > 0 && (
            <TouchableOpacity
              style={[styles.filterPill, styles.filterPillFavorite]}
              onPress={() => {
                // Показываем только избранные проекты
                setFilter('all');
                setSearchQuery('');
                setDateFilter('all');
                setSelectedTags([]);
              }}
            >
              <Ionicons name="heart" size={14} color={appColors.danger} />
              <Text style={[styles.filterPillText, styles.filterPillFavoriteText]}>
                {t('dashboard.s_30', { count: favoriteProjects.length })}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.filterPill, filter === 'social' && styles.filterPillActive]}
            onPress={() => setFilter('social')}
          >
            <Text style={[styles.filterPillText, filter === 'social' && styles.filterPillTextActive]}>
              {t('dashboard.s_31')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filter === 'environmental' && styles.filterPillActive]}
            onPress={() => setFilter('environmental')}
          >
            <Text style={[styles.filterPillText, filter === 'environmental' && styles.filterPillTextActive]}>
              {t('dashboard.s_32')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, filter === 'cultural' && styles.filterPillActive]}
            onPress={() => setFilter('cultural')}
          >
            <Text style={[styles.filterPillText, filter === 'cultural' && styles.filterPillTextActive]}>
              {t('dashboard.s_33')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Избранные проекты (если есть) */}
        {favoriteProjects.length > 0 && filter === 'all' && !searchQuery && selectedTags.length === 0 && dateFilter === 'all' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={20} color={appColors.danger} />
                <Text style={styles.sectionTitle}>{t('dashboard.s_34')}</Text>
              </View>
              <Text style={styles.sectionCount}>{favoriteProjects.length}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoriteProjectsScroll}
            >
              {getFavoriteProjects.slice(0, 3).map((project) => (
                <View key={project.id} style={styles.favoriteProjectCard}>
                  <TouchableOpacity
                    style={styles.favoriteProjectCardInner}
                    onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
                  >
                    {normalizeImageUrl(project.cover_image_url) ? (
                      <Image
                        source={{ uri: normalizeImageUrl(project.cover_image_url) }}
                        style={styles.favoriteProjectImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <ProjectCoverPlaceholder
                        style={[styles.favoriteProjectImage, styles.favoriteProjectImagePlaceholder]}
                        size="sm"
                      />
                    )}
                    <View style={styles.favoriteProjectInfo}>
                      <Text style={styles.favoriteProjectTitle} numberOfLines={2}>
                        {project.title}
                      </Text>
                      <View style={styles.favoriteProjectMeta}>
                        <Ionicons name="people-outline" size={12} color={appColors.textMuted} />
                        <Text style={styles.favoriteProjectMetaText}>
                          {project.active_members || 0}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.favoriteProjectHeartIcon}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(project.id);
                      }}
                    >
                      <Ionicons name="heart" size={16} color={appColors.danger} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recommended Projects */}
        {recommendedProjects.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="sparkles" size={20} color={appColors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>{t('dashboard.s_35')}</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              {t('dashboard.s_36')}</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recommendedProjectsScroll}
            >
              {recommendedProjects.map((project) => (
                <View key={project.id} style={styles.recommendedProjectCard}>
                  <TouchableOpacity
                    style={styles.recommendedProjectCardInner}
                    onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
                  >
                    {normalizeImageUrl(project.cover_image_url) ? (
                      <Image
                        source={{ uri: normalizeImageUrl(project.cover_image_url) }}
                        style={styles.recommendedProjectImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <ProjectCoverPlaceholder
                        style={[styles.recommendedProjectImage, styles.recommendedProjectImagePlaceholder]}
                        size="sm"
                      />
                    )}
                    <View style={[styles.recommendedProjectTypeBadge, { backgroundColor: getVolunteerTypeColor(project.volunteer_type) }]}>
                      <Text style={styles.recommendedProjectTypeText}>
                        {getVolunteerTypeLabel(project.volunteer_type).toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.recommendedProjectFavoriteIcon}
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(project.id);
                      }}
                    >
                      <Ionicons
                        name={favoriteProjects.includes(project.id) ? "heart" : "heart-outline"}
                        size={16}
                        color={favoriteProjects.includes(project.id) ? appColors.danger : appColors.white}
                      />
                    </TouchableOpacity>
                    <View style={styles.recommendedProjectInfo}>
                      <Text style={styles.recommendedProjectTitle} numberOfLines={2}>
                        {project.title}
                      </Text>
                      <View style={styles.recommendedProjectMeta}>
                        <Ionicons name="people-outline" size={12} color={appColors.textMuted} />
                        <Text style={styles.recommendedProjectMetaText}>
                          {project.active_members || 0} {t('dashboard.s_37')}</Text>
                        <Ionicons name="location-outline" size={12} color={appColors.textMuted} style={styles.recommendedProjectMetaIcon} />
                        <Text style={styles.recommendedProjectMetaText}>
                          {project.city || t('dashboard.s_38')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Upcoming Opportunities */}
        <View
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('dashboard.s_39')}</Text>
            <View style={styles.sectionHeaderRight}>
              <TouchableOpacity
                style={styles.viewModeButton}
                onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              >
                <Ionicons
                  name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                  size={18}
                  color={appColors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsInfoText}>{filteredProjectsCountLabel}</Text>
          </View>

          {viewMode === 'list' ? (
            <>
              {filteredProjects.slice(0, displayedProjectsCount).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isFavorite={favoriteProjects.includes(project.id)}
                  onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
                  onFavoritePress={toggleFavorite}
                  onJoinPress={handleJoinPress}
                  onLeavePress={handleLeavePress}
                />
              ))}
            </>
          ) : (
            <View style={styles.projectsGrid}>
              {filteredProjects.slice(0, displayedProjectsCount).map((project) => (
                <ProjectCardGrid
                  key={project.id}
                  project={project}
                  isFavorite={favoriteProjects.includes(project.id)}
                  onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
                  onFavoritePress={toggleFavorite}
                />
              ))}
            </View>
          )}

          {filteredProjects.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconCircle}>
                <Ionicons name="folder-open-outline" size={36} color={appColors.primary} />
              </View>
              <Text style={styles.emptyText}>{t('dashboard.s_44')}</Text>
              <Text style={styles.emptySubText}>{t('dashboard.s_45')}</Text>
            </View>
          )}

          {/* Индикатор загрузки дополнительных проектов */}
          {loadingMore && displayedProjectsCount < filteredProjects.length && (
            <View style={styles.loadingMoreContainer}>
              <View style={styles.loadingMoreDot} />
              <ActivityIndicator size="small" color={appColors.primary} style={{ marginHorizontal: 8 }} />
              <View style={styles.loadingMoreDot} />
            </View>
          )}

          {/* Кнопка "Показать все" только если все проекты загружены и их больше начального количества */}
          {!loadingMore &&
            displayedProjectsCount >= filteredProjects.length &&
            filteredProjects.length > 10 && (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={() => navigation.navigate('VolunteerProjects')}
              >
                <Text style={styles.showAllButtonText}>{t('dashboard.s_46')}</Text>
                <Ionicons name="checkmark-circle" size={16} color={appColors.primary} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
        </View>
      </ScrollView>

      {/* Tutorial Overlay */}
      <TutorialOverlay
        visible={showTutorial}
        currentStep={tutorialStep}
        steps={tutorialSteps}
        highlightedElement={highlightedElement}
        onNext={handleNextStep}
        onPrev={prevTutorialStep}
        onSkip={skipTutorial}
        onFinish={finishTutorial}
        isProcessingNext={isProcessingNext}
        canGoBack={tutorialStep > 0}
      />

      {/* Refresh Toast Notification */}
      {(refreshUpdates.projects || refreshUpdates.stats || refreshUpdates.trustFactor || refreshUpdates.recommendations) && (
        <Animated.View
          style={[
            styles.refreshToast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View style={styles.refreshToastContent}>
            <View style={styles.refreshToastIconCircle}>
              <Ionicons name="checkmark" size={14} color={appColors.white} />
            </View>
            <Text style={styles.refreshToastText}>
              {(() => {
                const messages: string[] = [];
                if (refreshUpdates.projects) messages.push(t('dashboard.s_47'));
                if (refreshUpdates.stats) messages.push(t('dashboard.s_48'));
                if (refreshUpdates.trustFactor) messages.push(t('dashboard.s_3'));
                if (refreshUpdates.recommendations) messages.push(t('dashboard.s_49'));
                return t('dashboard.s_88', { items: messages.join(', ') });
              })()}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Filters Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <TouchableOpacity
            style={styles.filterModalOverlay}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.filterModalContent, { maxHeight: screenHeight * 0.85 }]}
            >
              <View style={styles.filterModalHandle} />

              <View style={styles.filterModalHeader}>
                <Text style={styles.filterModalTitle}>{t('dashboard.s_50')}</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Ionicons name="close" size={24} color={appColors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.filterModalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Сортировка */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>{t('dashboard.s_51')}</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'newest', label: t('dashboard.s_52'), icon: 'time-outline' },
                      { value: 'popular', label: t('dashboard.s_53'), icon: 'trending-up-outline' },
                      { value: 'urgent', label: t('dashboard.s_54'), icon: 'flash-outline' },
                      { value: 'alphabetical', label: t('dashboard.s_55'), icon: 'text-outline' },
                    ].map(option => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.filterOptionChip,
                          sortBy === option.value && styles.filterOptionChipActive,
                        ]}
                        onPress={() => setSortBy(option.value as any)}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={16}
                          color={sortBy === option.value ? appColors.white : appColors.textMuted}
                        />
                        <Text
                          style={[
                            styles.filterOptionChipText,
                            sortBy === option.value && styles.filterOptionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {sortBy === option.value && (
                          <Ionicons name="checkmark-circle" size={16} color={appColors.white} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Тип проекта */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>{t('dashboard.s_56')}</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'all', label: t('dashboard.s_29') },
                      { value: 'social', label: t('dashboard.s_31') },
                      { value: 'environmental', label: t('dashboard.s_32') },
                      { value: 'cultural', label: t('dashboard.s_33') },
                    ].map(option => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.filterOptionChip,
                          filter === option.value && styles.filterOptionChipActive,
                        ]}
                        onPress={() => setFilter(option.value as any)}
                      >
                        <Text
                          style={[
                            styles.filterOptionChipText,
                            filter === option.value && styles.filterOptionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {filter === option.value && (
                          <Ionicons name="checkmark-circle" size={16} color={appColors.white} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Дата начала */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>{t('dashboard.s_61')}</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'all', label: t('dashboard.s_62') },
                      { value: 'today', label: t('dashboard.s_25') },
                      { value: 'week', label: t('dashboard.s_26') },
                      { value: 'month', label: t('dashboard.s_27') },
                    ].map(option => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.filterOptionChip,
                          dateFilter === option.value && styles.filterOptionChipActive,
                        ]}
                        onPress={() => setDateFilter(option.value as any)}
                      >
                        <Text
                          style={[
                            styles.filterOptionChipText,
                            dateFilter === option.value && styles.filterOptionChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {dateFilter === option.value && (
                          <Ionicons name="checkmark-circle" size={16} color={appColors.white} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Теги */}
                {allTags.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>{t('dashboard.s_66')}</Text>
                    <View style={styles.filterTagsContainer}>
                      {allTags.map(tag => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.filterTagChip,
                            selectedTags.includes(tag) && styles.filterTagChipActive,
                          ]}
                          onPress={() => toggleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.filterTagChipText,
                              selectedTags.includes(tag) && styles.filterTagChipTextActive,
                            ]}
                          >
                            #{tag}
                          </Text>
                          {selectedTags.includes(tag) && (
                            <Ionicons name="checkmark-circle" size={14} color={appColors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.filterModalFooter}>
                <TouchableOpacity
                  style={styles.filterModalClearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.filterModalClearButtonText}>{t('dashboard.s_67')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterModalApplyButton}
                  onPress={() => setShowFilters(false)}
                >
                  <Text style={styles.filterModalApplyButtonText}>{t('dashboard.s_68')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Trust Factor Info Modal */}
      <Modal
        visible={showTrustFactorInfo}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTrustFactorInfo(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                styles.trustFactorModalContent,
                isCompactTrustFactorModal && styles.trustFactorModalContentCompact,
                { maxHeight: screenHeight * 0.88 },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  styles.trustFactorModalHeader,
                  isCompactTrustFactorModal && styles.trustFactorModalHeaderCompact,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.modalCloseButton,
                    styles.trustFactorModalCloseButton,
                    isCompactTrustFactorModal && styles.trustFactorModalCloseButtonCompact,
                  ]}
                  onPress={() => setShowTrustFactorInfo(false)}
                >
                  <Ionicons name="close" size={24} color={appColors.text} />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.modalTitle,
                    styles.trustFactorModalTitle,
                    isCompactTrustFactorModal && styles.trustFactorModalTitleCompact,
                  ]}
                >
                  {t('dashboard.s_69')}</Text>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.trustFactorModalScrollContent,
                  isCompactTrustFactorModal && styles.trustFactorModalScrollContentCompact,
                ]}
              >
                <View style={[styles.modalBody, { marginBottom: 0 }]}>
                  <Text style={styles.tfDescription}>
                    <Text style={styles.modalTextBold}>Trust Factor (TF)</Text> {t('dashboard.s_70')}</Text>

                  <View style={styles.tfMaxPoints}>
                    <Text style={styles.tfMaxPointsText}>{t('dashboard.s_71')}</Text>
                  </View>

                  <View style={styles.tfZeroWarning}>
                    <Text style={styles.tfZeroWarningText}>{t('dashboard.s_72')}</Text>
                  </View>

                  <View style={[styles.tfSection, isCompactTrustFactorModal && styles.tfSectionCompact]}>
                    <Text style={styles.tfSectionTitle}>{t('dashboard.s_73')}</Text>
                    <View style={styles.tfPointsList}>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <View style={[styles.tfPointItemLeft, isNarrowTrustFactorModal && styles.tfPointItemLeftCompact]}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_74')}</Text>
                        </View>
                        <Text style={[styles.tfPointValue, isNarrowTrustFactorModal && styles.tfPointValueCompact]}>+2</Text>
                      </View>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <View style={[styles.tfPointItemLeft, isNarrowTrustFactorModal && styles.tfPointItemLeftCompact]}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_75')}</Text>
                        </View>
                        <Text style={[styles.tfPointValue, isNarrowTrustFactorModal && styles.tfPointValueCompact]}>+1</Text>
                      </View>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <View style={[styles.tfPointItemLeft, isNarrowTrustFactorModal && styles.tfPointItemLeftCompact]}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_76')}</Text>
                        </View>
                        <Text style={[styles.tfPointValue, isNarrowTrustFactorModal && styles.tfPointValueCompact]}>0</Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.tfSection, styles.tfSectionDeduct, isCompactTrustFactorModal && styles.tfSectionCompact]}>
                    <Text style={styles.tfSectionTitle}>{t('dashboard.s_77')}</Text>
                    <View style={styles.tfPointsList}>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_78')}</Text>
                        <Text
                          style={[
                            styles.tfPointValue,
                            styles.tfPointValueNegative,
                            isNarrowTrustFactorModal && styles.tfPointValueCompact,
                          ]}
                        >
                          -5
                        </Text>
                      </View>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <View style={[styles.tfPointItemLeft, isNarrowTrustFactorModal && styles.tfPointItemLeftCompact]}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_79')}</Text>
                        </View>
                        <Text
                          style={[
                            styles.tfPointValue,
                            styles.tfPointValueNegative,
                            isNarrowTrustFactorModal && styles.tfPointValueCompact,
                          ]}
                        >
                          -1
                        </Text>
                      </View>
                      <View style={[styles.tfPointItem, isNarrowTrustFactorModal && styles.tfPointItemCompact]}>
                        <Text style={[styles.tfPointText, isNarrowTrustFactorModal && styles.tfPointTextCompact]}>{t('dashboard.s_80')}</Text>
                        <Text
                          style={[
                            styles.tfPointValue,
                            styles.tfPointValueNegative,
                            isNarrowTrustFactorModal && styles.tfPointValueCompact,
                          ]}
                        >
                          -2
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.tfTip, isCompactTrustFactorModal && styles.tfTipCompact]}>
                    <Ionicons name="location" size={16} color={appColors.primary} style={styles.tfTipIcon} />
                    <Text style={[styles.tfTipText, isCompactTrustFactorModal && styles.tfTipTextCompact]}>
                      {t('dashboard.s_81')}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Project Modal */}
      <Modal
        visible={showJoinModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: screenHeight * 0.85 }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="checkmark-circle-outline" size={32} color={appColors.primary} />
                </View>
                <Text style={styles.modalTitle}>{t('dashboard.s_82')}</Text>
              </View>

              {selectedProject && (
                <View style={styles.modalBody}>
                  <View style={styles.joinProjectInfo}>
                    <Text style={styles.joinProjectTitle}>{selectedProject.title}</Text>
                    <View style={styles.joinProjectMeta}>
                      <View style={styles.joinProjectMetaItem}>
                        <Ionicons name="location-outline" size={16} color={appColors.textMuted} />
                        <Text style={styles.joinProjectMetaText}>
                          {selectedProject.city || t('dashboard.s_83')}
                        </Text>
                      </View>
                      {selectedProject.start_date && (
                        <View style={styles.joinProjectMetaItem}>
                          <Ionicons name="calendar-outline" size={16} color={appColors.textMuted} />
                          <Text style={styles.joinProjectMetaText}>
                            {new Date(selectedProject.start_date).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long'
                            })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.modalInfoBox}>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="information-circle" size={20} color={appColors.primary} />
                      <Text style={styles.modalInfoText}>
                        {t('dashboard.s_84')}</Text>
                    </View>

                    <View style={styles.modalInfoRow}>
                      <Ionicons name="trophy" size={20} color={appColors.warning} />
                      <Text style={styles.modalInfoText}>
                        {t('dashboard.s_85')}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowJoinModal(false)}
                  disabled={isJoining}
                >
                  <Text
                    style={styles.modalButtonSecondaryText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >{t('dashboard.s_86')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleJoinProject}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color={appColors.white} />
                  ) : (
                    <Text
                      style={styles.modalButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >{t('dashboard.s_87')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LeaveProjectReasonModal
        visible={showLeaveModal}
        projectTitle={selectedProject?.title}
        reason={leaveReason}
        loading={isLeaving}
        onChangeReason={setLeaveReason}
        onClose={() => {
          if (isLeaving) {
            return;
          }
          setShowLeaveModal(false);
          setLeaveReason('');
          setSelectedProject(null);
        }}
        onConfirm={handleLeaveProject}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  nearestTaskContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  nearestTaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nearestTaskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearestTaskIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: appColors.warningSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearestTaskTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: appColors.text,
  },
  nearestTaskViewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  nearestTaskViewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.primary,
  },
  nearestTaskCard: {
    backgroundColor: appColors.warningSurface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#B45309',
    overflow: 'hidden',
  },
  nearestTaskAccentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: appColors.warning,
    borderRadius: 4,
    marginRight: 14,
    marginLeft: 0,
    minHeight: 48,
  },
  nearestTaskInfo: {
    flex: 1,
    paddingRight: 8,
  },
  nearestTaskName: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 3,
  },
  nearestTaskProjectName: {
    fontSize: 12,
    color: appColors.textMuted,
    marginBottom: 8,
  },
  nearestTaskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nearestTaskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  nearestTaskMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: appColors.warning,
  },
  nearestTaskIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterScroll: {
    marginTop: 20,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    borderWidth: 1.5,
    borderColor: appColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  filterPillActive: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.textMuted,
    letterSpacing: 0.1,
  },
  filterPillTextActive: {
    color: appColors.white,
  },
  filterPillFavorite: {
    backgroundColor: appColors.dangerSurface,
    borderColor: '#7F1D1D',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filterPillFavoriteText: {
    color: appColors.danger,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: appColors.text,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: appColors.textMuted,
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    flexShrink: 1,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.primary,
    flexShrink: 1,
  },
  resultsInfo: {
    marginBottom: 12,
  },
  resultsInfoText: {
    fontSize: 13,
    color: appColors.textMuted,
  },
  // Стили для SearchBar перенесены в компонент SearchBar
  activeFiltersContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  activeFiltersScroll: {
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.primary,
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4C1D24',
    borderRadius: 16,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.danger,
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primarySurface,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: appColors.primary,
    gap: 6,
  },
  showAllButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.primary,
    letterSpacing: 0.1,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 0,
  },
  loadingMoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: appColors.primary,
    opacity: 0.35,
  },
  loadingMoreText: {
    fontSize: 14,
    color: appColors.textMuted,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    gap: 8,
  },
  emptyStateIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.text,
    marginTop: 4,
  },
  emptySubText: {
    fontSize: 13,
    color: appColors.textSoft,
    fontWeight: '400',
  },
  // Modal Styles
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 20 : 16,
  },
  modalContent: {
    backgroundColor: appColors.surface,
    borderRadius: 24,
    padding: Platform.OS === 'ios' ? 24 : 20,
    width: '90%',
    maxWidth: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  tfModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: Platform.OS === 'ios' ? 22 : 20,
    fontWeight: '800',
    color: appColors.text,
    textAlign: 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 40 : 20,
  },
  modalBody: {
    marginBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  modalText: {
    fontSize: 15,
    color: appColors.textMuted,
    lineHeight: 24,
    marginBottom: 16,
  },
  modalTextBold: {
    fontWeight: '700',
    color: appColors.text,
  },
  modalInfoBox: {
    backgroundColor: appColors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 14,
    color: appColors.textMuted,
    marginLeft: 12,
    lineHeight: 20,
  },
  modalExample: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 20,
    fontStyle: 'italic',
    backgroundColor: appColors.warningSurface,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: appColors.warning,
  },
  modalButton: {
    backgroundColor: appColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.white,
    paddingHorizontal: 4,
  },
  // Trust Factor Modal Styles
  infoIconButton: {
    marginLeft: 4,
    padding: 2,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.surfaceSoft,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  trustFactorModalContent: {
    padding: 0,
    overflow: 'hidden',
    width: '94%',
    maxWidth: 520,
  },
  trustFactorModalContentCompact: {
    width: '96%',
    maxWidth: 440,
    borderRadius: 20,
  },
  trustFactorModalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    marginBottom: 0,
  },
  trustFactorModalHeaderCompact: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  trustFactorModalCloseButton: {
    top: 15,
    right: 15,
  },
  trustFactorModalCloseButtonCompact: {
    top: 12,
    right: 12,
  },
  trustFactorModalTitle: {
    marginTop: 8,
    paddingHorizontal: 56,
  },
  trustFactorModalTitleCompact: {
    fontSize: 17,
    lineHeight: 23,
    marginTop: 8,
    paddingHorizontal: 42,
  },
  trustFactorModalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  trustFactorModalScrollContentCompact: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tfDescription: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    color: appColors.text,
    lineHeight: Platform.OS === 'ios' ? 22 : 20,
    marginBottom: 12,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  tfMaxPoints: {
    backgroundColor: appColors.primarySurface,
    padding: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  tfMaxPointsText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: appColors.primary,
  },
  tfZeroWarning: {
    backgroundColor: appColors.dangerSurface,
    padding: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  tfZeroWarningText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: appColors.danger,
  },
  tfSection: {
    backgroundColor: appColors.primarySurface,
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 16 : 14,
    marginBottom: 12,
    width: '100%',
  },
  tfSectionCompact: {
    padding: 12,
  },
  tfSectionDeduct: {
    backgroundColor: appColors.dangerSurface,
  },
  tfSectionTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: Platform.OS === 'ios' ? 12 : 10,
  },
  tfPointsList: {
    // gap заменён на marginBottom в tfPointItem для совместимости
  },
  tfPointItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    minHeight: Platform.OS === 'ios' ? 40 : 36,
    marginBottom: 10,
  },
  tfPointItemCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    minHeight: 0,
    paddingVertical: 8,
  },
  tfPointItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  tfPointItemLeftCompact: {
    alignItems: 'flex-start',
    marginRight: 0,
    width: '100%',
  },
  tfPointText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: appColors.text,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
    marginLeft: 8, // Заменяет gap: 8
  },
  tfPointTextCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  tfPointValue: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: appColors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
  tfPointValueCompact: {
    marginTop: 6,
    textAlign: 'left',
  },
  tfPointValueNegative: {
    color: appColors.danger,
  },
  tfTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: appColors.primarySurface,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
  },
  tfTipCompact: {
    padding: 10,
  },
  tfTipIcon: {
    marginRight: 8, // Заменяет gap: 8
    marginTop: 2,
  },
  tfTipText: {
    flex: 1,
    fontSize: Platform.OS === 'ios' ? 13 : 12,
    color: '#065F46',
    lineHeight: Platform.OS === 'ios' ? 18 : 16,
  },
  tfTipTextCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  // Join/Leave Project Modal Styles
  joinProjectInfo: {
    backgroundColor: appColors.background,
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 16 : 14,
    marginBottom: 16,
  },
  joinProjectTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 12,
    lineHeight: Platform.OS === 'ios' ? 22 : 20,
  },
  joinProjectMeta: {
    gap: 8,
  },
  joinProjectMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinProjectMetaText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: appColors.textMuted,
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Platform.OS === 'ios' ? 8 : 4,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: appColors.primary,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalButtonSecondaryText: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: appColors.textMuted,
    paddingHorizontal: 4,
  },
  modalButtonDanger: {
    flex: 1,
    backgroundColor: appColors.danger,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalIconContainerWarning: {
    backgroundColor: appColors.dangerSurface,
  },
  modalWarningBox: {
    backgroundColor: appColors.dangerSurface,
    borderLeftWidth: 4,
    borderLeftColor: appColors.danger,
  },
  modalWarningText: {
    color: '#991B1B',
  },
  modalHintText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: appColors.textMuted,
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
    textAlign: 'center',
    marginTop: 8,
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: appColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
  },
  filterModalHandle: {
    width: 48,
    height: 5,
    backgroundColor: appColors.surfaceMuted,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: appColors.text,
  },
  filterModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 12,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  filterOptionChipActive: {
    backgroundColor: appColors.primary,
  },
  filterOptionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: appColors.textMuted,
  },
  filterOptionChipTextActive: {
    color: appColors.white,
  },
  filterTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 4,
  },
  filterTagChipActive: {
    backgroundColor: appColors.primarySurface,
    borderWidth: 1,
    borderColor: appColors.primary,
  },
  filterTagChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: appColors.textMuted,
  },
  filterTagChipTextActive: {
    color: appColors.primary,
  },
  filterModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderColor: appColors.border,
  },
  filterModalClearButton: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterModalClearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.textMuted,
  },
  filterModalApplyButton: {
    flex: 1,
    backgroundColor: appColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterModalApplyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
  },
  // Favorite Projects Styles
  favoriteProjectsScroll: {
    gap: 12,
    paddingRight: 20,
  },
  favoriteProjectCard: {
    width: 180,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 5,
  },
  favoriteProjectCardInner: {
    position: 'relative',
  },
  favoriteProjectImage: {
    width: '100%',
    height: 120,
    backgroundColor: appColors.surfaceMuted,
  },
  favoriteProjectImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteProjectInfo: {
    padding: 12,
  },
  favoriteProjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 8,
    lineHeight: 18,
  },
  favoriteProjectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favoriteProjectMetaText: {
    fontSize: 12,
    color: appColors.textMuted,
  },
  favoriteProjectHeartIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Recommended Projects Styles
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: appColors.textMuted,
    marginBottom: 16,
    marginTop: -8,
  },
  recommendedProjectsScroll: {
    paddingRight: 20,
  },
  recommendedProjectCard: {
    width: 200,
    backgroundColor: appColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 5,
  },
  recommendedProjectCardInner: {
    position: 'relative',
  },
  recommendedProjectImage: {
    width: '100%',
    height: 120,
    backgroundColor: appColors.surfaceMuted,
  },
  recommendedProjectImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendedProjectTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recommendedProjectTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: appColors.white,
  },
  recommendedProjectFavoriteIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendedProjectInfo: {
    padding: 12,
  },
  recommendedProjectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 8,
    lineHeight: 18,
  },
  recommendedProjectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  recommendedProjectMetaText: {
    fontSize: 11,
    color: appColors.textMuted,
    marginLeft: 4,
    marginRight: 12,
  },
  recommendedProjectMetaIcon: {
    marginLeft: 12,
  },
  // Grid View Styles
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '60%',
  },
  viewModeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: appColors.primarySurface,
  },
  projectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  // Refresh Toast Styles
  refreshToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  refreshToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: appColors.primary,
    gap: 10,
  },
  refreshToastIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshToastText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.text,
    flex: 1,
  },
  // Tutorial Styles
  tutorialOverlay: {
    flex: 1,
    position: 'relative',
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  tutorialHighlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: appColors.primary,
    borderRadius: 12,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  tutorialTooltip: {
    position: 'absolute',
    width: 300,
    zIndex: 1001,
  },
  tutorialArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
  },
  tutorialArrowTop: {
    borderBottomWidth: 10,
    borderBottomColor: '#FFFFFF',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tutorialArrowBottom: {
    borderTopWidth: 10,
    borderTopColor: '#FFFFFF',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tutorialTooltipContent: {
    backgroundColor: appColors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  tutorialTooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tutorialTooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 4,
  },
  tutorialStepIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: appColors.textMuted,
    backgroundColor: appColors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tutorialCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  tutorialTooltipDescription: {
    fontSize: 14,
    color: appColors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  tutorialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  tutorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    minHeight: 40,
    flex: 1,
  },
  tutorialButtonPrimary: {
    backgroundColor: appColors.primary,
    justifyContent: 'center',
    flex: 1,
  },
  tutorialButtonPrimaryText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  tutorialButtonSecondary: {
    backgroundColor: appColors.surfaceSoft,
    borderWidth: 1,
    borderColor: appColors.primary,
  },
  tutorialButtonSecondaryText: {
    color: appColors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  tutorialButtonDisabledText: {
    color: appColors.textSoft,
  },
  tutorialButtonSkip: {
    backgroundColor: 'transparent',
  },
  tutorialButtonSkipText: {
    color: appColors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  // Skeleton placeholder styles
  skeletonTrustFactorBlock: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 90,
    borderRadius: 16,
    backgroundColor: appColors.surfaceMuted,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  skeletonStatCard: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    backgroundColor: appColors.surfaceMuted,
  },
});