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
        // Игнорируем ошибки API для Activity, так как они хранятся в localStorage
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
  <div class="notifications-page">
    <v-card elevation="4" class="notifications-header-card mb-6">
      <div class="notifications-header">
        <div class="notifications-header-content">
          <h1 class="notifications-title">Уведомления</h1>
          <p class="notifications-description">
            Здесь отображаются все важные события, связанные с проектами, заданиями и модерацией.
          </p>
        </div>
        <div class="notifications-actions">
          <v-chip
            color="primary"
            variant="tonal"
            class="text-none font-weight-medium unread-chip"
          >
            Непрочитанных: {{ computedUnreadCount }}
          </v-chip>
          <v-btn
            color="primary"
            variant="flat"
            class="text-none font-weight-bold mark-all-btn"
            :disabled="computedUnreadCount === 0 || loading"
            @click="handleMarkAllRead"
          >
            <v-icon icon="mdi-check-all" start />
            Прочитать все
          </v-btn>
        </div>
      </div>
    </v-card>

    <v-skeleton-loader
      v-if="loading"
      type="list-item-two-line@6"
    />

    <v-alert
      v-else-if="!filteredNotifications.length"
      type="info"
      variant="tonal"
    >
      Пока уведомлений нет. Как только появятся события, вы увидите их здесь.
    </v-alert>

    <v-timeline v-else density="comfortable">
      <v-timeline-item
        v-for="notification in filteredNotifications"
        :key="notification.id"
        :dot-color="statusColor(notification.status)"
        size="small"
      >
        <div class="notification-header-row">
          <div class="notification-subject">
            {{ notification.subject }}
          </div>
          <v-chip
            v-if="notification.status !== 'delivered' && notification.status !== 'opened' && notification.status !== 'clicked'"
            size="x-small"
            :color="statusColor(notification.status)"
            variant="tonal"
            class="notification-status-chip text-uppercase font-weight-medium"
          >
            {{ notification.status === 'pending' ? 'Новое' : notification.status === 'sent' ? 'Отправлено' : notification.status }}
          </v-chip>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-2">
          {{ formatDateTime(notification.created_at) }}
        </div>
        <div class="text-body-2 mb-3">
          {{ notification.message }}
        </div>
        
        <!-- Дополнительная информация о проекте для уведомлений о заданиях -->
        <v-card
          v-if="notification.notification_type === 'task_assigned' && notification.project_id"
          variant="outlined"
          class="pa-3 mb-3"
          style="background: rgba(139, 195, 74, 0.05);"
        >
          <div class="d-flex align-center ga-2 mb-2">
            <v-icon icon="mdi-information-outline" size="20" color="primary" />
            <div class="text-subtitle-2 font-weight-semibold">Детали задания</div>
          </div>
          <div class="text-body-2 text-medium-emphasis">
            <div v-if="notification.project_title" class="mb-1">
              <strong>Проект:</strong> {{ notification.project_title }}
            </div>
            <div v-if="notification.project_id" class="mb-1">
              <strong>ID проекта:</strong> {{ notification.project_id }}
            </div>
            <div class="text-caption text-medium-emphasis mt-2">
              Перейдите во вкладку "Проекты" чтобы увидеть все задания проекта и принять участие.
            </div>
          </div>
        </v-card>
        
        <div class="notification-actions">
          <v-btn
            v-if="(notification.status === 'pending' || notification.status === 'sent') && notification.status !== 'opened' && notification.status !== 'clicked'"
            color="primary"
            variant="text"
            size="small"
            class="text-none notification-action-btn"
            @click="handleMarkRead(notification.id, notification.activity_id)"
          >
            Отметить прочитанным
          </v-btn>
          <v-btn
            v-if="notification.notification_type === 'task_assigned' && notification.project_id"
            color="primary"
            variant="outlined"
            size="small"
            class="text-none notification-action-btn"
            @click="openProjectDialog(notification.project_id!)"
          >
            Перейти в проект
            <v-icon icon="mdi-arrow-right" end size="16" />
          </v-btn>
        </div>
      </v-timeline-item>
    </v-timeline>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>

    <!-- Диалог с деталями проекта -->
    <v-dialog v-model="projectDialog" :max-width="$vuetify.display.mobile ? '100%' : '800'" :fullscreen="$vuetify.display.mobile" scrollable>
      <v-card v-if="projectDetail" class="project-dialog-card">
        <v-card-title class="project-dialog-title">
          <h2 class="project-dialog-title-text">{{ projectDetail.title }}</h2>
          <v-btn icon="mdi-close" variant="text" @click="projectDialog = false" class="project-dialog-close-btn" />
        </v-card-title>

        <v-card-text class="project-dialog-content">
          <v-skeleton-loader v-if="loadingProject" type="article@3" />

          <div v-else>
            <!-- Обложка проекта -->
            <v-img
              v-if="projectDetail.cover_image_url"
              :src="projectDetail.cover_image_url"
              :height="$vuetify.display.mobile ? '150' : '200'"
              class="mb-6 rounded-lg project-cover-image"
              cover
            />

            <!-- Описание -->
            <div class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">Описание</h3>
              <p class="text-body-1">{{ projectDetail.description }}</p>
            </div>

            <v-divider class="my-6" />

            <!-- Основная информация -->
            <v-row class="mb-6">
              <v-col cols="12" md="6">
                <div class="mb-3">
                  <v-icon icon="mdi-map-marker" size="20" class="me-2" />
                  <strong>Город:</strong> {{ projectDetail.city || '—' }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-calendar" size="20" class="me-2" />
                  <strong>Период:</strong>
                  <span v-if="projectDetail.start_date && projectDetail.end_date">
                    {{ formatDate(projectDetail.start_date) }} - {{ formatDate(projectDetail.end_date) }}
                  </span>
                  <span v-else-if="projectDetail.start_date">
                    С {{ formatDate(projectDetail.start_date) }}
                  </span>
                  <span v-else>—</span>
                </div>
                <div v-if="projectDetail.address" class="mb-3">
                  <v-icon icon="mdi-map-marker-outline" size="20" class="me-2" />
                  <strong>Адрес:</strong> {{ projectDetail.address }}
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="mb-3">
                  <v-icon icon="mdi-account-group" size="20" class="me-2" />
                  <strong>Участников:</strong> {{ projectDetail.active_members }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-clipboard-check" size="20" class="me-2" />
                  <strong>Заданий:</strong> {{ projectDetail.tasks_count }}
                </div>
                <div class="mb-3">
                  <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  <strong>Организатор:</strong> {{ projectDetail.organizer_name }}
                </div>
              </v-col>
            </v-row>

            <!-- Теги -->
            <div v-if="projectDetail.tags && projectDetail.tags.length" class="mb-6">
              <h3 class="text-h6 font-weight-bold mb-2">Теги</h3>
              <div class="d-flex flex-wrap ga-2">
                <v-chip
                  v-for="tag in projectDetail.tags"
                  :key="tag"
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  {{ tag }}
                </v-chip>
              </div>
            </div>

            <!-- Контакты -->
            <div
              v-if="projectDetail.contact_person || projectDetail.contact_phone || projectDetail.contact_email || projectDetail.contact_telegram || projectDetail.info_url"
              class="mb-6"
            >
              <h3 class="text-h6 font-weight-bold mb-3">Контакты</h3>
              <v-list density="compact" class="pa-0">
                <v-list-item v-if="projectDetail.contact_person" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-account-tie" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>{{ projectDetail.contact_person }}</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_phone" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-phone" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="`tel:${projectDetail.contact_phone}`" class="text-decoration-none">
                      {{ projectDetail.contact_phone }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_email" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-email-outline" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="`mailto:${projectDetail.contact_email}`" class="text-decoration-none">
                      {{ projectDetail.contact_email }}
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.contact_telegram" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-send" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.contact_telegram" target="_blank" class="text-decoration-none">
                      Telegram
                    </a>
                  </v-list-item-title>
                </v-list-item>
                <v-list-item v-if="projectDetail.info_url" class="px-0">
                  <template #prepend>
                    <v-icon icon="mdi-web" size="20" class="me-2" />
                  </template>
                  <v-list-item-title>
                    <a :href="projectDetail.info_url" target="_blank" class="text-decoration-none">
                      Дополнительная информация
                    </a>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="project-dialog-actions">
          <v-spacer />
          <div class="project-dialog-buttons">
            <v-btn
              color="primary"
              variant="flat"
              class="text-none font-weight-bold project-dialog-btn"
              :to="{ name: 'volunteer-projects', query: { project_id: projectDetail.project_id } }"
              @click="projectDialog = false"
            >
              Перейти к проекту
              <v-icon icon="mdi-arrow-right" end />
            </v-btn>
            <v-btn
              color="grey"
              variant="text"
              class="text-none project-dialog-btn"
              @click="projectDialog = false"
            >
              Закрыть
            </v-btn>
          </div>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.notifications-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Заголовок страницы */
.notifications-header-card {
  padding: 24px;
}

.notifications-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.notifications-header-content {
  flex: 1 1 auto;
  min-width: 200px;
}

.notifications-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.2;
}

.notifications-description {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  margin: 0;
  line-height: 1.5;
}

.notifications-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.unread-chip {
  white-space: nowrap;
}

.mark-all-btn {
  white-space: nowrap;
}

/* Элементы уведомлений */
.notification-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.notification-subject {
  font-size: 0.875rem;
  font-weight: 600;
  flex: 1 1 auto;
  min-width: 150px;
  word-break: break-word;
  line-height: 1.4;
}

.notification-status-chip {
  flex-shrink: 0;
}

.notification-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.notification-action-btn {
  flex: 1 1 auto;
  min-width: 120px;
}

/* Карточка с деталями проекта в уведомлении */
.notifications-page :deep(.v-timeline-item .v-card) {
  word-break: break-word;
}

/* Мобильная адаптация */
@media (max-width: 960px) {
  .notifications-header-card {
    padding: 16px;
  }
  
  .notifications-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .notifications-header-content {
    width: 100%;
  }
  
  .notifications-title {
    font-size: 1.25rem;
  }
  
  .notifications-description {
    font-size: 0.8125rem;
  }
  
  .notifications-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  
  .unread-chip {
    width: 100%;
    justify-content: center;
  }
  
  .mark-all-btn {
    width: 100%;
  }
  
  .notification-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .notification-subject {
    width: 100%;
    font-size: 0.8125rem;
  }
  
  .notification-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .notification-action-btn {
    width: 100%;
    min-width: 100%;
  }
  
  /* Timeline адаптация */
  .notifications-page :deep(.v-timeline) {
    padding-left: 0;
  }
  
  .notifications-page :deep(.v-timeline-item__body) {
    padding-left: 16px;
  }
  
  .notifications-page :deep(.v-timeline-item__opposite) {
    display: none;
  }
}

@media (max-width: 600px) {
  .notifications-header-card {
    padding: 12px;
  }
  
  .notifications-title {
    font-size: 1.125rem;
  }
  
  .notifications-description {
    font-size: 0.75rem;
  }
  
  .notification-subject {
    font-size: 0.75rem;
  }
  
  .notifications-page :deep(.v-timeline-item__body) {
    padding-left: 12px;
  }
  
  /* Карточка с деталями проекта */
  .notifications-page :deep(.v-timeline-item .v-card) {
    padding: 12px !important;
  }
  
  .notifications-page :deep(.v-timeline-item .v-card .text-subtitle-2) {
    font-size: 0.75rem !important;
  }
  
  .notifications-page :deep(.v-timeline-item .v-card .text-body-2) {
    font-size: 0.75rem !important;
  }
}

/* Диалог проекта */
.project-dialog-card {
  padding: 24px;
}

.project-dialog-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}

.project-dialog-title-text {
  font-size: 1.5rem;
  font-weight: 700;
  flex: 1 1 auto;
  word-break: break-word;
  line-height: 1.3;
}

.project-dialog-close-btn {
  flex-shrink: 0;
}

.project-dialog-content {
  word-break: break-word;
}

.project-cover-image {
  width: 100%;
  object-fit: cover;
}

.project-dialog-actions {
  padding: 24px;
  padding-top: 0;
}

.project-dialog-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.project-dialog-btn {
  flex: 1 1 auto;
  min-width: 120px;
}

/* Мобильная адаптация диалога */
@media (max-width: 960px) {
  .project-dialog-card {
    padding: 16px;
  }
  
  .project-dialog-title {
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  
  .project-dialog-title-text {
    font-size: 1.25rem;
    width: 100%;
  }
  
  .project-dialog-actions {
    padding: 16px;
    padding-top: 0;
  }
  
  .project-dialog-buttons {
    width: 100%;
    flex-direction: column;
  }
  
  .project-dialog-btn {
    width: 100%;
    min-width: 100%;
  }
}

@media (max-width: 600px) {
  .project-dialog-card {
    padding: 12px;
  }
  
  .project-dialog-title {
    margin-bottom: 12px;
  }
  
  .project-dialog-title-text {
    font-size: 1.125rem;
  }
  
  .project-dialog-actions {
    padding: 12px;
    padding-top: 0;
  }
  
  .project-dialog-content :deep(.text-h6) {
    font-size: 1rem !important;
  }
  
  .project-dialog-content :deep(.text-body-1) {
    font-size: 0.875rem !important;
  }
  
  .project-dialog-content :deep(.v-icon) {
    font-size: 18px !important;
  }
}
</style>

