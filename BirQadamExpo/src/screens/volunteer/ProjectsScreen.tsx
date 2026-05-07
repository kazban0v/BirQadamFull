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
import { LeaveProjectReasonModal } from '../../components/projects/LeaveProjectReasonModal';
import type { Project } from '../../types';
import { normalizeImageUrl } from '../../utils/network';
import { getAxiosErrorMessage, getAxiosErrorResponse } from '../../utils/apiErrorMessage';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";

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
    const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'joined' | 'available'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'social' | 'environmental' | 'cultural'>('all');
  const [trustFactor, setTrustFactor] = useState<number | null>(null);
  const [leaveProject, setLeaveProject] = useState<Project | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const [projectsResponse, profileResponse] = await Promise.all([
        volunteerAPI.getProjects(),
        volunteerAPI.getProfile(),
      ]);
      const data: ProjectsResponse = projectsResponse.data;
      const projectsData = data.projects || [];
      setTrustFactor(profileResponse.data?.trust_factor ?? 0);
      setProjects(projectsData);
    } catch (error: unknown) {
      console.error('Error loading projects:', error);
      const errorMessage = getAxiosErrorMessage(error, t('projects.s_0'));
      Alert.alert(t('projects.s_1'), errorMessage);
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
    if (trustFactor !== null && trustFactor <= 0) {
      Alert.alert(
        t('projects.s_2'),
        t('projects.s_3')
      );
      return;
    }

    Alert.alert(
      t('projects.s_4'),
      t('projects.s_5'),
      [
        {
          text: t('projects.s_6'),
          style: 'cancel',
        },
        {
          text: t('projects.s_7'),
          onPress: () => confirmJoin(projectId),
        },
      ]
    );
  };

  const confirmJoin = async (projectId: number) => {
    try {
      const response = await volunteerAPI.joinProject(projectId);
      const data: ProjectsResponse = response.data;
      
      Alert.alert(t('projects.s_8'), data.message || t('projects.s_9'));
      await loadProjects();
    } catch (error: unknown) {
      console.error('Error joining project:', error);
      const errorMessage = getAxiosErrorMessage(error, t('projects.s_10'));
      const res = getAxiosErrorResponse(error);

      if (res?.status === 403 || res?.status === 400) {
        if (res.data?.trust_factor !== undefined) {
          Alert.alert(
            t('projects.s_11'),
            `Ваш Trust Factor: ${String(res.data.trust_factor)}. ${errorMessage}`
          );
        } else {
          Alert.alert(t('projects.s_12'), errorMessage);
        }
      } else {
        Alert.alert(t('projects.s_13'), errorMessage);
      }
    }
  };

  const handleLeave = (project: Project) => {
    setLeaveProject(project);
    setLeaveReason('');
  };

  const confirmLeave = async () => {
    if (!leaveProject) return;

    const trimmedReason = leaveReason.trim();
    if (!trimmedReason) {
      Alert.alert(t('projects.s_14'), t('projects.s_15'));
      return;
    }

    setLeaving(true);
    try {
      const response = await volunteerAPI.leaveProject(leaveProject.id, trimmedReason);
      const result = response.data;

      if (result.trust_factor !== undefined) {
        setTrustFactor(result.trust_factor);
      }

      let message = result.message || t('projects.s_16');
      if (result.penalty_applied && result.trust_factor !== undefined) {
        message += ` Ваш Trust Factor: ${result.trust_factor} (штраф -5 TF)`;
      }

      setLeaveProject(null);
      setLeaveReason('');
      Alert.alert(result.penalty_applied ? t('projects.s_17') : t('projects.s_18'), message);
      await loadProjects();
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('projects.s_19'));
      Alert.alert(t('projects.s_20'), errorMessage);
    } finally {
      setLeaving(false);
    }
  };

  const getFilteredProjects = () => {
    let filtered = projects.filter(isProjectCurrentlyActive);

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
        return t('projects.s_21');
      case 'environmental':
        return t('projects.s_22');
      case 'cultural':
        return t('projects.s_23');
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
              console.error('Error loading project image:', error);
            }}
          />
        ) : (
          <View style={[styles.projectImage, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={appColors.textSoft} />
          </View>
        )}

        <View style={styles.projectTypeBadge}>
          <Ionicons name={typeIcon} size={12} color={appColors.white} />
          <Text style={styles.projectTypeText}>{typeLabel}</Text>
        </View>

        <View style={styles.projectContent}>
          <Text style={styles.projectTitle} numberOfLines={2}>
            {project.title}
          </Text>

          <View style={styles.projectLocation}>
            <Ionicons name="location" size={14} color={appColors.textMuted} />
            <Text style={styles.projectLocationText} numberOfLines={1}>
              {project.city || t('projects.s_24')}
            </Text>
          </View>

          <View style={styles.projectStats}>
            <View style={styles.projectStat}>
              <Ionicons name="people" size={14} color={appColors.primary} />
              <Text style={styles.projectStatText}>
                {project.active_members || 0} {t('projects.s_25')}</Text>
            </View>
            <View style={styles.projectStat}>
              <Ionicons name="star" size={14} color={appColors.warning} />
              <Text style={styles.projectStatText}>
                {project.tasks_count || 0} {t('projects.s_26')}</Text>
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
                handleLeave(project);
              } else {
                handleJoin(project.id);
              }
            }}
          >
            <Ionicons
              name={project.joined ? 'checkmark-circle' : 'add-circle'}
              size={18}
              color={appColors.white}
            />
            <Text style={styles.actionButtonText}>
              {project.joined ? t('projects.s_27') : t('projects.s_28')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={appColors.primary} />
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
          <Text style={styles.headerTitle}>{t('projects.s_29')}</Text>
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
              {t('projects.s_30')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'joined' && styles.filterButtonActive]}
            onPress={() => setFilter('joined')}
          >
            <Text style={[styles.filterText, filter === 'joined' && styles.filterTextActive]}>
              {t('projects.s_31')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'available' && styles.filterButtonActive]}
            onPress={() => setFilter('available')}
          >
            <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>
              {t('projects.s_32')}</Text>
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
              {t('projects.s_33')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'social' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('social')}
          >
            <Text style={[styles.filterText, typeFilter === 'social' && styles.filterTextActive]}>
              {t('projects.s_34')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'environmental' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('environmental')}
          >
            <Text style={[styles.filterText, typeFilter === 'environmental' && styles.filterTextActive]}>
              {t('projects.s_35')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, typeFilter === 'cultural' && styles.filterButtonActive]}
            onPress={() => setTypeFilter('cultural')}
          >
            <Text style={[styles.filterText, typeFilter === 'cultural' && styles.filterTextActive]}>
              {t('projects.s_36')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Projects List */}
        <View style={styles.projectsList}>
          {getFilteredProjects().map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {getFilteredProjects().length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color={appColors.textSoft} />
              <Text style={styles.emptyText}>{t('projects.s_37')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <LeaveProjectReasonModal
        visible={Boolean(leaveProject)}
        projectTitle={leaveProject?.title}
        reason={leaveReason}
        loading={leaving}
        onChangeReason={setLeaveReason}
        onClose={() => {
          if (leaving) {
            return;
          }
          setLeaveProject(null);
          setLeaveReason('');
        }}
        onConfirm={confirmLeave}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceSoft,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: appColors.surfaceSoft,
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
    color: appColors.text,
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
    backgroundColor: appColors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: appColors.primary,
  },
  filterText: {
    fontSize: 13,
    color: appColors.textMuted,
    fontWeight: '500',
  },
  filterTextActive: {
    color: appColors.white,
    fontWeight: '600',
  },
  projectsList: {
    paddingHorizontal: 16,
  },
  projectCard: {
    backgroundColor: appColors.surface,
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
    backgroundColor: appColors.surfaceMuted,
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
    backgroundColor: appColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectTypeText: {
    fontSize: 11,
    color: appColors.white,
    fontWeight: '600',
    marginLeft: 4,
  },
  projectContent: {
    padding: 12,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 8,
  },
  projectLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectLocationText: {
    fontSize: 13,
    color: appColors.textMuted,
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
    color: appColors.textMuted,
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
    backgroundColor: appColors.primary,
  },
  actionButtonJoined: {
    backgroundColor: appColors.textMuted,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: appColors.white,
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: appColors.textSoft,
    marginTop: 16,
  },
});
