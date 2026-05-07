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
import { getAxiosErrorMessage } from '../../utils/apiErrorMessage';
import { isProjectCurrentlyActive } from '../../utils/projectUtils';
import { appColors } from '../../theme';
import { useTranslation } from "../../locales/i18n";
import { ProjectCoverPlaceholder } from '../../components/dashboard/ProjectCoverPlaceholder';

interface VolunteerMyProjectsScreenProps {
  navigation: any;
}

export const VolunteerMyProjectsScreen: React.FC<VolunteerMyProjectsScreenProps> = ({
  navigation,
}) => {
    const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaveProject, setLeaveProject] = useState<Project | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [leaving, setLeaving] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await volunteerAPI.getProjects();
      const projectsData = response.data.projects || [];
      // Фильтруем только проекты, в которых участвует пользователь
      const joinedProjects = projectsData.filter(
        (p: Project) => p.joined && isProjectCurrentlyActive(p)
      );
      setProjects(joinedProjects);
    } catch (error: unknown) {
      console.error('Error loading joined projects:', error);
      const errorMessage = getAxiosErrorMessage(error, t('myprojects.s_0'));
      Alert.alert(t('myprojects.s_1'), errorMessage);
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

  const handleLeave = (project: Project) => {
    setLeaveProject(project);
    setLeaveReason('');
  };

  const confirmLeave = async () => {
    if (!leaveProject) return;

    const trimmedReason = leaveReason.trim();
    if (!trimmedReason) {
      Alert.alert(t('myprojects.s_2'), t('myprojects.s_3'));
      return;
    }

    setLeaving(true);
    try {
      const response = await volunteerAPI.leaveProject(leaveProject.id, trimmedReason);
      const result = response.data;

      let message = result.message || t('myprojects.s_4');
      if (result.penalty_applied && result.trust_factor !== undefined) {
        message += ` Ваш Trust Factor: ${result.trust_factor} (штраф -5 TF)`;
      }

      setLeaveProject(null);
      setLeaveReason('');
      Alert.alert(result.penalty_applied ? t('myprojects.s_5') : t('myprojects.s_6'), message);
      await loadProjects();
    } catch (error: unknown) {
      const errorMessage = getAxiosErrorMessage(error, t('myprojects.s_7'));
      Alert.alert(t('myprojects.s_8'), errorMessage);
    } finally {
      setLeaving(false);
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
          <ProjectCoverPlaceholder style={[styles.projectImage, styles.imagePlaceholder]} size="lg" />
        )}

        <View style={[styles.projectTypeBadge, { backgroundColor: typeColor }]}>
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
              {project.city || t('myprojects.s_9')}
            </Text>
          </View>

          <View style={styles.projectStats}>
            <View style={styles.projectStat}>
              <Ionicons name="people" size={14} color={appColors.primary} />
              <Text style={styles.projectStatText}>
                {project.active_members || 0} {t('myprojects.s_10')}</Text>
            </View>
            <View style={styles.projectStat}>
              <Ionicons name="star" size={14} color={appColors.warning} />
              <Text style={styles.projectStatText}>
                {project.tasks_count || 0} {t('myprojects.s_11')}</Text>
            </View>
          </View>

          <View style={styles.projectFooter}>
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={appColors.primary} />
              <Text style={styles.joinedBadgeText}>{t('myprojects.s_12')}</Text>
            </View>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={(e) => {
                e.stopPropagation();
                handleLeave(project);
              }}
            >
              <Ionicons name="exit-outline" size={16} color={appColors.danger} />
              <Text style={styles.leaveButtonText}>{t('myprojects.s_13')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Функции для отображение тип волонтеров ("Фильтр ")
  const getVolunteerTypeLabel = (type: string): string => {
    switch (type) {
      case 'social':
        return t('myprojects.s_14');
      case 'environmental':
        return t('myprojects.s_15');
      case 'cultural':
        return t('myprojects.s_16');
      default:
        return type;
    }
  };
  // Иконка для типов волонтеров 
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
        return appColors.primary;
      case 'environmental':
        return appColors.primaryDark;
      case 'cultural':
        return '#7C3AED';
      default:
        return appColors.textMuted;
    }
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
          <Text style={styles.headerTitle}>{t('myprojects.s_17')}</Text>
          <Text style={styles.headerSubtitle}>
            {projects.length} {projects.length === 1 ? t('myprojects.s_18') : projects.length > 1 && projects.length < 5 ? t('myprojects.s_19') : t('myprojects.s_20')} {t('myprojects.s_21')}</Text>
        </View>

        {/* Projects List */}
        <View style={styles.projectsList}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {projects.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color={appColors.textSoft} />
              <Text style={styles.emptyTitle}>{t('myprojects.s_22')}</Text>
              <Text style={styles.emptyText}>
                {t('myprojects.s_23')}{'\n'}
                {t('myprojects.s_24')}</Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate('VolunteerProjects')}
              >
                <Ionicons name="search-outline" size={20} color={appColors.white} />
                <Text style={styles.browseButtonText}>{t('myprojects.s_25')}</Text>
              </TouchableOpacity>
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
  headerSubtitle: {
    fontSize: 14,
    color: appColors.textMuted,
    marginTop: 4,
  },
  projectsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: appColors.border,
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: appColors.primary,
    marginLeft: 4,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: appColors.dangerSurface,
    gap: 6,
  },
  leaveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: appColors.danger,
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
    color: appColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: appColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: appColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: appColors.white,
  },
});
