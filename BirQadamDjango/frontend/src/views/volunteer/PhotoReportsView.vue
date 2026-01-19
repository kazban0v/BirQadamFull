<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { fetchVolunteerPhotoReports } from '@/services/photoReports';
import type { VolunteerPhotoSummary } from '@/services/dashboard';

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

async function loadReports() {
  loading.value = true;
  try {
    const data = await fetchVolunteerPhotoReports({ status: filter.value === 'all' ? undefined : filter.value });
    reports.value = data.photos;
    summary.total = data.summary.total;
    summary.pending = data.summary.pending;
    summary.approved = data.summary.approved;
    summary.rejected = data.summary.rejected;
  } catch (error: any) {
    showSnackbar(error?.response?.data?.detail || 'Не удалось загрузить фотоотчёты.', 'error');
  } finally {
    loading.value = false;
  }
}

function openPreview(report: VolunteerPhotoSummary) {
  previewPhoto.value = report;
}

function closePreview() {
  previewPhoto.value = null;
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
        <div class="d-flex ga-2 align-center">
          <v-chip color="primary" variant="tonal">
            Всего: {{ summary.total }}
          </v-chip>
          <v-chip color="warning" variant="tonal">
            Ожидают: {{ summary.pending }}
          </v-chip>
          <v-chip color="success" variant="tonal">
            Одобрено: {{ summary.approved }}
          </v-chip>
          <v-chip color="error" variant="tonal">
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
              class="text-uppercase font-weight-medium"
            >
              {{ report.status }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis mb-2">
            Отправлено: {{ formatDateTime(report.uploaded_at) }}
          </div>
          <div class="text-caption text-medium-emphasis mb-4" v-if="report.moderated_at">
            Модерация: {{ formatDateTime(report.moderated_at) }}
          </div>
          <v-img
            v-if="report.image_url"
            :src="report.image_url"
            height="180"
            cover
            class="rounded-lg mb-3"
            @click="openPreview(report)"
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

    <v-dialog v-model="previewPhoto" max-width="640">
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
            :src="previewPhoto.image_url"
            height="360"
            cover
            class="rounded-lg mb-4"
          />
          <div class="text-body-2 text-medium-emphasis mb-2">
            Статус: {{ previewPhoto.status }}
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
}

.v-img {
  cursor: pointer;
}

@media (max-width: 960px) {
  .photo-reports-page :deep(.v-card-title) {
    flex-wrap: wrap;
    gap: 12px;
  }

  .photo-reports-page :deep(.v-btn-toggle) {
    flex-wrap: wrap;
    gap: 8px;
  }
}

@media (max-width: 600px) {
  .photo-reports-page :deep(.v-chip) {
    margin-bottom: 4px;
  }
}
</style>

