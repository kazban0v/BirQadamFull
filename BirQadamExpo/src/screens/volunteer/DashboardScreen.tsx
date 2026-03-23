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
  Dimensions,
  TextInput,
  Animated,
  LayoutRectangle,
  FlatList,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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
import { TutorialOverlay, type TutorialStep } from '../../components/dashboard/TutorialOverlay';
import { SkeletonHeader } from '../../components/dashboard/Skeleton/SkeletonHeader';
import { SkeletonProjectCard } from '../../components/dashboard/Skeleton/SkeletonProjectCard';
import { useTutorial } from '../../hooks/useTutorial';
import { getVolunteerTypeLabel, getVolunteerTypeColor, normalizeImageUrl, getSortLabel } from '../../utils/projectUtils';

interface VolunteerDashboardScreenProps {
  navigation: any;
}

export const VolunteerDashboardScreen: React.FC<VolunteerDashboardScreenProps> = ({
  navigation,
}) => {
  const screenHeight = Dimensions.get('window').height;
  
  // Используем hooks для данных
  const { loading, refreshing, data, loadDashboard } = useDashboard();
  const { favoriteProjects, toggleFavorite } = useFavorites();
  
  // Объединяем profile данные
  const profile = useMemo(() => ({
    trustFactor: data?.profile.trustFactor || 0,
    averageRating: data?.profile.averageRating || 0,
    userName: data?.profile.userName || 'Пользователь',
  }), [data?.profile]);
  
  const stats = useMemo(() => data?.stats || {
    total_tasks: 0,
    completed_tasks: 0,
    total_hours: 0,
    total_points: 0,
    upcoming_tasks: 0,
    active_projects: 0,
  }, [data?.stats]);
  
  const projects = useMemo(() => data?.projects || [], [data?.projects]);
  const [filter, setFilter] = useState<'all' | 'social' | 'environmental' | 'cultural'>('all');
  const [showHoursInfo, setShowHoursInfo] = useState(false);
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
  
  // Tutorial refs для элементов
  const headerRef = useRef<View>(null);
  const trustFactorRef = useRef<View>(null);
  const statsRef = useRef<View>(null);
  const searchRef = useRef<View>(null);
  
  // Шаги туториала
  const tutorialSteps: TutorialStep[] = useMemo(() => [
    {
      id: 'header',
      title: 'Добро пожаловать!',
      description: 'Здесь вы видите свой профиль и уведомления. Нажмите на иконку уведомлений, чтобы увидеть новые сообщения.',
      ref: headerRef,
      position: 'bottom' as const,
    },
    {
      id: 'trustFactor',
      title: 'Trust Factor',
      description: 'Ваш показатель надёжности. Чем выше балл, тем больше возможностей! Нажмите на иконку информации, чтобы узнать больше.',
      ref: trustFactorRef,
      position: 'bottom' as const,
    },
    {
      id: 'stats',
      title: 'Ваша статистика',
      description: 'Здесь отображаются ваши достижения: часы участия, проекты, задачи и достижения. Нажмите на карточку, чтобы узнать подробности.',
      ref: statsRef,
      position: 'bottom' as const,
    },
    {
      id: 'search',
      title: 'Поиск и фильтры',
      description: 'Используйте поиск для быстрого нахождения проектов. Кнопка фильтров позволяет сортировать и фильтровать по типу, дате и тегам.',
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
    hours: new Animated.Value(1),
    projects: new Animated.Value(1),
    tasks: new Animated.Value(1),
    achievements: new Animated.Value(1),
    trustFactor: new Animated.Value(1),
  }).current;

  // toggleFavorite уже из useFavorites hook

  // Открытие модального окна присоединения
  const handleJoinPress = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowJoinModal(true);
  }, []);

  // Открытие модального окна выхода
  const handleLeavePress = useCallback((project: Project) => {
    setSelectedProject(project);
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
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error joining project:', error);
      }
    } finally {
      setIsJoining(false);
    }
  }, [selectedProject, loadDashboard]);

  // Выход из проекта
  const handleLeaveProject = useCallback(async () => {
    if (!selectedProject) return;
    
    setIsLeaving(true);
    try {
      await volunteerAPI.leaveProject(selectedProject.id, '');
      await loadDashboard(true);
      setShowLeaveModal(false);
      setSelectedProject(null);
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Error leaving project:', error);
      }
    } finally {
      setIsLeaving(false);
    }
  }, [selectedProject, loadDashboard]);

  // loadDashboard уже из useDashboard hook
  
  // Функция для показа toast уведомления
  const showRefreshToast = (updates: typeof refreshUpdates) => {
    const updateMessages: string[] = [];
    
    if (updates.projects) {
      updateMessages.push('проекты');
    }
    if (updates.stats) {
      updateMessages.push('статистика');
    }
    if (updates.trustFactor) {
      updateMessages.push('Trust Factor');
    }
    if (updates.recommendations) {
      updateMessages.push('рекомендации');
    }
    
    if (updateMessages.length === 0) {
      return; // Нет обновлений
    }
    
    const message = `Обновлено: ${updateMessages.join(', ')}`;
    
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

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Проверяем туториал после того, как данные загружены и loading = false
  useEffect(() => {
    if (!loading && !showTutorial) {
      if (__DEV__) {
        console.log('🔍 Checking tutorial status after data loaded...');
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

  const handleAchievementsPress = useCallback(() => {
    if (navigation.getState().routes.some((route: any) => route.name === 'VolunteerAchievements')) {
      navigation.navigate('VolunteerAchievements');
    } else {
      Alert.alert('В разработке', 'Раздел достижений находится в разработке');
    }
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
  const SkeletonScreen = () => (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SkeletonHeader />
        <View style={{ marginHorizontal: 20, marginTop: 24 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </View>
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
            colors={['#10B981']}
            progressBackgroundColor="#FFFFFF"
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
          userName={profile.userName}
          onNotificationPress={() => navigation.navigate('VolunteerNotifications')}
          onLayout={(e) => showTutorial && tutorialStep === 0 && handleElementLayout('header', e)}
          innerRef={headerRef}
        />

        {/* Trust Factor Card */}
        <TrustFactorCard
          trustFactor={profile.trustFactor}
          averageRating={profile.averageRating}
          projectsCount={joinedProjectsCount}
          onInfoPress={() => setShowTrustFactorInfo(true)}
          onStatsPress={() => navigation.navigate('Профиль')}
          scaleAnimation={statsCardAnimations.trustFactor}
          onLayout={(e) => showTutorial && tutorialStep === 1 && handleElementLayout('trustFactor', e)}
          innerRef={trustFactorRef}
        />

        {/* Stats Grid */}
        <StatsGrid
          stats={stats}
          joinedProjectsCount={joinedProjectsCount}
          onHoursPress={() => setShowHoursInfo(true)}
          onProjectsPress={handleProjectsPress}
          onTasksPress={() => navigation.navigate('Задачи')}
          onAchievementsPress={handleAchievementsPress}
          animations={statsCardAnimations}
          onLayout={(e) => showTutorial && tutorialStep === 2 && handleElementLayout('stats', e)}
          innerRef={statsRef}
        />

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
                    <Ionicons name="close-circle" size={16} color="#10B981" />
                  </TouchableOpacity>
                </View>
              )}
              {dateFilter !== 'all' && (
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    {dateFilter === 'today' ? 'Сегодня' : dateFilter === 'week' ? 'На неделе' : 'В этом месяце'}
                  </Text>
                  <TouchableOpacity onPress={() => setDateFilter('all')}>
                    <Ionicons name="close-circle" size={16} color="#10B981" />
                  </TouchableOpacity>
                </View>
              )}
              {selectedTags.map(tag => (
                <View key={tag} style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>#{tag}</Text>
                  <TouchableOpacity onPress={() => toggleTag(tag)}>
                    <Ionicons name="close-circle" size={16} color="#10B981" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>Очистить все</Text>
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
              Все проекты
            </Text>
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
              <Ionicons name="heart" size={14} color="#EF4444" />
              <Text style={[styles.filterPillText, styles.filterPillFavoriteText]}>
                Избранное ({favoriteProjects.length})
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.filterPill, filter === 'social' && styles.filterPillActive]}
            onPress={() => setFilter('social')}
          >
            <Text style={[styles.filterPillText, filter === 'social' && styles.filterPillTextActive]}>
              Социальная помощь
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterPill, filter === 'environmental' && styles.filterPillActive]}
            onPress={() => setFilter('environmental')}
          >
            <Text style={[styles.filterPillText, filter === 'environmental' && styles.filterPillTextActive]}>
              Экология
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterPill, filter === 'cultural' && styles.filterPillActive]}
            onPress={() => setFilter('cultural')}
          >
            <Text style={[styles.filterPillText, filter === 'cultural' && styles.filterPillTextActive]}>
              Культурные мероприятия
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Избранные проекты (если есть) */}
        {favoriteProjects.length > 0 && filter === 'all' && !searchQuery && selectedTags.length === 0 && dateFilter === 'all' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={20} color="#EF4444" />
                <Text style={styles.sectionTitle}>Избранное</Text>
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
                      <View style={[styles.favoriteProjectImage, styles.favoriteProjectImagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={styles.favoriteProjectInfo}>
                      <Text style={styles.favoriteProjectTitle} numberOfLines={2}>
                        {project.title}
                      </Text>
                      <View style={styles.favoriteProjectMeta}>
                        <Ionicons name="people-outline" size={12} color="#6B7280" />
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
                      <Ionicons name="heart" size={16} color="#EF4444" />
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
                <Ionicons name="sparkles" size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Проекты для вас</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>
              Рекомендации на основе ваших интересов
            </Text>
            
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
                      <View style={[styles.recommendedProjectImage, styles.recommendedProjectImagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                      </View>
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
                        color={favoriteProjects.includes(project.id) ? "#EF4444" : "#FFFFFF"} 
                      />
                    </TouchableOpacity>
                    <View style={styles.recommendedProjectInfo}>
                      <Text style={styles.recommendedProjectTitle} numberOfLines={2}>
                        {project.title}
                      </Text>
                      <View style={styles.recommendedProjectMeta}>
                        <Ionicons name="people-outline" size={12} color="#6B7280" />
                        <Text style={styles.recommendedProjectMetaText}>
                          {project.active_members || 0} волонтёров
                        </Text>
                        <Ionicons name="location-outline" size={12} color="#6B7280" style={styles.recommendedProjectMetaIcon} />
                        <Text style={styles.recommendedProjectMetaText}>
                          {project.city || 'Локация'}
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
            <Text style={styles.sectionTitle}>Предстоящие возможности</Text>
            <View style={styles.sectionHeaderRight}>
              <TouchableOpacity
                style={styles.viewModeButton}
                onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              >
                <Ionicons
                  name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                  size={18}
                  color="#10B981"
                />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.resultsInfo}>
            <Text style={styles.resultsInfoText}>
              Найдено: {filteredProjects.length} {filteredProjects.length === 1 ? 'проект' : filteredProjects.length > 1 && filteredProjects.length < 5 ? 'проекта' : 'проектов'}
            </Text>
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
              <Ionicons name="folder-open-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Проектов пока нет</Text>
            </View>
          )}

          {/* Индикатор загрузки дополнительных проектов */}
          {loadingMore && displayedProjectsCount < filteredProjects.length && (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={[styles.loadingMoreText, { marginLeft: 8 }]}>Загрузка проектов...</Text>
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
              <Text style={styles.showAllButtonText}>Все проекты загружены</Text>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginLeft: 6 }} />
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
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.refreshToastText}>
              {(() => {
                const messages: string[] = [];
                if (refreshUpdates.projects) messages.push('проекты');
                if (refreshUpdates.stats) messages.push('статистика');
                if (refreshUpdates.trustFactor) messages.push('Trust Factor');
                if (refreshUpdates.recommendations) messages.push('рекомендации');
                return `Обновлено: ${messages.join(', ')}`;
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
                <Text style={styles.filterModalTitle}>Фильтры</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.filterModalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* Сортировка */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Сортировка</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'newest', label: 'Новые', icon: 'time-outline' },
                      { value: 'popular', label: 'Популярные', icon: 'trending-up-outline' },
                      { value: 'urgent', label: 'Срочные', icon: 'flash-outline' },
                      { value: 'alphabetical', label: 'По алфавиту', icon: 'text-outline' },
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
                          color={sortBy === option.value ? '#FFFFFF' : '#6B7280'} 
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
                          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Тип проекта */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Тип проекта</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'all', label: 'Все' },
                      { value: 'social', label: 'Социальная помощь' },
                      { value: 'environmental', label: 'Экология' },
                      { value: 'cultural', label: 'Культурные мероприятия' },
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
                          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Дата начала */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Дата начала</Text>
                  <View style={styles.filterOptionsGrid}>
                    {[
                      { value: 'all', label: 'Все' },
                      { value: 'today', label: 'Сегодня' },
                      { value: 'week', label: 'На этой неделе' },
                      { value: 'month', label: 'В этом месяце' },
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
                          <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Теги */}
                {allTags.length > 0 && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Теги</Text>
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
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
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
                  <Text style={styles.filterModalClearButtonText}>Сбросить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterModalApplyButton}
                  onPress={() => setShowFilters(false)}
                >
                  <Text style={styles.filterModalApplyButtonText}>Применить</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Hours Info Modal */}
      <Modal
        visible={showHoursInfo}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowHoursInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="time-outline" size={32} color="#10B981" />
              </View>
              <Text style={styles.modalTitle}>Что такое "Часы"?</Text>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>
                <Text style={styles.modalTextBold}>Часы</Text> — это общее время вашей волонтерской деятельности.
              </Text>
              
              <View style={styles.modalInfoBox}>
                <View style={styles.modalInfoRow}>
                  <Ionicons name="calendar-outline" size={20} color="#10B981" />
                  <Text style={styles.modalInfoText}>
                    Время считается с момента вашего первого присоединения к проекту
                  </Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Ionicons name="hourglass-outline" size={20} color="#10B981" />
                  <Text style={styles.modalInfoText}>
                    Часы накапливаются пока вы участвуете в активных проектах
                  </Text>
                </View>
                
                <View style={styles.modalInfoRow}>
                  <Ionicons name="people-outline" size={20} color="#10B981" />
                  <Text style={styles.modalInfoText}>
                    Это показатель вашего опыта и вовлеченности в волонтерство
                  </Text>
                </View>
              </View>
              
              <Text style={styles.modalExample}>
                <Text style={styles.modalTextBold}>Пример:</Text> Если вы присоединились к первому проекту 10 дней назад, ваши часы = 240 часов (10 дней × 24 часа)
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowHoursInfo(false)}
            >
              <Text style={styles.modalButtonText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
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
            {/* Ограничиваем высоту окна и обрезаем края, убираем дефолтный паддинг */}
            <View style={[styles.modalContent, { maxHeight: screenHeight * 0.85, padding: 0, overflow: 'hidden' }]}>
              
              {/* Фиксированная шапка (не скроллится) */}
              <View style={[styles.modalHeader, { padding: 20, paddingBottom: 10, marginBottom: 0 }]}>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { top: 15, right: 15 }]}
                  onPress={() => setShowTrustFactorInfo(false)}
                >
                  <Ionicons name="close" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { marginTop: 10 }]}>Как работает Trust Factor?</Text>
              </View>
              
              {/* Скроллируемый контент */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              >
                <View style={[styles.modalBody, { marginBottom: 0 }]}>
                  <Text style={styles.tfDescription}>
                    <Text style={styles.modalTextBold}>Trust Factor (TF)</Text> — показатель надёжности волонтёра.
                  </Text>
                  
                  <View style={styles.tfMaxPoints}>
                    <Text style={styles.tfMaxPointsText}>Максимум: 30 баллов.</Text>
                  </View>
                  
                  <View style={styles.tfZeroWarning}>
                    <Text style={styles.tfZeroWarningText}>При TF = 0 нельзя вступать в проекты.</Text>
                  </View>

                  {/* Начисляются баллы */}
                  <View style={styles.tfSection}>
                    <Text style={styles.tfSectionTitle}>+ Начисляются баллы</Text>
                    <View style={styles.tfPointsList}>
                      <View style={styles.tfPointItem}>
                        <View style={styles.tfPointItemLeft}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={styles.tfPointText}>Оценка фотоотчёта 5 ⭐</Text>
                        </View>
                        <Text style={styles.tfPointValue}>+2</Text>
                      </View>
                      <View style={styles.tfPointItem}>
                        <View style={styles.tfPointItemLeft}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={styles.tfPointText}>Оценка фотоотчёта 4 ⭐</Text>
                        </View>
                        <Text style={styles.tfPointValue}>+1</Text>
                      </View>
                      <View style={styles.tfPointItem}>
                        <View style={styles.tfPointItemLeft}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={styles.tfPointText}>Оценка фотоотчёта 3 ⭐</Text>
                        </View>
                        <Text style={styles.tfPointValue}>0</Text>
                      </View>
                    </View>
                  </View>

                  {/* Снимаются баллы */}
                  <View style={[styles.tfSection, styles.tfSectionDeduct]}>
                    <Text style={styles.tfSectionTitle}>— Снимаются баллы</Text>
                    <View style={styles.tfPointsList}>
                      <View style={styles.tfPointItem}>
                        <Text style={styles.tfPointText}>Выход из проекта</Text>
                        <Text style={[styles.tfPointValue, styles.tfPointValueNegative]}>−5</Text>
                      </View>
                      <View style={styles.tfPointItem}>
                        <View style={styles.tfPointItemLeft}>
                          <Ionicons name="star" size={16} color="#FCD34D" />
                          <Text style={styles.tfPointText}>Оценка фотоотчёта 1–2 ⭐</Text>
                        </View>
                        <Text style={[styles.tfPointValue, styles.tfPointValueNegative]}>−1</Text>
                      </View>
                      <View style={styles.tfPointItem}>
                        <Text style={styles.tfPointText}>Отклонение задачи</Text>
                        <Text style={[styles.tfPointValue, styles.tfPointValueNegative]}>−2</Text>
                      </View>
                    </View>
                  </View>

                  {/* Совет */}
                  <View style={styles.tfTip}>
                    <Ionicons name="location" size={16} color="#10B981" style={styles.tfTipIcon} />
                    <Text style={styles.tfTipText}>
                      Загружайте качественные фотоотчёты и завершайте начатые проекты.
                    </Text>
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
                  <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                </View>
                <Text style={styles.modalTitle}>Присоединиться к проекту?</Text>
              </View>
              
              {selectedProject && (
                <View style={styles.modalBody}>
                  <View style={styles.joinProjectInfo}>
                    <Text style={styles.joinProjectTitle}>{selectedProject.title}</Text>
                    <View style={styles.joinProjectMeta}>
                      <View style={styles.joinProjectMetaItem}>
                        <Ionicons name="location-outline" size={16} color="#6B7280" />
                        <Text style={styles.joinProjectMetaText}>
                          {selectedProject.city || 'Локация не указана'}
                        </Text>
                      </View>
                      {selectedProject.start_date && (
                        <View style={styles.joinProjectMetaItem}>
                          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
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
                      <Ionicons name="information-circle" size={20} color="#10B981" />
                      <Text style={styles.modalInfoText}>
                        Вы получите доступ к задачам проекта и сможете участвовать в волонтерской деятельности.
                      </Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="trophy" size={20} color="#F59E0B" />
                      <Text style={styles.modalInfoText}>
                        За выполнение задач вы будете получать баллы Trust Factor.
                      </Text>
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
                  >Отмена</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleJoinProject}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text 
                      style={styles.modalButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >Присоединиться</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Leave Project Modal */}
      <Modal
        visible={showLeaveModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLeaveModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: screenHeight * 0.85 }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconContainer, styles.modalIconContainerWarning]}>
                  <Ionicons name="warning-outline" size={32} color="#EF4444" />
                </View>
                <Text style={styles.modalTitle}>Выйти из проекта?</Text>
              </View>
              
              {selectedProject && (
                <View style={styles.modalBody}>
                  <View style={styles.joinProjectInfo}>
                    <Text style={styles.joinProjectTitle}>{selectedProject.title}</Text>
                  </View>

                  <View style={[styles.modalInfoBox, styles.modalWarningBox]}>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="alert-circle" size={20} color="#EF4444" />
                      <Text style={styles.modalInfoText}>
                        При выходе из проекта вы потеряете доступ к задачам и больше не с��ожете участвовать.
                      </Text>
                    </View>
                    
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="trending-down" size={20} color="#EF4444" />
                      <Text style={[styles.modalInfoText, styles.modalWarningText]}>
                        <Text style={styles.modalTextBold}>Внимание!</Text> С вас будет снято <Text style={styles.modalTextBold}>5 баллов Trust Factor</Text>.
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalHintText}>
                    Вы уверены, что хотите покинуть этот проект?
                  </Text>
                </View>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setShowLeaveModal(false)}
                  disabled={isLeaving}
                >
                  <Text 
                    style={styles.modalButtonSecondaryText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >Отмена</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDanger]}
                  onPress={handleLeaveProject}
                  disabled={isLeaving}
                >
                  {isLeaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text 
                      style={styles.modalButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >Выйти</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Стили для Header, TrustFactorCard, StatsGrid, SearchBar перенесены в соответствующие компоненты
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterPillActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillFavorite: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  filterPillFavoriteText: {
    color: '#EF4444',
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
    color: '#1F2937',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    flexShrink: 1,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
    flexShrink: 1,
  },
  resultsInfo: {
    marginBottom: 12,
  },
  resultsInfoText: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 16,
  },
  showAllButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  projectImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E5E7EB',
  },
  projectImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectTypeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  projectTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  favoriteIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectContent: {
    padding: 16,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  projectInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  projectInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectInfoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  projectFooter: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  projectStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectStatsText: {
    fontSize: 13,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonJoined: {
    backgroundColor: '#E5E7EB',
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: Platform.OS === 'ios' ? 22 : 20,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 40 : 20,
  },
  modalBody: {
    marginBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  modalText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalTextBold: {
    fontWeight: '700',
    color: '#1F2937',
  },
  modalInfoBox: {
    backgroundColor: '#F9FAFB',
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
    color: '#6B7280',
    marginLeft: 12,
    lineHeight: 20,
  },
  modalExample: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontStyle: 'italic',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  modalButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
    padding: 8,
    zIndex: 1,
  },
  tfDescription: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    color: '#1F2937',
    lineHeight: Platform.OS === 'ios' ? 22 : 20,
    marginBottom: 12,
  },
  tfMaxPoints: {
    backgroundColor: '#ECFDF5',
    padding: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  tfMaxPointsText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: '#10B981',
  },
  tfZeroWarning: {
    backgroundColor: '#FEF2F2',
    padding: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  tfZeroWarningText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  tfSection: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 16 : 14,
    marginBottom: 12,
    width: '100%',
  },
  tfSectionDeduct: {
    backgroundColor: '#FEF2F2',
  },
  tfSectionTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: '#1F2937',
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
  tfPointItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  tfPointText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: '#1F2937',
    flex: 1,
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
    marginLeft: 8, // Заменяет gap: 8
  },
  tfPointValue: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: '#10B981',
    minWidth: 40,
    textAlign: 'right',
  },
  tfPointValueNegative: {
    color: '#EF4444',
  },
  tfTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
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
  // Join/Leave Project Modal Styles
  joinProjectInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 16 : 14,
    marginBottom: 16,
  },
  joinProjectTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#6B7280',
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Platform.OS === 'ios' ? 8 : 4,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalButtonSecondaryText: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '700',
    color: '#6B7280',
    paddingHorizontal: 4,
  },
  modalButtonDanger: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 48 : 44,
  },
  modalIconContainerWarning: {
    backgroundColor: '#FEF2F2',
  },
  modalWarningBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  modalWarningText: {
    color: '#991B1B',
  },
  modalHintText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: '#6B7280',
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
  },
  filterModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
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
    borderBottomColor: '#F3F4F6',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#1F2937',
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
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  filterOptionChipActive: {
    backgroundColor: '#10B981',
  },
  filterOptionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterOptionChipTextActive: {
    color: '#FFFFFF',
  },
  filterTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 4,
  },
  filterTagChipActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  filterTagChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTagChipTextActive: {
    color: '#10B981',
  },
  filterModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  filterModalClearButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterModalClearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  filterModalApplyButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterModalApplyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Favorite Projects Styles
  favoriteProjectsScroll: {
    gap: 12,
    paddingRight: 20,
  },
  favoriteProjectCard: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteProjectCardInner: {
    position: 'relative',
  },
  favoriteProjectImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#E5E7EB',
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
    color: '#1F2937',
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
    color: '#6B7280',
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
    color: '#6B7280',
    marginBottom: 16,
    marginTop: -8,
  },
  recommendedProjectsScroll: {
    paddingRight: 20,
  },
  recommendedProjectCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  recommendedProjectCardInner: {
    position: 'relative',
  },
  recommendedProjectImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#E5E7EB',
  },
  recommendedProjectImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
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
    color: '#FFFFFF',
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
    color: '#1F2937',
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
    color: '#6B7280',
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
    backgroundColor: '#F0FDF4',
  },
  projectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  projectCardGrid: {
    width: '48%',
    maxWidth: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  projectImageGrid: {
    width: '100%',
    height: 140,
    backgroundColor: '#E5E7EB',
  },
  projectTypeBadgeGrid: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectTypeTextGrid: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  favoriteIconGrid: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectContentGrid: {
    padding: 12,
  },
  projectTitleGrid: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 18,
  },
  projectInfoGrid: {
    marginBottom: 8,
  },
  projectInfoItemGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectInfoTextGrid: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  projectFooterGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  projectStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectStatsTextGrid: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  refreshToastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 10,
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
    borderColor: '#10B981',
    borderRadius: 12,
    shadowColor: '#10B981',
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
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  tutorialStepIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
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
    color: '#6B7280',
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
    backgroundColor: '#10B981',
    justifyContent: 'center',
    flex: 1,
  },
  tutorialButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  tutorialButtonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  tutorialButtonSecondaryText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  tutorialButtonDisabledText: {
    color: '#9CA3AF',
  },
  tutorialButtonSkip: {
    backgroundColor: 'transparent',
  },
  tutorialButtonSkipText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});