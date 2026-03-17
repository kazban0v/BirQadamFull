import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Project } from '../../types';
import { getVolunteerTypeLabel, getVolunteerTypeColor, normalizeImageUrl } from '../../utils/projectUtils';

interface ProjectCardGridProps {
  project: Project;
  isFavorite: boolean;
  onPress: () => void;
  onFavoritePress: (projectId: number) => void;
}

export const ProjectCardGrid: React.FC<ProjectCardGridProps> = React.memo(({
  project,
  isFavorite,
  onPress,
  onFavoritePress,
}) => {
  const typeLabel = getVolunteerTypeLabel(project.volunteer_type);
  const typeColor = getVolunteerTypeColor(project.volunteer_type);
  const imageUrl = normalizeImageUrl(project.cover_image_url);

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    onFavoritePress(project.id);
  };

  // Форматирование дат
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
    return startDate || '';
  };

  return (
    <TouchableOpacity
      style={styles.projectCardGrid}
      onPress={onPress}
    >
      {imageUrl ? (
        <Image 
          source={{ uri: imageUrl }} 
          style={styles.projectImageGrid}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.projectImageGrid, styles.projectImagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      )}
      
      <View style={[styles.projectTypeBadgeGrid, { backgroundColor: typeColor }]}>
        <Text style={styles.projectTypeTextGrid}>{typeLabel.toUpperCase()}</Text>
      </View>

      <TouchableOpacity 
        style={styles.favoriteIconGrid}
        onPress={handleFavoritePress}
      >
        <Ionicons 
          name={isFavorite ? "heart" : "heart-outline"} 
          size={16} 
          color={isFavorite ? "#EF4444" : "#FFFFFF"} 
        />
      </TouchableOpacity>

      <View style={styles.projectContentGrid}>
        <Text style={styles.projectTitleGrid} numberOfLines={2}>
          {project.title}
        </Text>

        <View style={styles.projectInfoGrid}>
          <View style={styles.projectInfoItemGrid}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.projectInfoTextGrid} numberOfLines={1}>
              {project.city || 'Локация'}
            </Text>
          </View>
          <View style={styles.projectInfoItemGrid}>
            <Ionicons name="calendar-outline" size={12} color="#6B7280" />
            <Text style={styles.projectInfoTextGrid} numberOfLines={1}>
              {getDisplayDate()}
            </Text>
          </View>
        </View>

        <View style={styles.projectFooterGrid}>
          <View style={styles.projectStatsGrid}>
            <Ionicons name="people-outline" size={12} color="#6B7280" />
            <Text style={styles.projectStatsTextGrid}>
              {project.active_members || 0}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.project.id === nextProps.project.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.project.cover_image_url === nextProps.project.cover_image_url &&
    prevProps.project.title === nextProps.project.title &&
    prevProps.project.active_members === nextProps.project.active_members
  );
});

ProjectCardGrid.displayName = 'ProjectCardGrid';

const styles = StyleSheet.create({
  projectCardGrid: {
    width: '48%',
    maxWidth: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  projectImageGrid: {
    width: '100%',
    height: 120,
    backgroundColor: '#E5E7EB',
  },
  projectImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectTypeBadgeGrid: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  projectTypeTextGrid: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  favoriteIconGrid: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  },
  projectInfoGrid: {
    marginBottom: 8,
  },
  projectInfoItemGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectInfoTextGrid: {
    fontSize: 11,
    color: '#6B7280',
  },
  projectFooterGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectStatsTextGrid: {
    fontSize: 11,
    color: '#6B7280',
  },
});

