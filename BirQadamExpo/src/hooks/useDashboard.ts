import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { volunteerAPI } from '../services/api';
import type { Project, DashboardStats, Task } from '../types';
import { syncVolunteerLocalNotifications } from '../utils/volunteerNotifications';

export interface DashboardProfile {
  trustFactor: number;
  averageRating: number;
  userName: string;
}

export interface DashboardData {
  profile: DashboardProfile;
  stats: DashboardStats;
  projects: Project[];
  tasks: Task[];
  unreadNotifications: number;
}

export const useDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboard = useCallback(async (isRefresh: boolean = false) => {
    if (!isRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      if (__DEV__) {
        console.log('🔍 [Dashboard] Загрузка данных...');
      }
      
      const [dashboardResponse, profileResponse, projectsResponse] = await Promise.all([
        volunteerAPI.getDashboard(),
        volunteerAPI.getProfile(),
        volunteerAPI.getProjects(),
      ]);
      
      const dashboardData = dashboardResponse.data;
      const profileData = profileResponse.data;
      const projectsData = projectsResponse.data.projects || [];
      
      const tf = profileData.trust_factor ?? 0;
      const avgRating = profileData.average_rating ?? 0;
      const name = profileData.name || profileData.full_name || 'Пользователь';
      
      const summary = dashboardData.summary || {};
      if (__DEV__) {
        console.log('📊 [Dashboard] summary from API:', JSON.stringify(summary));
      }
      const normalizedTasks: Task[] = Array.isArray(dashboardData.tasks)
        ? dashboardData.tasks.map((item: any) => ({
            id: item.task_id || item.id,
            title: item.title || item.text || 'Задача',
            description: item.description || item.text || '',
            project_id: item.project_id,
            project_title: item.project_title,
            location: item.location || item.project_city || item.city || 'Локация не указана',
            start_date: item.start_date || item.deadline_date || item.created_at || new Date().toISOString(),
            end_date: item.end_date || item.deadline_date || item.created_at || new Date().toISOString(),
            status: item.status || 'open',
            start_time: item.start_time,
            end_time: item.end_time,
            accepted: Boolean(item.accepted),
            completed: Boolean(item.completed),
            is_expired: Boolean(item.is_expired),
            has_photo_report: Boolean(item.has_photo_report),
            can_upload_photo: Boolean(item.can_upload_photo),
            photo_status: item.photo_status ?? null,
            image: item.image || item.task_image_url || item.project_cover_image_url || null,
          }))
        : [];

      const newStats: DashboardStats = {
        total_tasks: summary.active_tasks || 0, // Показываем число активных задач из бэкенда
        completed_tasks: summary.completed_tasks || 0,
        total_hours: summary.total_hours || 0,
        total_points: summary.achievements_count || 0, // Отображаем количество достижений (на всякий случай)
        achievements_count: summary.achievements_count || 0, // Добавлено явно для StatsGrid
        upcoming_tasks: summary.upcoming_tasks || 0,
        active_projects: summary.active_projects || 0,
      };
      
      // Сортируем проекты по дате создания (новые сверху)
      const sortedProjects = [...projectsData].sort((a, b) => {
        const dateA = new Date(a.created_at || a.start_date || 0).getTime();
        const dateB = new Date(b.created_at || b.start_date || 0).getTime();
        return dateB - dateA;
      });
      
      const dashboardDataResult: DashboardData = {
        profile: {
          trustFactor: tf,
          averageRating: avgRating,
          userName: name,
        },
        stats: newStats,
        projects: sortedProjects,
        tasks: normalizedTasks,
        unreadNotifications: summary.unread_notifications || 0,
      };

      if (Platform.OS !== 'web') {
        void syncVolunteerLocalNotifications(dashboardDataResult.tasks, sortedProjects);
      }
      
      setData(dashboardDataResult);
      setError(null);
      
      return dashboardDataResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (__DEV__) {
        console.error('❌ [Dashboard] Error loading dashboard:', error);
      }
      setError(error);
      throw error;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return {
    loading,
    refreshing,
    data,
    error,
    loadDashboard,
  };
};
