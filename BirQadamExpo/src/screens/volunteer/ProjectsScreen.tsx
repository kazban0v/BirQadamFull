import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { volunteerAPI } from '../../services/api';
import type { Project } from '../../types';

interface VolunteerProjectsScreenProps {
  navigation: any;
}

interface ProjectsResponse {
  projects: Project[];
  summary: {
    total_available: number;
    joined_count: number;
  };
  message?: string;
}

export const VolunteerProjectsScreen: React.FC<VolunteerProjectsScreenProps> = ({
  navigation,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'joined' | 'available'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'social' | 'environmental' | 'cultural'>('all');

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getProjects();
      const data: ProjectsResponse = response.data;
      const projectsData = data.projects || [];
      setProjects(projectsData);
    } catch (error: any) {
      console.error('❌ Error loading projects:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить проекты';
      Alert.alert('Ошибка', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleJoin = async (projectId: number) => {
    Alert.alert(
      'Присоединиться к проекту?',
      'Вы уверены, что хотите присоединиться к этому проекту?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Да, присоединиться',
          onPress: () => confirmJoin(projectId),
        },
      ]
    );
  };

  const confirmJoin = async (projectId: number) => {
    try {
      const response = await volunteerAPI.joinProject(projectId);
      const data: ProjectsResponse = response.data;
      
      Alert.alert('Успешно', data.message || 'Вы присоединились к проекту');
      await loadProjects();
    } catch (error: any) {
      console.error('❌ Error joining project:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось присоединиться к проекту';
      
      if (error?.response?.status === 403 || error?.response?.status === 400) {
        if (error?.response?.data?.trust_factor !== undefined) {
          Alert.alert(
            'Внимание',
            `Ваш Trust Factor: ${error.response.data.trust_factor}. ${errorMessage}`
          );
        } else {
          Alert.alert('Ошибка', errorMessage);
        }
      } else {
        Alert.alert('Ошибка', errorMessage);
      }
    }
  };

  const handleLeave = async (projectId: number) => {
    Alert.alert(
      'Выйти из проекта?',
      'Вы уверены, что хотите покинуть этот проект?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Да, выйти',
          style: 'destructive',
          onPress: () => confirmLeave(projectId),
        },
      ]
    );
  };

  const confirmLeave = async (projectId: number) => {
    try {
      const response = await volunteerAPI.leaveProject(projectId, 'Личные причины');
      const result = response.data;
      
      let message = result.message || 'Вы покинули проект.';
      if (result.penalty_applied && result.trust_factor !== undefined) {
        message += ` Ваш Trust Factor: ${result.trust_factor} (штраф -5 TF)`;
      }
      
      Alert.alert(result.penalty_applied ? 'Внимание' : 'Успешно', message);
      await loadProjects();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось покинуть проект';
      Alert.alert('Ошибка', errorMessage);
    }
  };

  const getFilteredProjects = () => {
    let filtered = projects;

    // Фильтр по статусу участия
    if (filter === 'joined') {
      filtered = filtered.filter((p) => p.joined);
    } else if (filter === 'available') {
      filtered = filtered.filter((p) => !p.joined);
    }

    // Фильтр по типу
    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.volunteer_type === typeFilter);
    }

    return filtered;
  };

  const getVolunteerTypeLabel = (type: string): string => {
    switch (type) {
      case 'social':
        return 'Социальная';
      case 'environmental':
        return 'Экология';
      case 'cultural':
        return 'Культура';
      default:
        return type;
    }
  };

  const getVolunteerTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'social':
        return 'people';
      case 'environmental':
        return 'leaf';
      case 'cultural':
        return 'color-palette';
      default:
        return 'flag';
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const typeLabel = getVolunteerTypeLabel(project.volunteer_type);
    const typeIcon = getVolunteerTypeIcon(project.volunteer_type);

    // Функция для нормализации URL изображений
    const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
      if (!url) return undefined;
      
      // В development режиме заменяем HTTPS на HTTP для локального сервера
      if (__DEV__) {
        // Если URL содержит production домен, заменяем на локальный IP
        if (url.includes('cleanup.almau.edu.kz') || url.includes('birqadam.almau.edu.kz')) {
          return url.replace(/https?:\/\/[^\/]+/, 'http://192.168.0.129:8000');
        }
        // Если URL начинается с HTTPS, заменяем на HTTP
        if (url.startsWith('https://')) {
          return url.replace('https://', 'http://');
        }
      }
      
      return url;
    };

    return (
      <TouchableOpacity
        style={styles.projectCard}
        onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
      >
        {normalizeImageUrl(project.cover_image_url) ? (
          <Image 
            source={{ uri: normalizeImageUrl(project.cover_image_url) }} 
            style={styles.projectImage}
            resizeMode="cover"
            onError={(error) => {
              console.error('❌ Error loading project image:', error);
            }}
          />
        ) : (
          <View style={[styles.projectImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          </View>
        )}

        <View style={styles.projectTypeBadge}>
          <Ionicons name={typeIcon} size={12} color="#FFFFFF" />
          <Text style={styles.projectTypeText}>{typeLabel}</Text>
        </View>

        <View style={styles.projectContent}>
          <Text style={styles.projectTitle} numberOfLines={2}>
            {project.title}
          </Text>

          <View style={styles.projectLocation}>
            <Ionicons name="location" size={14} color="#6B7280" />
            <Text style={styles.projectLocationText} numberOfLines={1}>
              {project.city || 'Локация не указана'}
            </Text>
          </View>

          <View style={styles.projectStats}>
            <View style={styles.projectStat}>
              <Ionicons name="people" size={14} color="#10B981" />
              <Text style={styles.projectStatText}>
                {project.active_members || 0} волонтёров
              </Text>
            </View>
            <View style={styles.projectStat}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.projectStatText}>
                {project.tasks_count || 0} задач
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              project.joined ? styles.actionButtonJoined : styles.actionButtonPrimary,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              if (project.joined) {
                handleLeave(project.id);
              } else {
                handleJoin(project.id);
              }
            }}
          >
            <Ionicons
              name={project.joined ? 'checkmark-circle' : 'add-circle'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>
              {project.joined ? 'Вы участвуете' : 'Присоединиться'}
            </Text>
          </TouchableOpacity>
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Все проекты</Text>
        </View>

        {/* Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Все
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'joined' && styles.filterButtonActive]}
            onPress={() => setFilter('joined')}
          >
            <Text style={[styles.filterText, filter === 'joined' && styles.filterTextActive]}>
              Мои проекты
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'available' && styles.filterButtonActive]}
            onPress={() => setFilter('available')}
          >
            <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>
              Доступные
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Type Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('all')}
          >
            <Text style={[styles.filterText, typeFilter === 'all' && styles.filterTextActive]}>
              Все типы
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'social' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('social')}
          >
            <Text style={[styles.filterText, typeFilter === 'social' && styles.filterTextActive]}>
              Социальная
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'environmental' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('environmental')}
          >
            <Text style={[styles.filterText, typeFilter === 'environmental' && styles.filterTextActive]}>
              Экология
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'cultural' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('cultural')}
          >
            <Text style={[styles.filterText, typeFilter === 'cultural' && styles.filterTextActive]}>
              Культура
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Projects List */}
        <View style={styles.projectsList}>
          {getFilteredProjects().map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {getFilteredProjects().length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyText}>Проектов не найдено</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  filterScroll: {
    maxHeight: 44,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
  },
  filterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  projectsList: {
    paddingHorizontal: 16,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E5E7EB',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectTypeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  projectContent: {
    padding: 12,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  projectLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectLocationText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  projectStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  projectStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectStatText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionButtonPrimary: {
    backgroundColor: '#10B981',
  },
  actionButtonJoined: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
});
