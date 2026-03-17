import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { Card, CardContent } from '../../components/Card';
import { volunteerAPI } from '../../services/api';
import type { Notification } from '../../types';

interface VolunteerNotificationsScreenProps {
  navigation: any;
}

export const VolunteerNotificationsScreen: React.FC<VolunteerNotificationsScreenProps> = ({
  navigation,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadNotifications = async () => {
    try {
      const response = await volunteerAPI.getNotifications();
      setNotifications(response.data.notifications || response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'all') return true;
    return !notification.is_read;
  });

  const markAsRead = async (id: number) => {
    try {
      await volunteerAPI.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error: any) {
      // Игнорируем 404 ошибки, так как уведомление может быть уже прочитано
      if (error?.response?.status !== 404) {
        console.error('Error marking notification as read:', error);
      }
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const getIconStyle = (type: string) => {
      switch (type) {
        case 'success':
          return { backgroundColor: '#10B981' };
        case 'warning':
          return { backgroundColor: '#F59E0B' };
        case 'error':
          return { backgroundColor: '#EF4444' };
        default:
          return { backgroundColor: '#3B82F6' };
      }
    };

    const getIconName = (type: string): keyof typeof Ionicons.glyphMap => {
      switch (type) {
        case 'success':
          return 'checkmark-circle';
        case 'warning':
          return 'warning';
        case 'error':
          return 'alert-circle';
        default:
          return 'information-circle';
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !notification.is_read && styles.notificationUnread]}
        onPress={() => markAsRead(notification.id)}
      >
        <View
          style={[
            styles.notificationIcon,
            getIconStyle(notification.type),
          ]}
        >
          <Ionicons
            name={getIconName(notification.type)}
            size={24}
            color="#FFFFFF"
          />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={2}>
            {notification.title}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {notification.message}
          </Text>
          <Text style={styles.notificationTime}>
            {new Date(notification.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        {!notification.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Уведомления" showBack />
      
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
          style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            Непрочитанные
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
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Нет уведомлений</Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
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
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 8,
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