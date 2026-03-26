import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Project } from '../../types';
import { getVolunteerTypeLabel, getVolunteerTypeColor, normalizeImageUrl } from '../../utils/projectUtils';

interface ProjectCardProps {
  project: Project;
  isFavorite: boolean;
  onPress: () => void;
  onFavoritePress: (projectId: number) => void;
  onJoinPress: (project: Project) => void;
  onLeavePress: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = React.memo(({
  project,
  isFavorite,
  onPress,
  onFavoritePress,
  onJoinPress,
  onLeavePress,
}) => {
  const typeLabel = getVolunteerTypeLabel(project.volunteer_type);
  const typeColor = getVolunteerTypeColor(project.volunteer_type);
  const imageUrl = normalizeImageUrl(project.cover_image_url);

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    onFavoritePress(project.id);
  };

  const handleJoinPress = (e: any) => {
    e.stopPropagation();
    if (project.joined) {
      onLeavePress(project);
    } else {
      onJoinPress(project);
    }
  };

  // Форматирование дат
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const formatDateShort = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  // Получение отображаемой даты
  const getDisplayDate = () => {
    const startDate = formatDateShort(project.start_date);
    const endDate = formatDateShort(project.end_date);

    if (startDate && endDate) {
      return `${startDate} - ${endDate}`;
    }
    return startDate || 'Дата';
  };

  return (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={onPress}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.projectImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.projectImage, styles.projectImagePlaceholder]}>
          <Ionicons name="image-outline" size={48} color="#9CA3AF" />
        </View>
      )}

      <View style={[styles.projectTypeBadge, { backgroundColor: typeColor }]}>
        <Text style={styles.projectTypeText}>{typeLabel.toUpperCase()}</Text>
      </View>

      <TouchableOpacity
        style={styles.favoriteIcon}
        onPress={handleFavoritePress}
      >
        <Ionicons
          name={isFavorite ? "heart" : "heart-outline"}
          size={20}
          color={isFavorite ? "#EF4444" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <View style={styles.projectContent}>
        <Text style={styles.projectTitle} numberOfLines={2}>
          {project.title}
        </Text>

        <View style={styles.projectInfo}>
          <View style={styles.projectInfoItem}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.projectInfoText} numberOfLines={1}>
              {project.city || 'Локация'}
            </Text>
          </View>

          <View style={styles.projectInfoItem}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.projectInfoText} numberOfLines={1}>
              {getDisplayDate()}
            </Text>
          </View>
        </View>

        <View style={styles.projectFooter}>
          <View style={styles.projectStats}>
            <Ionicons name="people-outline" size={14} color="#6B7280" />
            <Text style={styles.projectStatsText}>
              {project.active_members || 0} волонтёров
            </Text>
          </View>

          <View style={styles.projectStats}>
            <Ionicons name="flag-outline" size={14} color="#6B7280" />
            <Text style={styles.projectStatsText}>
              {project.tasks_count || 0} задач
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.joinButton, project.joined && styles.joinButtonJoined]}
          onPress={handleJoinPress}
        >
          <Text style={[styles.joinButtonText, project.joined && styles.joinButtonTextJoined]}>
            {project.joined ? 'Выйти из проекта' : 'Присоединиться'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.project.joined === nextProps.project.joined &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.project.cover_image_url === nextProps.project.cover_image_url &&
    prevProps.project.title === nextProps.project.title &&
    prevProps.project.active_members === nextProps.project.active_members &&
    prevProps.project.tasks_count === nextProps.project.tasks_count
  );
});

ProjectCard.displayName = 'ProjectCard';

const styles = StyleSheet.create({
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  joinButtonTextJoined: {
    color: '#EF4444',
  },
});

