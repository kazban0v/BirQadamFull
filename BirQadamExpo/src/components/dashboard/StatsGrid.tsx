import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DashboardStats } from '../../types';

interface StatsGridProps {
  stats: DashboardStats;
  joinedProjectsCount: number;
  onHoursPress: () => void;
  onProjectsPress: () => void;
  onTasksPress: () => void;
  onAchievementsPress: () => void;
  animations?: {
    hours: Animated.AnimatedValue;
    projects: Animated.AnimatedValue;
    tasks: Animated.AnimatedValue;
    achievements: Animated.AnimatedValue;
  };
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

export const StatsGrid: React.FC<StatsGridProps> = React.memo(({
  stats,
  joinedProjectsCount,
  onHoursPress,
  onProjectsPress,
  onTasksPress,
  onAchievementsPress,
  animations,
  onLayout,
  innerRef,
}) => {
  return (
    <View
      ref={innerRef}
      style={styles.statsGrid}
      onLayout={onLayout}
    >
      <View style={styles.statCardWrapper}>
        <Animated.View style={animations?.hours ? { transform: [{ scale: animations.hours }] } : undefined}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onHoursPress}
            activeOpacity={0.7}
          >
            <View style={styles.statIcon}>
              <Ionicons name="time-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{Math.round(stats.total_hours)}ч</Text>
            <Text style={styles.statLabel}>ЧАСОВ</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.statCardWrapper}>
        <Animated.View style={animations?.projects ? { transform: [{ scale: animations.projects }] } : undefined}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onProjectsPress}
            activeOpacity={0.7}
          >
            <View style={styles.statIcon}>
              <Ionicons name="folder" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{joinedProjectsCount}</Text>
            <Text style={styles.statLabel}>МОИ ПРОЕКТЫ</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.statCardWrapper}>
        <Animated.View style={animations?.tasks ? { transform: [{ scale: animations.tasks }] } : undefined}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onTasksPress}
            activeOpacity={0.7}
          >
            <View style={styles.statIcon}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{stats.total_tasks}</Text>
            <Text style={styles.statLabel}>ЗАДАЧ</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.statCardWrapper}>
        <Animated.View style={animations?.achievements ? { transform: [{ scale: animations.achievements }] } : undefined}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={onAchievementsPress}
            activeOpacity={0.7}
          >
            <View style={styles.statIcon}>
              <Ionicons name="trophy-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{stats.total_points || 0}</Text>
            <Text style={styles.statLabel}>ДОСТИЖЕНИЙ</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
});

StatsGrid.displayName = 'StatsGrid';

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statCardWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 100,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

