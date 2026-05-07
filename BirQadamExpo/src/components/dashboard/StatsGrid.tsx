import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { DashboardStats } from '../../types';
import { appColors } from '../../theme';
import { useTranslation } from '../../locales/i18n';

interface StatsGridProps {
  stats: DashboardStats;
  joinedProjectsCount: number;
  onProjectsPress: () => void;
  onTasksPress: () => void;
  onAchievementsPress: () => void;
  animations?: {
    projects: Animated.AnimatedValue;
    tasks: Animated.AnimatedValue;
    achievements: Animated.AnimatedValue;
  };
  onLayout?: (event: any) => void;
  innerRef?: React.RefObject<View | null>;
}

export const StatsGrid: React.FC<StatsGridProps> = React.memo(
  ({
    stats,
    joinedProjectsCount,
    onProjectsPress,
    onTasksPress,
    onAchievementsPress,
    animations,
    onLayout,
    innerRef,
  }) => {
    const { t } = useTranslation();
    return (
      <View ref={innerRef} style={styles.statsGrid} onLayout={onLayout}>
        <View style={styles.statCardWrapper}>
          <Animated.View style={animations?.projects ? { transform: [{ scale: animations.projects }] } : undefined}>
            <TouchableOpacity style={styles.statCard} onPress={onProjectsPress} activeOpacity={0.7}>
              <View style={styles.statIcon}>
                <Ionicons name="folder" size={20} color={appColors.primary} />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>
                {joinedProjectsCount}
              </Text>
              <Text style={styles.statLabel}>{t('statsgrid.s_0')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.statCardWrapper}>
          <Animated.View style={animations?.tasks ? { transform: [{ scale: animations.tasks }] } : undefined}>
            <TouchableOpacity style={styles.statCard} onPress={onTasksPress} activeOpacity={0.7}>
              <View style={styles.statIcon}>
                <Ionicons name="checkmark-circle-outline" size={20} color={appColors.primaryDark} />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>
                {stats.total_tasks}
              </Text>
              <Text style={styles.statLabel}>{t('statsgrid.s_1')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.statCardWrapper}>
          <Animated.View
            style={animations?.achievements ? { transform: [{ scale: animations.achievements }] } : undefined}
          >
            <TouchableOpacity style={styles.statCard} onPress={onAchievementsPress} activeOpacity={0.7}>
              <View style={styles.statIcon}>
                <Ionicons name="trophy-outline" size={20} color="#047857" />
              </View>
              <Text style={styles.statValue} numberOfLines={1}>
                {stats.achievements_count || 0}
              </Text>
              <Text style={styles.statLabel}>{t('statsgrid.s_2')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }
);

StatsGrid.displayName = 'StatsGrid';

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statCardWrapper: {
    width: '31.5%',
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: appColors.surface,
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
    backgroundColor: appColors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: appColors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: appColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
