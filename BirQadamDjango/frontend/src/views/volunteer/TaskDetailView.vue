<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components';

import { fetchTaskDetail, acceptTask, declineTask, completeTask, type VolunteerTask } from '@/services/tasks';
import { uploadPhotoReport } from '@/services/photoReports';
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
const photoFormRef = ref<VForm | null>(null);

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

async function loadTask() {
  loading.value = true;
  try {
    task.value = await fetchTaskDetail(taskId.value);
    if (!task.value) {
      showSnackbar('Задача не найдена.', 'error');
      router.push({ name: 'volunteer-tasks' });
    }
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить задачу.';
    showSnackbar(errorMessage, 'error');
    router.push({ name: 'volunteer-tasks' });
  } finally {
    loading.value = false;
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

  loading.value = true;
  try {
    await declineTask(task.value.id);
    showSnackbar('Задача отклонена.', 'success');
    await loadTask();
    await dashboardStore.loadDashboard(true);
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
    await loadTask();
    await dashboardStore.loadDashboard(true);
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Не удалось загрузить фото.';
    showSnackbar(errorMessage, 'error');
  } finally {
    uploadingPhoto.value = false;
  }
}

const canAcceptTask = computed(() => {
  return task.value && task.value.status === 'open' && !task.value.is_assigned;
});

const canCompleteTask = computed(() => {
  return task.value && task.value.is_assigned && task.value.status !== 'completed';
});

const canUploadPhoto = computed(() => {
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

          <v-btn
            v-if="canCompleteTask"
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
