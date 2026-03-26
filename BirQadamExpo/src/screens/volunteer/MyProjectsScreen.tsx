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

interface VolunteerMyProjectsScreenProps {
  navigation: any;
}

export const VolunteerMyProjectsScreen: React.FC<VolunteerMyProjectsScreenProps> = ({
  navigation,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getProjects();
      const projectsData = response.data.projects || [];
      // Фильтруем только проекты, в которых участвует пользователь
      const joinedProjects = projectsData.filter((p: Project) => p.joined);
      setProjects(joinedProjects);
    } catch (error: any) {
      console.error('❌ Error loading joined projects:', error);
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

  const ProjectCard = ({ project }: { project: Project }) => {
    const typeLabel = getVolunteerTypeLabel(project.volunteer_type);
    const typeIcon = getVolunteerTypeIcon(project.volunteer_type);
    const typeColor = getVolunteerTypeColor(project.volunteer_type);
    const imageUrl = normalizeImageUrl(project.cover_image_url);

    return (
      <TouchableOpacity
        style={styles.projectCard}
        onPress={() => navigation.navigate('VolunteerProjectDetail', { projectId: project.id })}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.projectImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.projectImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          </View>
        )}

        <View style={[styles.projectTypeBadge, { backgroundColor: typeColor }]}>
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

          <View style={styles.projectFooter}>
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.joinedBadgeText}>Участвуете</Text>
            </View>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={(e) => {
                e.stopPropagation();
                handleLeave(project.id);
              }}
            >
              <Ionicons name="exit-outline" size={16} color="#EF4444" />
              <Text style={styles.leaveButtonText}>Выйти</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
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

  const getVolunteerTypeColor = (type: string): string => {
    switch (type) {
      case 'social':
        return '#10B981';
      case 'environmental':
        return '#059669';
      case 'cultural':
        return '#7C3AED';
      default:
        return '#6B7280';
    }
  };

  const normalizeImageUrl = (url: string | undefined | null): string | undefined => {
    if (!url) return undefined;

    if (__DEV__) {
      if (url.includes('cleanup.almau.edu.kz') || url.includes('birqadam.almau.edu.kz')) {
        return url.replace(/https?:\/\/[^\/]+/, 'http://192.168.0.13:8000');
      }
      if (url.startsWith('https://')) {
        return url.replace('https://', 'http://');
      }
    }

    return url;
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
          <Text style={styles.headerTitle}>Мои проекты</Text>
          <Text style={styles.headerSubtitle}>
            {projects.length} {projects.length === 1 ? 'проект' : projects.length > 1 && projects.length < 5 ? 'проекта' : 'проектов'} в участии
          </Text>
        </View>

        {/* Projects List */}
        <View style={styles.projectsList}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {projects.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Нет проектов</Text>
              <Text style={styles.emptyText}>
                Вы ещё не участвуете ни в одном проекте{'\n'}
                Найдите подходящий проект и присоединяйтесь!
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate('VolunteerProjects')}
              >
                <Ionicons name="search-outline" size={20} color="#FFFFFF" />
                <Text style={styles.browseButtonText}>Найти проект</Text>
              </TouchableOpacity>
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
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  projectsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    gap: 6,
  },
  leaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
