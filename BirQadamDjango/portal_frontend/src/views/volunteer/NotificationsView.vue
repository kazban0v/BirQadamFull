<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useDashboardStore } from '@/stores/dashboard';
import { useAuthStore } from '@/stores/auth';
import type { VolunteerNotificationSummary } from '@/services/dashboard';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/notifications';
import { fetchProjectDetail, type VolunteerProjectCatalogItem } from '@/services/projects';

const dashboardStore = useDashboardStore();
const authStore = useAuthStore();

const loading = ref(false);
const notifications = ref<VolunteerNotificationSummary[]>([]);
const unreadCount = ref(0);
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});

// Диалог с деталями проекта
const projectDialog = ref(false);
const projectDetail = ref<VolunteerProjectCatalogItem | null>(null);
const loadingProject = ref(false);

// Функции для работы с прочитанными Activity ID в localStorage
function getReadActivityIds(): Set<number> {
  if (!authStore.user) return new Set();
  const key = `read_activities_${authStore.user.id}`;
  const stored = localStorage.getItem(key);
  if (!stored) return new Set();
  try {
    const ids = JSON.parse(stored) as number[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function markActivityAsRead(activityId: number) {
  if (!authStore.user) return;
  const key = `read_activities_${authStore.user.id}`;
  const readIds = getReadActivityIds();
  readIds.add(activityId);
  localStorage.setItem(key, JSON.stringify(Array.from(readIds)));
}

function markAllActivitiesAsRead(activityIds: number[]) {
  if (!authStore.user || activityIds.length === 0) return;
  const key = `read_activities_${authStore.user.id}`;
  const readIds = getReadActivityIds();
  activityIds.forEach((id) => readIds.add(id));
  localStorage.setItem(key, JSON.stringify(Array.from(readIds)));
}

function showSnackbar(message: string, color: string = 'success') {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'sent':
      return 'primary';
    case 'opened':
    case 'clicked':
      return 'grey';
    case 'failed':
      return 'error';
    default:
      return 'primary';
  }
}

// Фильтруем уведомления, исключая прочитанные Activity
const filteredNotifications = computed(() => {
  const readActivityIds = getReadActivityIds();
  return notifications.value.filter((notification) => {
    // Если это Activity запись, проверяем, не прочитана ли она
    if (notification.activity_id) {
      return !readActivityIds.has(notification.activity_id);
    }
    // Для обычных уведомлений проверяем статус
    return notification.status !== 'opened' && notification.status !== 'clicked';
  });
});

// Пересчитываем количество непрочитанных
const computedUnreadCount = computed(() => {
  const readActivityIds = getReadActivityIds();
  let count = 0;
  
  notifications.value.forEach((notification) => {
    if (notification.activity_id) {
      // Activity запись - считается непрочитанной, если не в localStorage
      if (!readActivityIds.has(notification.activity_id)) {
        count++;
      }
    } else {
      // Обычное уведомление - считается непрочитанным, если статус pending или sent
      if (notification.status === 'pending' || notification.status === 'sent') {
        count++;
      }
    }
  });
  
  return count;
});

async function loadNotifications() {
  loading.value = true;
  try {
    const data = await fetchNotifications(100);
    notifications.value = data.notifications;
    // Используем пересчитанное значение
    unreadCount.value = computedUnreadCount.value;
  } finally {
    loading.value = false;
  }
}

async function handleMarkRead(notificationId: number, activityId?: number) {
  try {
    // Если это Activity запись, отмечаем в localStorage
    if (activityId) {
      markActivityAsRead(activityId);
      // Также вызываем API для консистентности
      try {
        await markNotificationRead(notificationId, activityId);
      } catch {
        // Игнорируем ошибки API для Activity, так как они храняны в localStorage
      }
    } else {
      // Обычное уведомление - вызываем API
      await markNotificationRead(notificationId);
    }
    await loadNotifications();
    
    // Обновляем счетчик локально
    unreadCount.value = computedUnreadCount.value;
    
    // Обновляем dashboard для синхронизации счетчика в навигации
    if (dashboardStore.summary) {
      dashboardStore.summary.unread_notifications = computedUnreadCount.value;
    }
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    showSnackbar(error?.response?.data?.detail || 'Не удалось обновить уведомление.', 'error');
  }
}

async function handleMarkAllRead() {
  try {
    // Отмечаем все обычные уведомления через API
    await markAllNotificationsRead();
    
    // Отмечаем все Activity записи в localStorage
    const allActivityIds = notifications.value
      .filter((n) => n.activity_id)
      .map((n) => n.activity_id!)
      .filter((id) => id !== undefined);
    
    if (allActivityIds.length > 0) {
      markAllActivitiesAsRead(allActivityIds);
    }
    
    await loadNotifications();
    
    // Обновляем счетчик локально перед обновлением dashboard
    unreadCount.value = computedUnreadCount.value;
    
    // Обновляем dashboard для синхронизации счетчика в навигации
    if (dashboardStore.summary) {
      dashboardStore.summary.unread_notifications = computedUnreadCount.value;
    }
    await dashboardStore.loadDashboard(true);
    
    showSnackbar('Все уведомления помечены как прочитанные.', 'success');
  } catch (error: any) {
    showSnackbar(error?.response?.data?.detail || 'Не удалось отметить уведомления.', 'error');
  }
}

async function openProjectDialog(projectId: number) {
  if (!projectId) return;
  
  projectDialog.value = true;
  loadingProject.value = true;
  projectDetail.value = null;
  
  try {
    projectDetail.value = await fetchProjectDetail(projectId);
  } catch (error: any) {
    console.error('Failed to load project detail:', error);
    const errorMessage = error?.response?.data?.detail || 'Не удалось загрузить детали проекта.';
    showSnackbar(errorMessage, 'error');
    projectDialog.value = false;
  } finally {
    loadingProject.value = false;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

onMounted(async () => {
  await loadNotifications();
});
</script>

<template>
  <div class="notifications-container">
    <div class="notifications-page">
      <div class="notifications-header-card mb-6">
        <div class="notifications-header">
          <div class="notifications-header-content">
            <h1 class="notifications-title">Уведомления</h1>
            <p class="notifications-description">
              Важные события, связанные с вашими проектами и заданиями.
            </p>
          </div>
          <div class="notifications-actions">
            <v-chip
              color="primary"
              variant="tonal"
              class="unread-chip"
            >
              {{ computedUnreadCount }} новых
            </v-chip>
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold mark-all-btn"
              rounded="pill"
              :disabled="computedUnreadCount === 0 || loading"
              @click="handleMarkAllRead"
            >
              <v-icon icon="mdi-check-all" start />
              Прочитать все
            </v-btn>
          </div>
        </div>
      </div>

      <v-skeleton-loader
        v-if="loading"
        type="list-item-two-line@6"
        class="bg-transparent"
      />

      <v-alert
        v-else-if="!filteredNotifications.length"
        type="info"
        variant="tonal"
        class="rounded-xl border-0"
      >
        Пока уведомлений нет. Как только появятся события, они отобразятся здесь.
      </v-alert>

      <v-timeline 
        v-else 
        :density="$vuetify.display.mobile ? 'compact' : 'comfortable'"
        line-color="rgba(139, 195, 74, 0.2)"
        side="end"
        align="start"
        class="custom-timeline"
      >
        <v-timeline-item
          v-for="notification in filteredNotifications"
          :key="notification.id"
          :dot-color="statusColor(notification.status)"
          size="x-small"
          class="mb-4"
        >
          <v-card variant="flat" class="notification-card">
            <div class="notification-card-inner">
              <div class="notification-header-row">
                <div class="notification-subject">
                  {{ notification.subject }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatDateTime(notification.created_at) }}
                </div>
              </div>

              <div class="notification-message text-body-2 mb-3">
                {{ notification.message }}
              </div>
              
              <v-card
                v-if="notification.notification_type === 'task_assigned' && notification.project_id"
                variant="outlined"
                class="project-info-mini border-dashed"
              >
                <div class="d-flex align-center ga-2 mb-2">
                  <v-icon icon="mdi-information-outline" size="18" color="primary" />
                  <span class="text-subtitle-2 font-weight-bold">Детали проекта</span>
                </div>
                <div class="text-caption">
                  <div v-if="notification.project_title"><strong>Проект:</strong> {{ notification.project_title }}</div>
                  <div class="mt-1 opacity-70">Перейдите в проект, чтобы увидеть доступные задания.</div>
                </div>
              </v-card>
              
              <div class="notification-actions mt-3">
                <v-btn
                  v-if="notification.status === 'pending' || notification.status === 'sent'"
                  color="primary"
                  variant="text"
                  size="small"
                  class="text-none"
                  rounded="pill"
                  @click="handleMarkRead(notification.id, notification.activity_id)"
                >
                  <v-icon icon="mdi-email-open-outline" start size="16" />
                  Прочитано
                </v-btn>
                <v-btn
                  v-if="notification.notification_type === 'task_assigned' && notification.project_id"
                  color="primary"
                  variant="tonal"
                  size="small"
                  class="text-none"
                  rounded="pill"
                  @click="openProjectDialog(notification.project_id!)"
                >
                  Открыть проект
                  <v-icon icon="mdi-arrow-right" end size="14" />
                </v-btn>
              </div>
            </div>
          </v-card>
        </v-timeline-item>
      </v-timeline>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" rounded="pill">
        {{ snackbar.message }}
      </v-snackbar>

      <v-dialog v-model="projectDialog" :max-width="$vuetify.display.mobile ? '100%' : '750'" :fullscreen="$vuetify.display.mobile" scrollable transition="dialog-bottom-transition">
        <v-card v-if="projectDetail" class="project-dialog-card rounded-xl">
          <v-toolbar color="transparent" class="px-2">
            <v-toolbar-title class="font-weight-black">{{ projectDetail.title }}</v-toolbar-title>
            <v-btn icon="mdi-close" variant="text" @click="projectDialog = false" />
          </v-toolbar>

          <v-card-text class="pa-6">
            <v-skeleton-loader v-if="loadingProject" type="article@2" />

            <div v-else>
              <v-img
                v-if="projectDetail.cover_image_url"
                :src="projectDetail.cover_image_url"
                height="220"
                class="mb-6 rounded-xl"
                cover
              />

              <section class="mb-8">
                <h3 class="text-h6 font-weight-bold mb-3 d-flex align-center">
                  <v-icon icon="mdi-text-subject" start color="primary" class="me-2" />
                  Описание
                </h3>
                <p class="text-body-1 text-high-emphasis">{{ projectDetail.description }}</p>
              </section>

              <v-card variant="tonal" border color="primary" class="pa-4 mb-8 rounded-lg">
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <div class="d-flex align-center mb-3">
                      <v-icon icon="mdi-map-marker" size="18" class="me-2 opacity-70" />
                      <span class="text-body-2"><strong>Город:</strong> {{ projectDetail.city || '—' }}</span>
                    </div>
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-calendar-range" size="18" class="me-2 opacity-70" />
                      <span class="text-body-2"><strong>Срок:</strong> {{ formatDate(projectDetail.start_date) }}</span>
                    </div>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <div class="d-flex align-center mb-3">
                      <v-icon icon="mdi-account-group" size="18" class="me-2 opacity-70" />
                      <span class="text-body-2"><strong>Участников:</strong> {{ projectDetail.active_members }}</span>
                    </div>
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-shield-check" size="18" class="me-2 opacity-70" />
                      <span class="text-body-2"><strong>Организатор:</strong> {{ projectDetail.organizer_name }}</span>
                    </div>
                  </v-col>
                </v-row>
              </v-card>

              <div v-if="projectDetail.tags?.length" class="mb-4">
                <v-chip
                  v-for="tag in projectDetail.tags"
                  :key="tag"
                  size="small"
                  variant="outlined"
                  class="me-2 mb-2 text-none"
                  color="primary"
                >
                  {{ tag }}
                </v-chip>
              </div>
            </div>
          </v-card-text>

          <v-divider />
          <v-card-actions class="pa-6">
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              rounded="pill"
              class="px-8 text-none font-weight-black"
              size="large"
              elevation="4"
              :to="{ name: 'volunteer-projects', query: { project_id: projectDetail.project_id } }"
              @click="projectDialog = false"
            >
              Перейти к проекту
              <v-icon icon="mdi-arrow-right" end />
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<style scoped>
.notifications-container {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.notifications-page {
  display: flex;
  flex-direction: column;
}

/* Header */
.notifications-header-card {
  padding: 8px 0;
}

.notifications-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.notifications-title {
  font-size: 2.25rem;
  font-weight: 900;
  color: #1b2a1b;
  letter-spacing: -1.5px;
  margin: 0 0 4px 0;
  line-height: 1.1;
}

.notifications-description {
  font-size: 1rem;
  color: rgba(27, 42, 27, 0.55);
  margin: 0;
}

.notifications-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Notification Card */
.notification-card {
  background: #ffffff !important;
  border: 1px solid rgba(139, 195, 74, 0.12) !important;
  border-radius: 20px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important;
}

.notification-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06) !important;
  border-color: rgba(139, 195, 74, 0.3) !important;
}

.notification-card-inner {
  padding: 16px 20px;
}

.notification-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}

.notification-subject {
  font-size: 1.05rem;
  font-weight: 800;
  color: #1a1a1a;
  letter-spacing: -0.3px;
}

.notification-message {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
}

.project-info-mini {
  padding: 12px;
  border-radius: 12px !important;
  background: rgba(139, 195, 74, 0.03);
  border-color: rgba(139, 195, 74, 0.2) !important;
}

.unread-chip {
  font-weight: 700;
  font-size: 0.85rem;
}

/* Timeline Customization */
.custom-timeline :deep(.v-timeline-item__body) {
  padding-bottom: 8px !important;
}

.custom-timeline :deep(.v-timeline-divider__line) {
  width: 2px !important;
}

/* Mobile Adaptation */
@media (max-width: 960px) {
  .notifications-title {
    font-size: 1.75rem;
    letter-spacing: -1px;
  }
}

@media (max-width: 600px) {
  .notifications-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .notifications-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  
  .mark-all-btn {
    flex: 1;
    min-width: 0;
  }

  .notification-card-inner {
    padding: 14px 16px;
  }
  
  .notification-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .notification-subject {
    font-size: 0.95rem;
  }
  
  .notifications-title {
    font-size: 1.4rem;
    letter-spacing: -0.8px;
  }
  
  .notifications-description {
    font-size: 0.875rem;
  }
}

/* Transitions */
.dialog-bottom-transition-enter-active,
.dialog-bottom-transition-leave-active {
  transition: transform 0.3s ease-in-out;
}
</style>
