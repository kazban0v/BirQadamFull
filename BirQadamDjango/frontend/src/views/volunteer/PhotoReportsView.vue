<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { fetchVolunteerPhotoReports } from '@/services/photoReports';
import type { VolunteerPhotoSummary } from '@/services/dashboard';

// Функция для преобразования относительного URL в полный
const getFullImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  
  // Если уже полный URL, проверяем протокол
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Для localhost оставляем как есть (http), для production используем https
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      // Для localhost оставляем исходный протокол
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
  const baseUrl = isDevelopment 
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'https://birqadam.almau.edu.kz';
  
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
};

const loading = ref(false);
const reports = ref<VolunteerPhotoSummary[]>([]);
const summary = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
});
const filter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all');
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});
const previewPhoto = ref<VolunteerPhotoSummary | null>(null);
const previewDialogOpen = ref(false);

const filteredReports = computed(() => {
  if (filter.value === 'all') return reports.value;
  return reports.value.filter((report) => report.status === filter.value);
});

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
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'primary';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return 'Ожидает';
    case 'approved':
      return 'Одобрено';
    case 'rejected':
      return 'Отклонено';
    default:
      return status;
  }
}

async function loadReports() {
  loading.value = true;
  try {
    console.log('[PhotoReports] Loading reports with filter:', filter.value);
    const data = await fetchVolunteerPhotoReports({ status: filter.value === 'all' ? undefined : filter.value });
    console.log('[PhotoReports] Data received:', { 
      photosCount: data.photos?.length ?? 0, 
      summary: data.summary,
      firstPhoto: data.photos?.[0],
      firstPhotoImageUrl: data.photos?.[0]?.image_url,
      firstPhotoImage: data.photos?.[0]?.image,
    });
    
    // Убеждаемся, что photos - это массив
    reports.value = Array.isArray(data.photos) ? data.photos : [];
    summary.total = data.summary?.total ?? 0;
    summary.pending = data.summary?.pending ?? 0;
    summary.approved = data.summary?.approved ?? 0;
    summary.rejected = data.summary?.rejected ?? 0;
    
    console.log('[PhotoReports] Reports loaded:', reports.value.length);
    if (reports.value.length > 0) {
      console.log('[PhotoReports] First report:', {
        id: reports.value[0].id,
        image_url: reports.value[0].image_url,
        image: reports.value[0].image,
        fullUrl: getFullImageUrl(reports.value[0].image_url),
      });
    }
  } catch (error: any) {
    console.error('[PhotoReports] Error loading reports:', error);
    const errorMessage = error?.response?.data?.detail || error?.response?.data?.error || error?.message || 'Не удалось загрузить фотоотчёты.';
    showSnackbar(errorMessage, 'error');
    reports.value = [];
  } finally {
    loading.value = false;
  }
}

function openPreview(report: VolunteerPhotoSummary) {
  previewPhoto.value = report;
  previewDialogOpen.value = true;
}

function closePreview() {
  previewPhoto.value = null;
  previewDialogOpen.value = false;
}

onMounted(async () => {
  await loadReports();
});

watch(filter, async () => {
  await loadReports();
});
</script>

<template>
  <div class="photo-reports-page">
    <v-card elevation="4" class="pa-6 mb-6">
      <div class="d-flex flex-wrap justify-space-between align-center ga-4">
        <div>
          <h1 class="text-h5 text-md-h4 font-weight-bold mb-2">Фотоотчёты</h1>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Просматривайте историю отправленных фото, статусы модерации и комментарии организаторов.
          </p>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center stats-chips">
          <v-chip color="primary" variant="tonal" size="small" class="stat-chip">
            Всего: {{ summary.total }}
          </v-chip>
          <v-chip color="warning" variant="tonal" size="small" class="stat-chip">
            Ожидают: {{ summary.pending }}
          </v-chip>
          <v-chip color="success" variant="tonal" size="small" class="stat-chip">
            Одобрено: {{ summary.approved }}
          </v-chip>
          <v-chip color="error" variant="tonal" size="small" class="stat-chip">
            Отклонено: {{ summary.rejected }}
          </v-chip>
        </div>
      </div>
      <v-divider class="opacity-10 my-4" />
      <v-btn-toggle v-model="filter" mandatory color="primary">
        <v-btn value="all" size="small">Все</v-btn>
        <v-btn value="pending" size="small">Ожидают</v-btn>
        <v-btn value="approved" size="small">Одобрено</v-btn>
        <v-btn value="rejected" size="small">Отклонено</v-btn>
      </v-btn-toggle>
    </v-card>

    <v-skeleton-loader
      v-if="loading"
      type="image, list-item-three-line@3"
    />

    <v-alert
      v-else-if="!filteredReports.length"
      type="info"
      variant="tonal"
    >
      Фотоотчёты не найдены. После отправки задания фото появятся здесь.
    </v-alert>

    <v-row v-else class="ga-4">
      <v-col
        v-for="report in filteredReports"
        :key="report.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card elevation="3" class="pa-4 d-flex flex-column h-100">
          <div class="d-flex justify-space-between align-start mb-3">
            <div>
              <div class="text-subtitle-2 font-weight-semibold">
                {{ report.project_title }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ report.task_text || 'Общий отчёт' }}
              </div>
            </div>
            <v-chip
              :color="statusColor(report.status)"
              variant="tonal"
              size="small"
              class="font-weight-medium"
            >
              {{ getStatusText(report.status) }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            Отправлено: {{ formatDateTime(report.uploaded_at) }}
          </div>
          <div class="text-caption text-medium-emphasis mb-4" v-if="report.moderated_at">
            Модерация: {{ formatDateTime(report.moderated_at) }}
          </div>
          <v-img
            v-if="report.image_url || report.image"
            :src="getFullImageUrl(report.image_url || report.image) || ''"
            height="180"
            cover
            class="rounded-lg mb-3"
            @click="openPreview(report)"
            @error="(e) => {
              console.error('Error loading photo:', e, {
                image_url: report.image_url,
                image: report.image,
                fullUrl: getFullImageUrl(report.image_url || report.image),
              });
            }"
          />
          <div class="text-body-2 text-medium-emphasis mb-2" v-if="report.volunteer_comment">
            Комментарий: {{ report.volunteer_comment }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-2" v-if="report.organizer_comment">
            Ответ организатора: {{ report.organizer_comment }}
          </div>
          <div class="text-body-2 text-error mb-2" v-if="report.rejection_reason">
            Причина отклонения: {{ report.rejection_reason }}
          </div>
          <v-chip
            v-if="report.rating"
            color="amber"
            variant="tonal"
            size="small"
            class="align-self-start"
          >
            ★ {{ report.rating }}
          </v-chip>
          <v-spacer />
          <v-btn
            color="primary"
            variant="text"
            class="text-none align-self-start mt-4"
            @click="openPreview(report)"
          >
            Просмотреть фото
          </v-btn>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="previewDialogOpen" max-width="640">
      <v-card v-if="previewPhoto">
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <div class="text-subtitle-1 font-weight-semibold">{{ previewPhoto.project_title }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ previewPhoto.task_text || 'Общий отчёт' }}
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="closePreview" />
        </v-card-title>
        <v-divider class="opacity-10" />
        <v-card-text>
          <v-img
            :src="getFullImageUrl(previewPhoto.image_url || previewPhoto.image) || ''"
            height="360"
            cover
            class="rounded-lg mb-4"
            @error="(e) => console.error('Error loading preview photo:', e, previewPhoto.image_url, getFullImageUrl(previewPhoto.image_url))"
          />
          <div class="text-body-2 text-medium-emphasis mb-2">
            Статус: {{ getStatusText(previewPhoto.status) }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-2">
            Отправлено: {{ formatDateTime(previewPhoto.uploaded_at) }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-2" v-if="previewPhoto.moderated_at">
            Модерация: {{ formatDateTime(previewPhoto.moderated_at) }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-2" v-if="previewPhoto.volunteer_comment">
            Комментарий: {{ previewPhoto.volunteer_comment }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-2" v-if="previewPhoto.organizer_comment">
            Ответ организатора: {{ previewPhoto.organizer_comment }}
          </div>
          <div class="text-body-2 text-error mb-2" v-if="previewPhoto.rejection_reason">
            Причина отклонения: {{ previewPhoto.rejection_reason }}
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.photo-reports-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 0;
}

.v-img {
  cursor: pointer;
  transition: transform 0.2s;
}

.v-img:hover {
  transform: scale(1.02);
}

/* Адаптация для ноутбуков (1024px - 1440px) */
@media (max-width: 1440px) {
  .photo-reports-page {
    gap: 20px;
  }
  
  .photo-reports-page :deep(.v-card) {
    padding: 20px !important;
  }
}

@media (max-width: 960px) {
  .photo-reports-page {
    gap: 16px;
  }
  
  .photo-reports-page :deep(.v-card) {
    padding: 16px !important;
  }
  
  .photo-reports-page :deep(.v-card-title) {
    flex-wrap: wrap;
    gap: 12px;
  }

  .photo-reports-page :deep(.v-btn-toggle) {
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  }
  
  .photo-reports-page :deep(.v-btn-toggle .v-btn) {
    flex: 1;
    min-width: 0;
  }
  
  .photo-reports-page :deep(.v-row) {
    margin: 0 !important;
  }
  
  .photo-reports-page :deep(.v-col) {
    padding: 8px !important;
  }
}

@media (max-width: 600px) {
  .photo-reports-page {
    gap: 12px;
  }
  
  .photo-reports-page :deep(.v-card) {
    padding: 12px !important;
    border-radius: 12px !important;
  }
  
  .photo-reports-page :deep(.text-h5) {
    font-size: 1.25rem !important;
  }
  
  .photo-reports-page :deep(.text-h4) {
    font-size: 1.5rem !important;
  }
  
  .photo-reports-page :deep(.v-chip) {
    margin-bottom: 4px;
  }
  
  .stats-chips {
    width: 100%;
    margin-top: 12px;
  }
  
  .stat-chip {
    font-size: 0.75rem !important;
    height: 28px !important;
    padding: 0 8px !important;
    min-width: auto !important;
  }
  
  .photo-reports-page :deep(.stats-chips .v-chip__content) {
    font-size: 0.75rem;
    white-space: nowrap;
  }
  
  .photo-reports-page :deep(.v-btn-toggle .v-btn) {
    font-size: 0.75rem !important;
    padding: 6px 10px !important;
  }
  
  .photo-reports-page :deep(.v-img) {
    height: 160px !important;
  }
  
  .photo-reports-page :deep(.v-dialog) {
    margin: 8px !important;
  }
}

@media (max-width: 400px) {
  .stats-chips {
    flex-direction: column;
    align-items: stretch;
  }
  
  .stat-chip {
    width: 100%;
    justify-content: center;
  }
  
  .photo-reports-page :deep(.v-btn-toggle) {
    flex-direction: column;
  }
  
  .photo-reports-page :deep(.v-btn-toggle .v-btn) {
    width: 100%;
  }
}
</style>

