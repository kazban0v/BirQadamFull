import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Card, CardContent } from '../../components/Card';
import { volunteerAPI } from '../../services/api';
import type { Achievement } from '../../types';

interface VolunteerAchievementsScreenProps {
  navigation: any;
}

export const VolunteerAchievementsScreen: React.FC<VolunteerAchievementsScreenProps> = ({
  navigation,
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  const loadAchievements = async () => {
    try {
      const response = await volunteerAPI.getAchievements();
      setAchievements(response.data.achievements || response.data);
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  };

  const filteredAchievements = achievements.filter((achievement) => {
    if (filter === 'all') return true;
    if (filter === 'earned') return achievement.is_earned;
    if (filter === 'locked') return !achievement.is_earned;
    return true;
  });

  const AchievementCard = ({ achievement }: { achievement: Achievement }) => (
    <Card style={[styles.achievementCard, !achievement.is_earned && styles.achievementLocked]}>
      <CardContent>
        <View style={styles.achievementHeader}>
          <View
            style={[
              styles.achievementIcon,
              achievement.is_earned
                ? styles.achievementIconEarned
                : styles.achievementIconLocked,
            ]}
          >
            <Ionicons
              name={achievement.is_earned ? 'trophy' : 'lock-closed'}
              size={24}
              color={achievement.is_earned ? '#F59E0B' : '#9CA3AF'}
            />
          </View>
          <View style={styles.achievementContent}>
            <Text style={styles.achievementTitle} numberOfLines={2}>
              {achievement.title}
            </Text>
            {achievement.is_earned && achievement.earned_at && (
              <Text style={styles.achievementDate}>
                Получено{' '}
                {new Date(achievement.earned_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.achievementDescription} numberOfLines={3}>
          {achievement.description}
        </Text>
      </CardContent>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header title="Достижения" showBack />
      
      {/* Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'earned' && styles.filterButtonActive]}
          onPress={() => setFilter('earned')}
        >
          <Text style={[styles.filterText, filter === 'earned' && styles.filterTextActive]}>
            Полученные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'locked' && styles.filterButtonActive]}
          onPress={() => setFilter('locked')}
        >
          <Text style={[styles.filterText, filter === 'locked' && styles.filterTextActive]}>
            Заблокированные
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredAchievements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Достижения не найдены</Text>
          </View>
        ) : (
          filteredAchievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#10B981',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  achievementCard: {
    marginBottom: 16,
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achievementIconEarned: {
    backgroundColor: '#FFFBEB',
  },
  achievementIconLocked: {
    backgroundColor: '#F3F4F6',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  achievementDate: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#6B7280',
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
