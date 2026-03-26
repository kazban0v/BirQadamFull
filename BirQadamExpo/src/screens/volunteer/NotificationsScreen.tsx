import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { volunteerAPI } from '../../services/api';
import type { Notification } from '../../types';

interface VolunteerNotificationsScreenProps {
  navigation: any;
}

/**
 * Strips emoji characters from the string.
 */
function stripEmojis(str: string | undefined | null): string {
  if (!str) return '';
  return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isUnread(n: Notification): boolean {
  return n.status === 'pending' || n.status === 'sent';
}

export const VolunteerNotificationsScreen: React.FC<VolunteerNotificationsScreenProps> = ({
  navigation,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadNotifications = useCallback(async () => {
    try {
      const response = await volunteerAPI.getNotifications();
      const data = response.data?.notifications || response.data || [];
      const list = Array.isArray(data) ? data : [];

      // Filter out any emojis from subjects and messages
      const cleaned = list.map(n => ({
        ...n,
        subject: stripEmojis(n.subject || n.title),
        message: stripEmojis(n.message)
      }));

      setNotifications(cleaned);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (isUnread(notification)) {
      try {
        await volunteerAPI.markNotificationRead(notification.id, notification.activity_id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, status: 'opened' as const } : n))
        );
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error('Error marking notification as read:', error);
        }
      }
    }

    // Navigation disabled by user request
    // if (notification.activity_id) {
    //   navigation.navigate('VolunteerTaskDetail', { taskId: notification.activity_id });
    // } else if (notification.project_id) {
    //   navigation.navigate('VolunteerProjectDetail', { projectId: notification.project_id });
    // }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await volunteerAPI.markAllNotificationsRead();
      // Optimistically clear unread status
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'opened' as const }))
      );
      // Wait a bit and refresh to stay in sync with server counts
      setTimeout(loadNotifications, 500);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getStatusColor = (n: Notification): string => {
    const type = n.notification_type || '';
    if (type === 'task_assigned') return '#1e40af';
    if (type === 'project_update') return '#558b2f';
    if (type === 'joined_project') return '#10B981';
    if (isUnread(n)) return '#558b2f';
    return '#6B7280';
  };

  const getIconName = (n: Notification): keyof typeof Ionicons.glyphMap => {
    const t = n.notification_type || '';
    const m = (n.message || '').toLowerCase();
    const s = (n.subject || '').toLowerCase();

    if (t === 'task_assigned' || s.includes('задачу')) return 'clipboard-outline';
    if (t === 'project_update' || s.includes('проект')) return 'business-outline';
    if (m.includes('покинули') || s.includes('покинули')) return 'exit-outline';
    if (m.includes('присоединились') || s.includes('присоединились')) return 'person-add-outline';
    if (m.includes('создано') || s.includes('новое')) return 'add-circle-outline';

    return 'notifications-outline';
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    return isUnread(n);
  });

  const unreadCount = notifications.filter(isUnread).length;

  const NotificationItem = ({ item }: { item: Notification }) => {
    const unread = isUnread(item);
    const color = getStatusColor(item);

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {unread && <View style={styles.unreadBar} />}

        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={getIconName(item)} size={22} color={color} />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardSubject} numberOfLines={2}>
            {item.subject || 'Уведомление'}
          </Text>
          <Text style={styles.cardMessage} numberOfLines={3}>
            {item.message}
          </Text>
          <View style={styles.cardFooter}>
            {item.project_title && (
              <Text style={styles.projectText} numberOfLines={1}>
                {stripEmojis(item.project_title)}
              </Text>
            )}
            <Text style={styles.cardTime}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {unread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7f2" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#1b2a1b" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Уведомления</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} новых</Text>
            )}
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Ionicons name="checkmark-done" size={20} color="#558b2f" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'unread' && styles.filterBtnActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterBtnText, filter === 'unread' && styles.filterBtnTextActive]}>
            Непрочитанные
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.filterBadge, filter === 'unread' ? styles.filterBadgeActive : styles.filterBadgeInactive]}>
              <Text style={[styles.filterBadgeText, filter === 'unread' ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive]}>
                {unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#558b2f"
            colors={['#558b2f']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#558b2f" />
            </View>
            <Text style={styles.emptyTitle}>Нет уведомлений</Text>
            <Text style={styles.emptyDesc}>
              {filter === 'unread'
                ? 'У вас нет непрочитанных уведомлений.'
                : 'Здесь будут появляться новости и обновления.'}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((item) => (
            <NotificationItem key={item.id} item={item} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 2,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1b2a1b',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#558b2f',
    fontWeight: '600',
    marginTop: -2,
  },
  markAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  /* Filter */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#e8f0e3',
  },
  filterBtnActive: {
    backgroundColor: '#558b2f',
  },
  filterBtnText: {
    fontSize: 14,
    color: '#558b2f',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  filterBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 4,
  },
  filterBadgeActive: {
    backgroundColor: '#fff',
  },
  filterBadgeInactive: {
    backgroundColor: '#558b2f',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  filterBadgeTextActive: {
    color: '#558b2f',
  },
  filterBadgeTextInactive: {
    color: '#fff',
  },

  /* List */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: '#fafff7',
    borderWidth: 1,
    borderColor: 'rgba(85,139,47,0.1)',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#558b2f',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1b2a1b',
    marginBottom: 4,
  },
  cardMessage: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  projectText: {
    fontSize: 11,
    color: '#558b2f',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 11,
    color: '#9ba3af',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#558b2f',
    marginLeft: 6,
    marginTop: 4,
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f0e3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b2a1b',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
