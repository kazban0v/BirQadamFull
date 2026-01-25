<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { fetchTaskDetail, acceptTask, declineTask, completeTask, type VolunteerTask } from '@/services/tasks';
import { uploadPhotoReport, fetchTaskPhotos } from '@/services/photoReports';
import { httpClient } from '@/services/http';
import { useDashboardStore } from '@/stores/dashboard';

const route = useRoute();
const router = useRouter();
const dashboardStore = useDashboardStore();

const taskId = computed(() => Number(route.params.id));

const loading = ref(false);
const task = ref<VolunteerTask | null>(null);
const snackbar = reactive({
  show: false,
  message: '',
  color: 'success',
});

const taskStatusMap: Record<string, { text: string; color: string }> = {
  open: { text: 'Открыто', color: 'primary' },
  in_progress: { text: 'В работе', color: 'warning' },
  completed: { text: 'Выполнено', color: 'success' },
  failed: { text: 'Отклонено', color: 'error' },
  closed: { text: 'Закрыто', color: 'grey-darken-1' },
};

// Фото
const photoFile = ref<File | null>(null);
const photoPreview = ref<string | null>(null);
const photoComment = ref('');
const uploadingPhoto = ref(false);
const withdrawingPhoto = ref(false);
const photoFormRef = ref<VForm | null>(null);
const hasUploadedPhoto = ref(false);
const taskPhotos = ref<any[]>([]);

function showSnackbar(message: string, color: string = 'success') {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return value;
}

async function loadTask(forceRefresh = false) {
  loading.value = true;
  try {
    task.value = await fetchTaskDetail(taskId.value, forceRefresh);
    if (!task.value) {
      showSnackbar('Задача не найдена.', 'error');
      router.push({ name: 'volunteer-tasks' });
      return;
    }
    // Проверяем наличие загруженных фото
    await checkPhotoStatus();
  } catch (error: any) {
    // Обрабатываем ошибку 429 отдельно
    if (error?.response?.status === 429) {
      showSnackbar('Слишком много запросов. Пожалуйста, подождите немного.', 'warning');
      // Пытаемся загрузить с кешем
      if (!task.value) {
        setTimeout(() => loadTask(false), 2000);
      }
    } else {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачу.';
      showSnackbar(errorMessage, 'error');
      if (!task.value) {
        router.push({ name: 'volunteer-tasks' });
      }
    }
  } finally {
    loading.value = false;
  }
}

async function checkPhotoStatus() {
  if (!task.value) return;
  try {
    const response = await fetchTaskPhotos(task.value.id);
    hasUploadedPhoto.value = response && response.photos && response.photos.length > 0;
    taskPhotos.value = response?.photos || [];
  } catch (error) {
    console.error('Failed to check photo status:', error);
    hasUploadedPhoto.value = false;
    taskPhotos.value = [];
  }
}

async function handleAcceptTask() {
  if (!task.value) return;

  loading.value = true;
  try {
    await acceptTask(task.value.id);
    showSnackbar('Вы успешно взялись за задачу!', 'success');
    await loadTask();
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось принять задачу.';
    showSnackbar(errorMessage, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleDeclineTask() {
  if (!task.value) return;

  const isAccepted = task.value.is_assigned;
  const message = isAccepted 
    ? 'Вы отказались от принятой задачи. Задача будет скрыта из ваших активных.'
    : 'Задача отклонена.';

  loading.value = true;
  try {
    await declineTask(task.value.id);
    showSnackbar(message, 'success');
    await loadTask();
    await dashboardStore.loadDashboard(true);
    // Перенаправляем на страницу задач, если задача была отклонена
    if (isAccepted) {
      setTimeout(() => {
        router.push({ name: 'volunteer-tasks' });
      }, 1500);
    }
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отклонить задачу.';
    showSnackbar(errorMessage, 'error');
  } finally {
    loading.value = false;
  }
}

async function handleCompleteTask() {
  if (!task.value) return;

  loading.value = true;
  try {
    await completeTask(task.value.id);
    showSnackbar('Задача отмечена как выполненная!', 'success');
    await loadTask();
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отметить задачу как выполненную.';
    showSnackbar(errorMessage, 'error');
  } finally {
    loading.value = false;
  }
}

function handlePhotoSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    
    // Проверяем размер файла (макс 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showSnackbar('Размер файла не должен превышать 10MB.', 'error');
      return;
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      showSnackbar('Пожалуйста, выберите изображение.', 'error');
      return;
    }

    photoFile.value = file;

    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      photoPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  photoFile.value = null;
  photoPreview.value = null;
  const input = document.querySelector('#photo-input') as HTMLInputElement;
  if (input) input.value = '';
}

async function handleUploadPhoto() {
  if (!task.value || !photoFile.value) return;

  const valid = await photoFormRef.value?.validate();
  if (!valid?.valid) return;

  uploadingPhoto.value = true;
  try {
    await uploadPhotoReport(task.value.id, photoFile.value, photoComment.value || undefined);
    showSnackbar('Фото успешно загружено!', 'success');
    photoFile.value = null;
    photoPreview.value = null;
    photoComment.value = '';
    const input = document.querySelector('#photo-input') as HTMLInputElement;
    if (input) input.value = '';
    hasUploadedPhoto.value = true; // Отмечаем, что фото загружено
    await loadTask();
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить фото.';
    showSnackbar(errorMessage, 'error');
  } finally {
    uploadingPhoto.value = false;
  }
}

async function handleWithdrawPhoto() {
  if (!task.value) return;

  if (!confirm('Вы уверены, что хотите отозвать фотоотчёт? После отзыва вы сможете загрузить новый фотоотчёт.')) {
    return;
  }

  withdrawingPhoto.value = true;
  try {
    const response = await deletePhotoReport(task.value.id);
    showSnackbar(response.message || 'Фотоотчёт успешно отозван. Теперь вы можете загрузить новый фотоотчёт.', 'success');
    // Сбрасываем состояние сразу
    hasUploadedPhoto.value = false;
    taskPhotos.value = [];
    // Очищаем форму
    photoFile.value = null;
    photoPreview.value = null;
    photoComment.value = '';
    const input = document.querySelector('#photo-input') as HTMLInputElement;
    if (input) input.value = '';
    // Обновляем данные задачи и фото
    await checkPhotoStatus();
    await loadTask(false); // Используем кеш для быстрого обновления
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    console.error('Error withdrawing photo:', error);
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось отозвать фотоотчёт.';
    showSnackbar(errorMessage, 'error');
  } finally {
    withdrawingPhoto.value = false;
  }
}

const canAcceptTask = computed(() => {
  return task.value && task.value.status === 'open' && !task.value.is_assigned;
});

const canCompleteTask = computed(() => {
  return task.value && task.value.is_assigned && task.value.status !== 'completed' && hasUploadedPhoto.value;
});

const canUploadPhoto = computed(() => {
  return task.value && task.value.is_assigned && task.value.status !== 'completed';
});

const canDeclineAcceptedTask = computed(() => {
  return task.value && task.value.is_assigned && task.value.status !== 'completed';
});

onMounted(async () => {
  await loadTask();
});
</script>

<template>
  <div class="task-detail-page">
    <v-btn
      color="primary"
      variant="text"
      class="mb-4"
      @click="router.push({ name: 'volunteer-tasks' })"
    >
      <v-icon icon="mdi-arrow-left" start />
      Назад к задачам
    </v-btn>

    <v-skeleton-loader
      v-if="loading && !task"
      type="article@3"
    />

    <template v-else-if="task">
      <!-- Информация о задаче -->
      <v-card elevation="4" class="pa-6 mb-6 task-info-card">
        <div class="d-flex justify-space-between align-start mb-4">
          <div class="flex-grow-1">
            <h1 class="text-h4 text-md-h3 font-weight-bold mb-4">{{ task.text }}</h1>
            
            <div class="d-flex flex-wrap ga-4 mb-4">
              <v-chip
                :color="taskStatusMap[task.status]?.color || 'primary'"
                variant="tonal"
                size="large"
                class="text-uppercase font-weight-medium"
              >
                {{ taskStatusMap[task.status]?.text || task.status }}
              </v-chip>
              <v-chip
                v-if="task.is_assigned"
                color="success"
                variant="tonal"
                size="large"
              >
                Вы приняли задачу
              </v-chip>
            </div>
          </div>
        </div>

        <v-divider class="my-4" />

        <v-row class="ga-4">
          <v-col cols="12" md="6">
            <div class="text-body-1 mb-2">
              <v-icon icon="mdi-folder-outline" size="20" class="me-2" />
              <strong>Проект:</strong> {{ task.project_title }}
            </div>
            <div class="text-body-1 mb-2">
              <v-icon icon="mdi-account-outline" size="20" class="me-2" />
              <strong>Создатель:</strong> {{ task.creator_name }}
            </div>
            <div class="text-body-1 mb-2">
              <v-icon icon="mdi-clock-outline" size="20" class="me-2" />
              <strong>Создано:</strong> {{ formatDateTime(task.created_at) }}
            </div>
          </v-col>
          <v-col cols="12" md="6">
            <div v-if="task.deadline_date" class="text-body-1 mb-2">
              <v-icon icon="mdi-calendar-clock" size="20" class="me-2" />
              <strong>Срок выполнения:</strong> {{ formatDate(task.deadline_date) }}
            </div>
            <div v-if="task.start_time && task.end_time" class="text-body-1 mb-2">
              <v-icon icon="mdi-clock-time-four-outline" size="20" class="me-2" />
              <strong>Время:</strong> {{ formatTime(task.start_time) }} - {{ formatTime(task.end_time) }}
            </div>
            <div class="text-body-1">
              <v-icon icon="mdi-information-outline" size="20" class="me-2" />
              <strong>ID задачи:</strong> {{ task.id }}
            </div>
          </v-col>
        </v-row>
      </v-card>

      <!-- Действия с задачей -->
      <v-card elevation="4" class="pa-6 mb-6 action-card">
        <h2 class="text-h5 font-weight-bold mb-4">Действия с задачей</h2>
        
        <div class="d-flex flex-wrap ga-3">
          <v-btn
            v-if="canAcceptTask"
            color="success"
            variant="flat"
            size="large"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="handleAcceptTask"
          >
            <v-icon icon="mdi-check-circle" start />
            Принять задачу
          </v-btn>

          <v-btn
            v-if="canAcceptTask"
            color="error"
            variant="outlined"
            size="large"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="handleDeclineTask"
          >
            <v-icon icon="mdi-close-circle" start />
            Отклонить задачу
          </v-btn>

          <v-tooltip v-if="task && task.is_assigned && task.status !== 'completed' && !hasUploadedPhoto" location="top">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                v-if="task && task.is_assigned && task.status !== 'completed'"
                color="primary"
                variant="flat"
                size="large"
                class="text-none font-weight-bold"
                :loading="loading"
                :disabled="!hasUploadedPhoto"
                @click="handleCompleteTask"
              >
                <v-icon icon="mdi-check-all" start />
                Отметить как выполненную
              </v-btn>
            </template>
            <span>Сначала загрузите фотоотчет</span>
          </v-tooltip>
          <v-btn
            v-if="task && task.is_assigned && task.status !== 'completed' && hasUploadedPhoto"
            color="primary"
            variant="flat"
            size="large"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="handleCompleteTask"
          >
            <v-icon icon="mdi-check-all" start />
            Отметить как выполненную
          </v-btn>

          <v-btn
            v-if="canDeclineAcceptedTask"
            color="error"
            variant="outlined"
            size="large"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="handleDeclineTask"
          >
            <v-icon icon="mdi-close-circle" start />
            Отклонить задачу
          </v-btn>

          <v-btn
            v-if="task.is_assigned && task.status === 'completed'"
            color="success"
            variant="tonal"
            size="large"
            class="text-none font-weight-bold"
            disabled
          >
            <v-icon icon="mdi-check-circle" start />
            Задача выполнена
          </v-btn>
        </div>
      </v-card>

      <!-- Информация о загруженном фотоотчете (режим просмотра) -->
      <v-card
        v-if="hasUploadedPhoto && task && task.is_assigned && task.status !== 'completed'"
        elevation="4"
        class="pa-6 photo-upload-card"
      >
        <h2 class="text-h5 font-weight-bold mb-4">Фотоотчет</h2>
        
        <v-alert
          type="info"
          variant="tonal"
          class="mb-4"
        >
          Вы уже отправили фотоотчёт для этой задачи.
        </v-alert>

        <div v-if="taskPhotos.length > 0" class="mb-4">
          <div v-for="photo in taskPhotos" :key="photo.id" class="mb-3">
            <div class="d-flex align-center ga-2 mb-2">
              <v-chip
                :color="photo.status === 'approved' ? 'success' : photo.status === 'rejected' ? 'error' : 'warning'"
                size="small"
                variant="tonal"
              >
                {{ photo.status === 'approved' ? 'Одобрено' : photo.status === 'rejected' ? 'Отклонено' : 'На проверке' }}
              </v-chip>
              <span class="text-caption text-medium-emphasis">
                Загружено: {{ formatDateTime(photo.uploaded_at) }}
              </span>
            </div>
            <v-img
              v-if="photo.image_url"
              :src="photo.image_url"
              max-height="200"
              class="rounded-lg mb-2"
              cover
            />
            <p v-if="photo.volunteer_comment" class="text-body-2 mb-2">
              <strong>Ваш комментарий:</strong> {{ photo.volunteer_comment }}
            </p>
            <p v-if="photo.organizer_comment" class="text-body-2 mb-2 text-success">
              <strong>Ответ организатора:</strong> {{ photo.organizer_comment }}
            </p>
            <p v-if="photo.rejection_reason" class="text-body-2 mb-2 text-error">
              <strong>Причина отклонения:</strong> {{ photo.rejection_reason }}
            </p>
          </div>
        </div>

        <v-btn
          color="error"
          variant="outlined"
          size="large"
          class="text-none font-weight-bold"
          :loading="withdrawingPhoto"
          @click="handleWithdrawPhoto"
        >
          <v-icon icon="mdi-undo" start />
          Отозвать фотоотчет
        </v-btn>
      </v-card>

      <!-- Загрузка фото -->
      <v-card
        v-if="canUploadPhoto"
        elevation="4"
        class="pa-6 photo-upload-card"
      >
        <h2 class="text-h5 font-weight-bold mb-4">Фотоотчет</h2>
        
        <v-form ref="photoFormRef" @submit.prevent="handleUploadPhoto">
          <v-row class="ga-4">
            <v-col cols="12">
              <v-file-input
                id="photo-input"
                label="Выберите фото"
                accept="image/*"
                prepend-icon="mdi-camera"
                variant="outlined"
                :disabled="uploadingPhoto"
                @change="handlePhotoSelect"
              />
              
              <v-img
                v-if="photoPreview"
                :src="photoPreview"
                max-height="300"
                class="mt-4 rounded-lg"
                cover
              >
                <template #placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular indeterminate color="primary" />
                  </v-row>
                </template>
              </v-img>

              <v-btn
                v-if="photoPreview"
                color="error"
                variant="text"
                size="small"
                class="mt-2"
                @click="removePhoto"
              >
                <v-icon icon="mdi-delete" start />
                Удалить фото
              </v-btn>
            </v-col>

            <v-col cols="12">
              <v-textarea
                v-model="photoComment"
                label="Комментарий к фото (необязательно)"
                variant="outlined"
                rows="3"
                :disabled="uploadingPhoto"
              />
            </v-col>

            <v-col cols="12">
              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                size="large"
                class="text-none font-weight-bold"
                :disabled="!photoFile || uploadingPhoto"
                :loading="uploadingPhoto"
              >
                <v-icon icon="mdi-upload" start />
                Загрузить фотоотчет
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </v-card>
    </template>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.message }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.task-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.task-info-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 250, 246, 0.96)); /* BirQadam background */
  border: 1px solid rgba(139, 195, 74, 0.08); /* BirQadam primary */
}

.action-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 250, 246, 0.9)); /* BirQadam background */
}

.photo-upload-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 250, 246, 0.9)); /* BirQadam background */
}
</style>
