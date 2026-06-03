<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { VForm } from 'vuetify/components';
import { useDisplay } from 'vuetify';

import { useOrganizerStore } from '@/stores/organizer';

const getFullImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  try {
    // Если уже полный URL, проверяем протокол
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Для localhost принудительно используем http (не https)
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Заменяем https на http для localhost
        if (url.startsWith('https://')) {
          return url.replace('https://', 'http://');
        }
        return url;
      }
      // Для production всегда используем https
      if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
      }
      return url;
    }
    
    // Если относительный путь, определяем базовый URL в зависимости от окружения
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Для localhost всегда используем http (не https)
    const baseUrl = isDevelopment 
      ? `http://${window.location.hostname}:8000`
      : (import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz');
    
    // Убеждаемся, что путь начинается с /
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanPath}`;
  } catch (error) {
    console.error('[PhotoModeration] Error building image URL:', error, url);
    return null;
  }
};

// Функция для обработки ошибок загрузки изображения с повторной попыткой
const imageErrorHandlers = new Map<number, number>();

const handleImageError = (photoId: number, imageUrl: string | null, event: Event) => {
  const retryCount = imageErrorHandlers.get(photoId) || 0;
  
  if (retryCount < 2 && imageUrl) {
    // Пытаемся использовать относительный путь вместо абсолютного
    const relativePath = imageUrl.replace(/^https?:\/\/[^/]+/, '');
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Для localhost всегда используем http (не https)
    const baseUrl = isDevelopment 
      ? `http://${window.location.hostname}:8000`
      : (import.meta.env.VITE_API_BASE_URL || 'https://cleanup.almau.edu.kz');
    const fallbackUrl = `${baseUrl}${relativePath}`;
    
    console.warn(`[PhotoModeration] Image load error for photo ${photoId}, retry ${retryCount + 1} with fallback URL:`, fallbackUrl);
    imageErrorHandlers.set(photoId, retryCount + 1);
    
    // Обновляем src изображения
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.src = fallbackUrl;
    }
  } else {
    console.error('[PhotoModeration] Failed to load image after retries:', {
      photoId,
      imageUrl,
      retryCount,
    });
  }
};

const { mobile } = useDisplay();
const organizerStore = useOrganizerStore();

const isOrganizer = computed(() => organizerStore.isOrganizer);
const isApproved = computed(() => organizerStore.isApproved);

const statusOptions = [
  { label: 'Все', value: 'all' as const, icon: 'mdi-view-grid-outline', color: 'default' },
  { label: 'На проверке', value: 'pending' as const, icon: 'mdi-clock-outline', color: 'orange' },
  { label: 'Одобренные', value: 'approved' as const, icon: 'mdi-check-circle-outline', color: 'success' },
  { label: 'Отклонённые', value: 'rejected' as const, icon: 'mdi-close-circle-outline', color: 'error' },
];

const selectedStatus = ref<'all' | 'pending' | 'approved' | 'rejected'>(organizerStore.photoStatus);
const selectedProjectId = ref<number | null>(organizerStore.photoProjectFilter ?? null);

watch(() => organizerStore.photoStatus, (value) => { selectedStatus.value = value; }, { immediate: true });
watch(() => organizerStore.photoProjectFilter, (value) => { selectedProjectId.value = value ?? null; }, { immediate: true });

const snackbar = reactive({ show: false, color: 'success', message: '' });

const detailDialog = reactive({ open: false, photoId: null as number | null, slide: 0 });

const approveDialog = reactive({
  open: false, photoId: null as number | null,
  rating: 5, feedback: '', error: '', publishAsReview: false,
});

const rejectDialog = reactive({
  open: false, photoId: null as number | null,
  feedback: '', error: '',
});

const rejectFormRef = ref<VForm | null>(null);
const rejectRules = [(value: string) => !!value?.trim() || 'Укажите причину отклонения.'];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return dateTimeFormatter.format(new Date(value));
}
function formatTime(value: string | null | undefined) {
  if (!value) return null;
  return timeFormatter.format(new Date(`1970-01-01T${value}`));
}

async function handleStatusChange(value: 'all' | 'pending' | 'approved' | 'rejected') {
  console.log('[PhotoModeration] Status changed to:', value);
  // Обновляем локальное значение
  selectedStatus.value = value;
  
  // Обновляем статус в store
  organizerStore.photoStatus = value;
  
  // Загружаем фотоотчеты с новым статусом
  try {
  await organizerStore.loadPhotoReports({ 
    status: value, 
    projectId: selectedProjectId.value, 
    offset: 0, 
    force: true 
  });
    console.log('[PhotoModeration] Photo reports loaded after status change:', {
      count: organizerStore.photoReports.length,
      status: value,
    });
  } catch (error) {
    console.error('[PhotoModeration] Error loading photo reports:', error);
  }
}

async function handleProjectChange(value: number | null) {
  console.log('[PhotoModeration] Project filter changed to:', value);
  // Обновляем локальное значение
  selectedProjectId.value = value;
  
  // Обновляем фильтр в store
  organizerStore.photoProjectFilter = value;
  
  // Загружаем фотоотчеты с новым фильтром
  try {
  await organizerStore.loadPhotoReports({ 
    status: selectedStatus.value, 
    projectId: value, 
    offset: 0, 
    force: true 
  });
    console.log('[PhotoModeration] Photo reports loaded after project change:', {
      count: organizerStore.photoReports.length,
      projectId: value,
    });
  } catch (error) {
    console.error('[PhotoModeration] Error loading photo reports:', error);
  }
}

async function openPhotoDetail(photoId: number) {
  detailDialog.photoId = photoId;
  detailDialog.open = true;
  detailDialog.slide = 0;
  try { await organizerStore.ensurePhotoDetail(photoId); } catch (error) { /* stored in state */ }
}

function closePhotoDetail() {
  detailDialog.open = false;
  detailDialog.photoId = null;
  detailDialog.slide = 0;
}

function openApproveDialog(photoId: number) {
  approveDialog.open = true;
  approveDialog.photoId = photoId;
  approveDialog.rating = 5;
  approveDialog.feedback = '';
  approveDialog.publishAsReview = false;
  approveDialog.error = '';
}

async function submitApprove(skip = false) {
  if (!approveDialog.photoId) return;
  approveDialog.error = '';
  if (!skip) {
    if (!approveDialog.rating) { approveDialog.error = 'Выберите оценку от 1 до 5.'; return; }
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) {
      approveDialog.error = 'Для оценки 1–3 звезды добавьте комментарий.'; return;
    }
  }
  try {
    await organizerStore.approvePhotoReport(approveDialog.photoId, {
      skip,
      rating: skip ? undefined : approveDialog.rating,
      feedback: approveDialog.feedback.trim() || undefined,
      publish_as_review: !skip && approveDialog.publishAsReview && !!approveDialog.feedback.trim(),
    });
    approveDialog.open = false;
    snackbar.message = skip ? 'Фото одобрено без оценки.' : 'Фото одобрено.';
    snackbar.color = skip ? 'primary' : 'success';
    snackbar.show = true;
  } catch (error: any) {
    let msg = 'Не удалось одобрить фото.';
    if (error?.response?.status === 500) msg = 'Ошибка сервера. Попробуйте позже.';
    else if (error?.response?.data?.error) msg = error.response.data.error;
    else if (error?.response?.data?.detail) msg = error.response.data.detail;
    else if (error?.message) msg = error.message;
    approveDialog.error = msg;
  }
}

function openRejectDialog(photoId: number) {
  rejectDialog.open = true;
  rejectDialog.photoId = photoId;
  rejectDialog.feedback = '';
  rejectDialog.error = '';
}

async function submitReject() {
  if (!rejectDialog.photoId) return;
  rejectDialog.error = '';
  const { valid } = (await rejectFormRef.value?.validate()) ?? { valid: false };
  if (!valid) return;
  try {
    await organizerStore.rejectPhotoReport(rejectDialog.photoId, rejectDialog.feedback.trim());
    rejectDialog.open = false;
    snackbar.message = 'Фото отклонено, волонтёр уведомлён.';
    snackbar.color = 'info';
    snackbar.show = true;
  } catch (error: any) {
    rejectDialog.error = error?.response?.data?.error || error?.message || 'Не удалось отклонить фото.';
  }
}

const currentDetail = computed(() => detailDialog.photoId ? organizerStore.photoDetails[detailDialog.photoId] : null);
const currentDetailLoading = computed(() => detailDialog.photoId ? !!organizerStore.photoDetailsLoading[detailDialog.photoId] : false);
const currentDetailError = computed(() => detailDialog.photoId ? organizerStore.photoDetailsError[detailDialog.photoId] : null);

const projectOptions = computed(() =>
  organizerStore.projects.map(p => ({ title: p.title, value: p.id })),
);

const photoReports = computed(() => organizerStore.photoReports);
const photoLoading = computed(() => organizerStore.photoLoading);
const photoError = computed(() => organizerStore.photoError);
const counters = computed(() => organizerStore.photoCounters);
const hasPhotos = computed(() => photoReports.value.length > 0);

const photoActionLoading = (photoId: number) => organizerStore.photoActionLoading[photoId] ?? false;
const photoActionError = (photoId: number) => organizerStore.photoActionError[photoId];

const canSubmitApproval = computed(() => {
  if (!approveDialog.photoId) return false;
  if (approveDialog.rating >= 1 && approveDialog.rating <= 5) {
    if (approveDialog.rating <= 3 && !approveDialog.feedback.trim()) return false;
    return true;
  }
  return false;
});

function statusCount(value: 'all' | 'pending' | 'approved' | 'rejected') {
  if (value === 'all') return counters.value.total;
  return counters.value[value];
}

async function refreshList() {
  console.log('[PhotoModeration] Refreshing photo reports...');
  try {
    await organizerStore.refreshPhotoReports();
    console.log('[PhotoModeration] Photo reports refreshed:', {
      count: organizerStore.photoReports.length,
      counters: organizerStore.photoCounters,
    });
  } catch (error) {
    console.error('[PhotoModeration] Error refreshing photo reports:', error);
  }
}

const photoStatusConfig = (status: string) => {
  const map: Record<string, { color: string; label: string; icon: string }> = {
    pending: { color: '#ff6d00', label: 'На проверке', icon: 'mdi-clock-outline' },
    approved: { color: '#2e7d32', label: 'Одобрено', icon: 'mdi-check-circle-outline' },
    rejected: { color: '#c62828', label: 'Отклонено', icon: 'mdi-close-circle-outline' },
  };
  return map[status] || map['pending'];
};

onMounted(async () => {
  if (!organizerStore.isOrganizer) {
    console.log('[PhotoModeration] User is not an organizer');
    return;
  }
  console.log('[PhotoModeration] Loading projects and photo reports...');
  try {
  await organizerStore.loadProjects();
    console.log('[PhotoModeration] Projects loaded:', organizerStore.projects.length);
  await organizerStore.loadPhotoReports({ force: true });
    console.log('[PhotoModeration] Photo reports loaded:', {
      count: organizerStore.photoReports.length,
      counters: organizerStore.photoCounters,
      loading: organizerStore.photoLoading,
      error: organizerStore.photoError,
    });
  } catch (error) {
    console.error('[PhotoModeration] Error loading data:', error);
  }
});

watch(() => detailDialog.open, (open) => { if (!open) detailDialog.slide = 0; });
</script>

<template>
  <div class="photos-view">

    <!-- ─── Page Header ─── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Фотоотчёты</h1>
        <p class="page-subtitle">Модерация отчётов и оценка работы волонтёров</p>
      </div>
      <div class="header-stats" v-if="isOrganizer && isApproved">
        <div class="stat-pill stat-pill--pending">
          <v-icon icon="mdi-clock-outline" size="15" />
          {{ counters.pending }} на проверке
        </div>
        <div class="stat-pill stat-pill--approved">
          <v-icon icon="mdi-check-circle-outline" size="15" />
          {{ counters.approved }} одобрено
        </div>
      </div>
    </div>

    <!-- ─── Alerts ─── -->
    <v-alert v-if="!isOrganizer" type="error" variant="tonal" rounded="xl" border="start" icon="mdi-shield-alert-outline">
      Управление фотоотчётами доступно только организаторам проектов.
    </v-alert>
    <v-alert v-else-if="!isApproved" type="info" variant="tonal" rounded="xl" border="start" icon="mdi-clock-outline">
      После одобрения заявки вы сможете модерировать фотоотчёты волонтёров.
    </v-alert>

    <!-- ─── Main content ─── -->
    <div v-else class="main-layout">

      <!-- Photos column -->
      <div class="photos-col">

        <!-- Filters -->
        <div class="filters-bar">
          <div class="status-tabs">
            <button
              v-for="option in statusOptions"
              :key="option.value"
              class="status-tab"
              :class="`status-tab--${option.value} ${selectedStatus === option.value ? 'status-tab--active' : ''}`"
              @click="handleStatusChange(option.value)"
            >
              <v-icon :icon="option.icon" size="15" />
              {{ option.label }}
              <span class="status-tab__count">{{ statusCount(option.value) }}</span>
            </button>
          </div>

          <div class="filters-bar__right">
            <v-select
              v-model="selectedProjectId"
              :items="projectOptions"
              label="Проект"
              variant="outlined"
              density="compact"
              clearable
              hide-details
              style="min-width: 200px"
              @update:model-value="handleProjectChange"
            />
            <button class="refresh-btn" :disabled="photoLoading" @click="refreshList">
              <v-icon :icon="photoLoading ? 'mdi-loading' : 'mdi-refresh'" size="18"
                :class="{ 'spin': photoLoading }" />
            </button>
          </div>
        </div>

        <!-- Error -->
        <v-alert v-if="photoError" type="error" variant="tonal" rounded="xl" border="start">
          {{ photoError }}
        </v-alert>

        <!-- Loading skeletons -->
        <div v-else-if="photoLoading && !hasPhotos" class="photos-grid">
          <div v-for="i in 6" :key="i" class="photo-card photo-card--skeleton">
            <v-skeleton-loader type="image" height="180" />
            <v-skeleton-loader type="article" class="pa-3" />
          </div>
        </div>

        <!-- Photos grid -->
        <div v-else-if="hasPhotos" class="photos-grid">
          <div v-for="photo in photoReports" :key="photo.id" class="photo-card">

            <!-- Image -->
            <div class="photo-card__media" @click="openPhotoDetail(photo.id)">
              <v-img
                v-if="photo.image_url"
                :src="getFullImageUrl(photo.image_url) || ''"
                height="180"
                @error="(e) => handleImageError(photo.id, photo.image_url, e as Event)"
                cover
                class="photo-card__img"
                :lazy-src="getFullImageUrl(photo.image_url) || ''"
              />
              <div v-else class="photo-card__no-img">
                <v-icon icon="mdi-image-off-outline" size="32" />
                <span>Нет фото</span>
              </div>

              <!-- Status badge -->
              <div class="photo-card__badge" :class="`photo-card__badge--${photo.status}`">
                <v-icon :icon="photoStatusConfig(photo.status).icon" size="13" />
                {{ photoStatusConfig(photo.status).label }}
              </div>

              <!-- Rating badge -->
              <div v-if="photo.rating" class="photo-card__rating-badge">
                <v-icon icon="mdi-star" size="13" />
                {{ photo.rating }}
              </div>

              <!-- View overlay -->
              <div class="photo-card__overlay">
                <v-icon icon="mdi-eye-outline" size="28" color="white" />
              </div>
            </div>

            <!-- Body -->
            <div class="photo-card__body">
              <!-- Volunteer + project -->
              <div class="photo-card__who">
                <div class="volunteer-avatar">
                  {{ photo.volunteer.name.slice(0, 2).toUpperCase() }}
                </div>
                <div class="photo-card__who-text">
                  <div class="photo-card__volunteer">{{ photo.volunteer.name }}</div>
                  <div class="photo-card__project">{{ photo.project.title }}</div>
                </div>
              </div>

              <!-- Task info -->
              <div class="photo-card__task">
                <div class="photo-card__task-text">
                  <v-icon icon="mdi-clipboard-text-outline" size="14" />
                  {{ photo.task.text || 'Без задания' }}
                </div>
                <div class="photo-card__task-meta">
                  <v-icon icon="mdi-calendar-outline" size="13" />
                  {{ formatDate(photo.task.deadline_date) }}
                  <template v-if="formatTime(photo.task.start_time)">
                    · {{ formatTime(photo.task.start_time) }}–{{ formatTime(photo.task.end_time) }}
                  </template>
                </div>
              </div>

              <!-- Comments -->
              <div v-if="photo.volunteer_comment" class="photo-card__comment photo-card__comment--volunteer">
                <v-icon icon="mdi-message-text-outline" size="13" />
                {{ photo.volunteer_comment }}
              </div>
              <div v-if="photo.organizer_comment && photo.status === 'approved'" class="photo-card__comment photo-card__comment--organizer">
                <v-icon icon="mdi-message-check-outline" size="13" />
                {{ photo.organizer_comment }}
              </div>
              <div v-if="photo.rejection_reason && photo.status === 'rejected'" class="photo-card__comment photo-card__comment--rejected">
                <v-icon icon="mdi-alert-circle-outline" size="13" />
                {{ photo.rejection_reason }}
              </div>

              <v-alert v-if="photoActionError(photo.id)" type="error" variant="tonal" density="compact" rounded="lg" class="mt-2">
                {{ photoActionError(photo.id) }}
              </v-alert>
            </div>

            <!-- Actions -->
            <div class="photo-card__actions">
              <template v-if="photo.status === 'pending'">
                <button class="action-btn action-btn--approve" :disabled="photoActionLoading(photo.id)" @click="openApproveDialog(photo.id)">
                  <v-icon icon="mdi-check" size="16" />
                  Одобрить
                </button>
                <button class="action-btn action-btn--reject" :disabled="photoActionLoading(photo.id)" @click="openRejectDialog(photo.id)">
                  <v-icon icon="mdi-close" size="16" />
                  Отклонить
                </button>
              </template>
              <template v-else>
                <div class="action-status" :class="`action-status--${photo.status}`">
                  <v-icon :icon="photoStatusConfig(photo.status).icon" size="15" />
                  {{ photoStatusConfig(photo.status).label }}
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-state__icon">
            <v-icon icon="mdi-image-search-outline" size="40" />
          </div>
          <h3 class="empty-state__title">Фотоотчётов нет</h3>
          <p class="empty-state__text">
            Волонтёры ещё не отправили фотоотчёты. Как только они появятся — вы увидите их здесь.
          </p>
        </div>

        <!-- ── Tips card for mobile ── -->
        <div class="tips-card-mobile">
          <div class="tips-card">
            <div class="tips-card__header">
              <v-icon icon="mdi-lightbulb-outline" size="18" class="tips-card__icon" />
              <span>Советы модератора</span>
            </div>
            <div class="tips-list">
              <div class="tip-item">
                <div class="tip-item__icon tip-item__icon--blue">
                  <v-icon icon="mdi-message-reply-outline" size="16" />
                </div>
                <div>
                  <div class="tip-item__title">Давайте обратную связь</div>
                  <p class="tip-item__text">Благодарность и короткий комментарий повышают мотивацию волонтёров.</p>
                </div>
              </div>
              <div class="tip-item">
                <div class="tip-item__icon tip-item__icon--yellow">
                  <v-icon icon="mdi-star-outline" size="16" />
                </div>
                <div>
                  <div class="tip-item__title">Используйте рейтинги</div>
                  <p class="tip-item__text">Оценка 4–5 звёзд ускоряет рост волонтёра и открывает новые задачи.</p>
                </div>
              </div>
              <div class="tip-item">
                <div class="tip-item__icon tip-item__icon--red">
                  <v-icon icon="mdi-text-box-check-outline" size="16" />
                </div>
                <div>
                  <div class="tip-item__title">Чёткие причины отказа</div>
                  <p class="tip-item__text">Конкретное объяснение помогает быстро исправить и повторно отправить.</p>
                </div>
              </div>
              <div class="tip-item">
                <div class="tip-item__icon tip-item__icon--green">
                  <v-icon icon="mdi-timer-check-outline" size="16" />
                </div>
                <div>
                  <div class="tip-item__title">Следите за дедлайнами</div>
                  <p class="tip-item__text">Проверенные фото закрывают задачи и обновляют статистику автоматически.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tips sidebar -->
      <div class="sidebar-col">
        <div class="tips-card">
          <div class="tips-card__header">
            <v-icon icon="mdi-lightbulb-outline" size="18" class="tips-card__icon" />
            <span>Советы модератора</span>
          </div>
          <div class="tips-list">
            <div class="tip-item">
              <div class="tip-item__icon tip-item__icon--blue">
                <v-icon icon="mdi-message-reply-outline" size="16" />
              </div>
              <div>
                <div class="tip-item__title">Давайте обратную связь</div>
                <p class="tip-item__text">Благодарность и короткий комментарий повышают мотивацию волонтёров.</p>
              </div>
            </div>
            <div class="tip-item">
              <div class="tip-item__icon tip-item__icon--yellow">
                <v-icon icon="mdi-star-outline" size="16" />
              </div>
              <div>
                <div class="tip-item__title">Используйте рейтинги</div>
                <p class="tip-item__text">Оценка 4–5 звёзд ускоряет рост волонтёра и открывает новые задачи.</p>
              </div>
            </div>
            <div class="tip-item">
              <div class="tip-item__icon tip-item__icon--red">
                <v-icon icon="mdi-text-box-check-outline" size="16" />
              </div>
              <div>
                <div class="tip-item__title">Чёткие причины отказа</div>
                <p class="tip-item__text">Конкретное объяснение помогает быстро исправить и повторно отправить.</p>
              </div>
            </div>
            <div class="tip-item">
              <div class="tip-item__icon tip-item__icon--green">
                <v-icon icon="mdi-timer-check-outline" size="16" />
              </div>
              <div>
                <div class="tip-item__title">Следите за дедлайнами</div>
                <p class="tip-item__text">Проверенные фото закрывают задачи и обновляют статистику автоматически.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Photo Detail Dialog ─── -->
    <v-dialog v-model="detailDialog.open" max-width="700" :fullscreen="mobile">
      <div class="detail-modal">
        <div class="detail-modal__header">
          <div class="detail-modal__title-block">
            <div class="detail-modal__name">{{ currentDetail?.volunteer_name || 'Фотоотчёт' }}</div>
            <div class="detail-modal__project">{{ currentDetail?.project_title }}</div>
          </div>
          <button class="detail-modal__close" @click="closePhotoDetail">
            <v-icon icon="mdi-close" size="20" />
          </button>
        </div>

        <div class="detail-modal__body">
          <div v-if="currentDetailLoading" class="pa-6">
            <v-skeleton-loader type="image" height="300" class="mb-4" />
            <v-skeleton-loader type="list-item-three-line" />
          </div>

          <v-alert v-else-if="currentDetailError" type="error" variant="tonal" rounded="lg" border="start" class="ma-4">
            {{ currentDetailError }}
          </v-alert>

          <div v-else-if="currentDetail" class="detail-modal__content">
            <!-- Image viewer -->
            <div class="detail-modal__viewer">
              <template v-if="currentDetail.photos && currentDetail.photos.length > 0">
                <v-window v-model="detailDialog.slide">
                  <v-window-item v-for="(item, i) in currentDetail.photos" :key="item.id" :value="i">
                    <v-img v-if="item.image_url" :src="getFullImageUrl(item.image_url) || ''" max-height="420" contain class="detail-modal__img" />
                    <div v-else class="detail-modal__no-img"><v-icon icon="mdi-image-off-outline" size="40" /></div>
                  </v-window-item>
                </v-window>
              </template>
              <template v-else>
                <v-img v-if="currentDetail.image_url" :src="getFullImageUrl(currentDetail.image_url) || ''" max-height="420" contain class="detail-modal__img" />
                <div v-else class="detail-modal__no-img"><v-icon icon="mdi-image-off-outline" size="40" /></div>
              </template>

              <!-- Nav controls -->
              <div v-if="currentDetail.photos && currentDetail.photos.length > 1" class="detail-modal__nav">
                <button class="detail-modal__nav-btn" :disabled="detailDialog.slide === 0" @click="detailDialog.slide--">
                  <v-icon icon="mdi-chevron-left" size="22" />
                </button>
                <span class="detail-modal__counter">{{ detailDialog.slide + 1 }} / {{ currentDetail.photos.length }}</span>
                <button class="detail-modal__nav-btn" :disabled="detailDialog.slide === currentDetail.photos.length - 1" @click="detailDialog.slide++">
                  <v-icon icon="mdi-chevron-right" size="22" />
                </button>
              </div>

              <!-- Thumbnails -->
              <div v-if="currentDetail.photos && currentDetail.photos.length > 1" class="detail-modal__thumbs">
                <div
                  v-for="(item, i) in currentDetail.photos"
                  :key="`t-${item.id}`"
                  class="detail-modal__thumb"
                  :class="{ 'detail-modal__thumb--active': detailDialog.slide === i }"
                  @click="detailDialog.slide = i"
                >
                  <v-img v-if="item.image_url" :src="getFullImageUrl(item.image_url) || ''" cover height="52" width="52" />
                  <v-icon v-else icon="mdi-image-off-outline" size="20" />
                </div>
              </div>
            </div>

            <!-- Meta info -->
            <div class="detail-modal__meta">
              <div class="detail-meta-row">
                <span class="detail-meta-row__label">Задача</span>
                <span class="detail-meta-row__value">{{ currentDetail.task_text || '—' }}</span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-meta-row__label">Статус</span>
                <span class="detail-meta-row__value">
                  <span class="detail-status-badge" :class="`detail-status-badge--${currentDetail.status}`">
                    {{ photoStatusConfig(currentDetail.status).label }}
                  </span>
                </span>
              </div>
              <div class="detail-meta-row">
                <span class="detail-meta-row__label">Загружено</span>
                <span class="detail-meta-row__value">{{ formatDateTime(currentDetail.uploaded_at) }}</span>
              </div>
              <div v-if="currentDetail.moderated_at" class="detail-meta-row">
                <span class="detail-meta-row__label">Проверено</span>
                <span class="detail-meta-row__value">{{ formatDateTime(currentDetail.moderated_at) }}</span>
              </div>
              <div v-if="currentDetail.rating" class="detail-meta-row">
                <span class="detail-meta-row__label">Оценка</span>
                <span class="detail-meta-row__value">
                  <span style="display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#f59e0b">
                    <v-icon icon="mdi-star" size="16" color="amber" />
                    {{ currentDetail.rating }} / 5
                  </span>
                </span>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="currentDetail.volunteer_comment" class="detail-note detail-note--volunteer">
              <span class="detail-note__label">Комментарий волонтёра</span>
              <p class="detail-note__text">{{ currentDetail.volunteer_comment }}</p>
            </div>
            <div v-if="currentDetail.organizer_comment" class="detail-note detail-note--organizer">
              <span class="detail-note__label">Ваш комментарий</span>
              <p class="detail-note__text">{{ currentDetail.organizer_comment }}</p>
            </div>
            <div v-if="currentDetail.rejection_reason" class="detail-note detail-note--rejected">
              <span class="detail-note__label">Причина отклонения</span>
              <p class="detail-note__text">{{ currentDetail.rejection_reason }}</p>
            </div>
          </div>
        </div>

        <div class="detail-modal__footer">
          <button class="detail-close-btn" @click="closePhotoDetail">Закрыть</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Approve Dialog ─── -->
    <v-dialog v-model="approveDialog.open" max-width="400">
      <div class="action-modal">
        <div class="action-modal__header action-modal__header--approve">
          <div class="action-modal__icon">
            <v-icon icon="mdi-check-circle-outline" size="24" color="white" />
          </div>
          <div class="action-modal__title">Оценить фотоотчёт</div>
        </div>
        <div class="action-modal__body">
          <p class="action-modal__desc">Выберите оценку. Для 1–3 звёзд добавьте комментарий.</p>
          <div class="rating-row">
            <v-rating v-model="approveDialog.rating" length="5" color="amber-darken-1" active-color="amber-darken-1" size="32" />
          </div>
          <v-textarea
            v-model="approveDialog.feedback"
            label="Комментарий"
            variant="outlined"
            density="comfortable"
            rows="3"
            auto-grow
            counter="400"
            maxlength="400"
            hint="Обязателен для оценки 1–3 ★"
          />
          <v-checkbox
            v-model="approveDialog.publishAsReview"
            label="Опубликовать комментарий как отзыв в профиле волонтёра"
            density="compact"
            hide-details
            color="primary"
            class="mt-2"
            :disabled="!approveDialog.feedback.trim()"
          />
          <v-alert v-if="approveDialog.error" type="error" variant="tonal" density="compact" rounded="lg" class="mt-3">
            {{ approveDialog.error }}
          </v-alert>
        </div>
        <div class="action-modal__footer">
          <button class="action-modal__btn action-modal__btn--primary action-modal__btn--green"
            :disabled="!canSubmitApproval || (approveDialog.photoId ? photoActionLoading(approveDialog.photoId) : false)"
            @click="submitApprove(false)">
            <v-icon icon="mdi-check" size="18" />
            Одобрить с оценкой
          </button>
          <button class="action-modal__btn action-modal__btn--cancel" @click="approveDialog.open = false">Отмена</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Reject Dialog ─── -->
    <v-dialog v-model="rejectDialog.open" max-width="400">
      <div class="action-modal">
        <div class="action-modal__header action-modal__header--reject">
          <div class="action-modal__icon">
            <v-icon icon="mdi-close-circle-outline" size="24" color="white" />
          </div>
          <div class="action-modal__title">Отклонить фотоотчёт</div>
        </div>
        <div class="action-modal__body">
          <p class="action-modal__desc">Укажите причину — волонтёр получит уведомление и сможет исправить.</p>
          <v-form ref="rejectFormRef" @submit.prevent="submitReject">
            <v-textarea
              v-model="rejectDialog.feedback"
              label="Причина отклонения"
              variant="outlined"
              density="comfortable"
              rows="4"
              auto-grow
              counter="400"
              maxlength="400"
              :rules="rejectRules"
              required
            />
          </v-form>
          <v-alert v-if="rejectDialog.error" type="error" variant="tonal" density="compact" rounded="lg" class="mt-3">
            {{ rejectDialog.error }}
          </v-alert>
        </div>
        <div class="action-modal__footer">
          <button class="action-modal__btn action-modal__btn--primary action-modal__btn--red"
            :disabled="rejectDialog.photoId ? photoActionLoading(rejectDialog.photoId) : false"
            @click="submitReject">
            <v-icon icon="mdi-close" size="18" />
            Отклонить
          </button>
          <button class="action-modal__btn action-modal__btn--cancel" @click="rejectDialog.open = false">Отмена</button>
        </div>
      </div>
    </v-dialog>

    <!-- ─── Snackbar ─── -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000" rounded="pill" location="bottom center">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
/* ─── Base ─── */
.photos-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* ─── Page Header ─── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: linear-gradient(135deg, #f0faf0, #fafff5);
  border: 1px solid rgba(139, 195, 74, 0.18);
  border-radius: 20px;
  padding: 20px 28px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  margin: 0 0 4px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.45);
  margin: 0;
}

.header-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 0.825rem;
  font-weight: 700;
}

.stat-pill--pending {
  background: rgba(255, 109, 0, 0.1);
  color: #e65100;
  border: 1px solid rgba(255, 109, 0, 0.2);
}

.stat-pill--approved {
  background: rgba(46, 125, 50, 0.08);
  color: #2e7d32;
  border: 1px solid rgba(46, 125, 50, 0.15);
}

/* ─── Main layout ─── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 16px;
  align-items: start;
}

/* ─── Mobile tips card ─── */
.tips-card-mobile {
  display: none;
  margin-top: 24px;
}

/* Адаптация для ноутбуков (1024px - 1440px) */
@media (max-width: 1440px) {
  .main-layout {
    gap: 12px;
  }
  
  .sidebar-col {
    width: 240px;
  }
  
  .photos-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
}

@media (max-width: 1024px) {
  .main-layout { 
    grid-template-columns: 1fr; 
    gap: 16px;
  }
  .sidebar-col { display: none; }
  .tips-card-mobile { display: block; }
  
  .photos-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 16px 20px;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .header-stats {
    width: 100%;
    margin-top: 12px;
  }
  
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .filters-bar__right {
    width: 100%;
  }
  
  .filters-bar__right :deep(.v-select) {
    width: 100% !important;
    min-width: 100% !important;
  }
  
  .status-tabs {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .status-tabs::-webkit-scrollbar {
    display: none;
  }
  
  .status-tab {
    flex-shrink: 0;
    white-space: nowrap;
  }
  
  .photos-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 600px) {
  .page-header {
    padding: 12px 16px;
    border-radius: 16px;
  }
  
  .page-title {
    font-size: 1.25rem;
  }
  
  .page-subtitle {
    font-size: 0.8rem;
  }
  
  .stat-pill {
    font-size: 0.75rem;
    padding: 5px 12px;
  }
  
  .filters-bar {
    padding: 10px 12px;
    border-radius: 12px;
  }
  
  .status-tab {
    font-size: 0.75rem;
    padding: 5px 10px;
  }
  
  .photo-card__img {
    height: 160px !important;
  }
  
  .detail-modal {
    border-radius: 16px;
  }
  
  .detail-modal__header {
    padding: 12px 16px;
  }
  
  .detail-modal__content {
    padding: 12px 16px;
  }
  
  .action-modal__body {
    padding: 12px 16px;
  }
  
  .action-modal__footer {
    padding: 10px 16px 16px;
  }
}

/* ─── Filters bar ─── */
.filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 16px;
  padding: 12px 16px;
}

.status-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 100px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: transparent;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition: all 0.18s;
}

.status-tab:hover { background: rgba(0, 0, 0, 0.04); }

.status-tab--active.status-tab--all { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
.status-tab--active.status-tab--pending { background: #e65100; color: #fff; border-color: #e65100; }
.status-tab--active.status-tab--approved { background: #2e7d32; color: #fff; border-color: #2e7d32; }
.status-tab--active.status-tab--rejected { background: #c62828; color: #fff; border-color: #c62828; }

.status-tab__count {
  background: rgba(255, 255, 255, 0.25);
  padding: 1px 6px;
  border-radius: 100px;
  font-size: 0.72rem;
}

.status-tab:not(.status-tab--active) .status-tab__count {
  background: rgba(0, 0, 0, 0.07);
}

.filters-bar__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(139, 195, 74, 0.25);
  background: rgba(139, 195, 74, 0.06);
  color: #558b2f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.refresh-btn:hover { background: rgba(139, 195, 74, 0.14); }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ─── Photos grid ─── */
.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

/* ─── Photo card ─── */
.photo-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.2s, transform 0.2s;
}

.photo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.09);
}

.photo-card--skeleton { pointer-events: none; }

/* Media */
.photo-card__media {
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.photo-card__img { display: block; }

.photo-card__no-img {
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: repeating-linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.03),
    rgba(0, 0, 0, 0.03) 10px,
    rgba(0, 0, 0, 0.06) 10px,
    rgba(0, 0, 0, 0.06) 20px
  );
  color: rgba(0, 0, 0, 0.3);
  font-size: 0.8rem;
}

.photo-card__badge {
  position: absolute;
  bottom: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 100px;
  font-size: 0.72rem;
  font-weight: 700;
}

.photo-card__badge--pending { background: #e65100; color: #fff; }
.photo-card__badge--approved { background: #2e7d32; color: #fff; }
.photo-card__badge--rejected { background: #c62828; color: #fff; }

.photo-card__rating-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, 0.6);
  color: #fbbf24;
  padding: 3px 8px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 700;
}

.photo-card__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  opacity: 0;
}

.photo-card__media:hover .photo-card__overlay {
  background: rgba(0, 0, 0, 0.3);
  opacity: 1;
}

/* Card body */
.photo-card__body {
  padding: 14px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.photo-card__who {
  display: flex;
  align-items: center;
  gap: 10px;
}

.volunteer-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8bc34a, #558b2f);
  color: white;
  font-size: 0.7rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.photo-card__volunteer {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1a1a1a;
}

.photo-card__project {
  font-size: 0.775rem;
  color: rgba(0, 0, 0, 0.45);
}

.photo-card__task {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.photo-card__task-text {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 0.8rem;
  color: #1a1a1a;
  font-weight: 500;
  line-height: 1.4;
}

.photo-card__task-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.4);
}

.photo-card__comment {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 0.775rem;
  padding: 8px 10px;
  border-radius: 8px;
  line-height: 1.4;
}

.photo-card__comment--volunteer { background: rgba(139, 195, 74, 0.08); color: #3a5c1a; }
.photo-card__comment--organizer { background: rgba(46, 125, 50, 0.08); color: #1b5e20; }
.photo-card__comment--rejected { background: rgba(198, 40, 40, 0.07); color: #b71c1c; }

/* Actions bar */
.photo-card__actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.015);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  justify-content: center;
  padding: 7px 10px;
  border-radius: 10px;
  border: none;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.action-btn:hover:not(:disabled) { opacity: 0.88; transform: scale(1.02); }
.action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.action-btn--approve { background: linear-gradient(135deg, #8bc34a, #558b2f); color: #fff; }
.action-btn--reject { background: rgba(198, 40, 40, 0.1); color: #c62828; }
.action-btn--reject:hover:not(:disabled) { background: rgba(198, 40, 40, 0.16); }

.action-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 0;
}

.action-status--approved { color: #2e7d32; }
.action-status--rejected { color: #c62828; }

/* ─── Empty state ─── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 24px;
  background: #fff;
  border-radius: 18px;
  border: 2px dashed rgba(0, 0, 0, 0.08);
}

.empty-state__icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(139, 195, 74, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(139, 195, 74, 0.7);
  margin-bottom: 16px;
}

.empty-state__title {
  font-size: 1.05rem;
  font-weight: 800;
  margin: 0 0 8px;
}

.empty-state__text {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.45);
  max-width: 320px;
  line-height: 1.5;
  margin: 0;
}

/* ─── Sidebar tips ─── */
.sidebar-col { position: sticky; top: 80px; }

.tips-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 18px;
}

.tips-card__header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(0, 0, 0, 0.4);
  margin-bottom: 18px;
}

.tips-card__icon { color: #f59e0b; }

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tip-item {
  display: flex;
  gap: 11px;
  align-items: flex-start;
}

.tip-item__icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tip-item__icon--blue { background: rgba(33, 150, 243, 0.12); color: #1565c0; }
.tip-item__icon--yellow { background: rgba(245, 158, 11, 0.12); color: #b45309; }
.tip-item__icon--red { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
.tip-item__icon--green { background: rgba(139, 195, 74, 0.12); color: #558b2f; }

.tip-item__title {
  font-size: 0.825rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 2px;
}

.tip-item__text {
  font-size: 0.775rem;
  color: rgba(0, 0, 0, 0.5);
  line-height: 1.45;
  margin: 0;
}

/* ─── Detail modal ─── */
.detail-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.detail-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
}

.detail-modal__name {
  font-size: 1rem;
  font-weight: 800;
  color: #1a1a1a;
}

.detail-modal__project {
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
}

.detail-modal__close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: transparent;
  color: rgba(0, 0, 0, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.detail-modal__close:hover { background: rgba(0, 0, 0, 0.06); }

.detail-modal__body {
  overflow-y: auto;
  flex: 1;
}

.detail-modal__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
}

.detail-modal__viewer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-modal__img {
  border-radius: 12px;
  background: #f5f5f5;
  width: 100%;
}

:deep(.detail-modal__img img) { object-fit: contain !important; }

.detail-modal__no-img {
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.3);
}

.detail-modal__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.detail-modal__nav-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(139, 195, 74, 0.3);
  background: rgba(139, 195, 74, 0.06);
  color: #558b2f;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.detail-modal__nav-btn:hover:not(:disabled) { background: rgba(139, 195, 74, 0.14); }
.detail-modal__nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.detail-modal__counter {
  font-size: 0.825rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.5);
  min-width: 50px;
  text-align: center;
}

.detail-modal__thumbs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0;
}

.detail-modal__thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.detail-modal__thumb--active { border-color: #8bc34a; }

/* Meta */
.detail-modal__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fafafa;
  border-radius: 12px;
  padding: 12px 14px;
}

.detail-meta-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  font-size: 0.85rem;
}

.detail-meta-row__label {
  min-width: 90px;
  color: rgba(0, 0, 0, 0.4);
  font-weight: 600;
  flex-shrink: 0;
}

.detail-meta-row__value { color: #1a1a1a; font-weight: 500; }

.detail-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 100px;
  font-size: 0.78rem;
  font-weight: 700;
}

.detail-status-badge--pending { background: rgba(230, 81, 0, 0.1); color: #e65100; }
.detail-status-badge--approved { background: rgba(46, 125, 50, 0.1); color: #2e7d32; }
.detail-status-badge--rejected { background: rgba(198, 40, 40, 0.1); color: #c62828; }

/* Notes */
.detail-note {
  padding: 12px 14px;
  border-radius: 10px;
}

.detail-note--volunteer { background: rgba(139, 195, 74, 0.07); border-left: 3px solid #8bc34a; }
.detail-note--organizer { background: rgba(46, 125, 50, 0.07); border-left: 3px solid #2e7d32; }
.detail-note--rejected { background: rgba(198, 40, 40, 0.06); border-left: 3px solid #c62828; }

.detail-note__label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(0, 0, 0, 0.4);
  margin-bottom: 5px;
}

.detail-note__text { font-size: 0.85rem; color: #1a1a1a; margin: 0; line-height: 1.5; }

.detail-modal__footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.detail-close-btn {
  padding: 8px 20px;
  border-radius: 100px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: transparent;
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.detail-close-btn:hover { background: rgba(0, 0, 0, 0.05); }

/* ─── Action modals (approve/reject) ─── */
.action-modal {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
}

.action-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
}

.action-modal__header--approve { background: linear-gradient(135deg, #2e7d32, #4caf50); }
.action-modal__header--reject { background: linear-gradient(135deg, #c62828, #e53935); }

.action-modal__icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-modal__title {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
}

.action-modal__body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.action-modal__desc {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.55);
  margin: 0;
}

.rating-row {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.action-modal__footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px 20px;
}

.action-modal__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  border: none;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.action-modal__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-modal__btn:hover:not(:disabled) { opacity: 0.88; }

.action-modal__btn--primary { color: #fff; }
.action-modal__btn--green { background: linear-gradient(135deg, #8bc34a, #558b2f); }
.action-modal__btn--red { background: linear-gradient(135deg, #e53935, #c62828); }

.action-modal__btn--secondary {
  background: rgba(139, 195, 74, 0.08);
  color: #3a7422;
  border: 1px solid rgba(139, 195, 74, 0.25);
}

.action-modal__btn--cancel {
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px;
}
</style>